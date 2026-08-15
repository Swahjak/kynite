import 'server-only';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/server/db';
// The `event` *table*, from the schema assembly point rather than from
// `@/modules/calendar`. Two reasons, and the second is the load-bearing one:
//
//  1. It is the table object a query needs, which is exactly what
//     `server/db/schema.ts` exists to collect (§2 names it the schema assembly
//     point, and the boundary lint already exempts it).
//  2. `@/modules/calendar` re-exports that slice's client components, which
//     pull `next-intl`'s client navigation. Importing the barrel here made the
//     Google slice — and every Node test that touches it — drag a React client
//     graph into a plain server module, and created a genuine import cycle
//     (calendar barrel → actions → google barrel → store → calendar barrel).
import { event } from '@/server/db/schema';
import { publish } from '@/modules/realtime';
import { createEchoRegistry } from './domain/echo';
import type { PushStore } from './domain/push-engine';
import type {
  CalendarSyncState,
  Emitter,
  MappedEvent,
  StoredEvent,
  SyncStore,
} from './domain/types';
import { calendar } from './schema';

/**
 * The drizzle implementation of the sync/push ports.
 *
 * Everything database-shaped lives here so `domain/` stays pure and the
 * fixture suite can drive the same engines with an in-memory double
 * (docs/architecture.md §9).
 */

/** Process-wide echo registry: our own etags, shared by the push and sync paths. */
export const echoRegistry = createEchoRegistry();

/** The columns the engine mutates on every upsert — one list, two call sites. */
function upsertValues(
  calendarState: CalendarSyncState,
  input: MappedEvent,
  parentId: string | null
) {
  return {
    familyId: calendarState.familyId,
    calendarId: calendarState.id,
    googleEventId: input.googleEventId,
    title: input.title,
    description: input.description,
    location: input.location,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    allDay: input.allDay,
    tz: input.tz,
    rrule: input.rrule,
    rdates: input.rdates,
    exdates: input.exdates,
    recurrenceParentId: parentId,
    // The slot this override replaces on its master. Null on a master (and on
    // an override Google sent without one), which the expander reads as
    // "nothing to suppress".
    recurrenceOriginalStart: input.recurrenceOriginalStart,
    // M18 attribution. On an *insert* these are simply what the pass resolved;
    // the conflict branch below is where the interesting rule lives.
    ownerMemberId: input.ownerMemberId,
    attendeeMemberIds: input.attendeeMemberIds,
    etag: input.etag,
    updatedAtRemote: input.updatedAtRemote,
    // A remote resurrection un-deletes the local row: Google is the source of
    // truth for events that live in a Google calendar.
    deletedAt: null,
  };
}

async function upsertEvent(
  calendarState: CalendarSyncState,
  input: MappedEvent,
  parentId: string | null
): Promise<{ id: string; version: number }> {
  const values = upsertValues(calendarState, input, parentId);

  const [row] = await getDb()
    .insert(event)
    .values(values)
    .onConflictDoUpdate({
      target: [event.calendarId, event.googleEventId],
      set: {
        ...values,
        // Keep the parent link when this pass did not resolve one (an override
        // whose master arrives in a later page).
        recurrenceParentId: parentId ?? sql`${event.recurrenceParentId}`,
        /**
         * The slot an override replaces, with one asymmetry against the line
         * above: `recurringEventId` is what decides, not the value itself.
         *
         * An instance resource *always* carries both fields, so "Google says
         * this is still an override" and "it has an original start" arrive
         * together. When Google **detaches** an exception it sends the event
         * with neither, and the row must stop suppressing a slot on a series it
         * no longer belongs to — hence the explicit null rather than a sticky
         * keep. The `??` inside the override branch is only for a malformed
         * `originalStartTime` the mapper could not read.
         *
         * `recurrenceParentId` above deliberately stays sticky through the same
         * shape. A Kynite-authored occurrence edit is a *native* child whose
         * parent link is the app's own data, and its push echo comes back from
         * Google as a plain standalone event with no `recurringEventId` — the
         * detached-exception shape exactly. Clearing on that signal would cut a
         * native override loose from its series; clearing the original start
         * cannot, because a native child never had one.
         */
        recurrenceOriginalStart: input.recurringEventId
          ? (input.recurrenceOriginalStart ?? sql`${event.recurrenceOriginalStart}`)
          : null,
        /**
         * Attribution is **never destructive on update** (M18).
         *
         * Sync is not the authority on who an event belongs to; the parent who
         * assigned it in the event form is. So on an update:
         *
         *  - `owner_member_id` is only ever *filled in*, never replaced. A
         *    non-null owner survives every subsequent pass — a remote edit with
         *    a fresh etag, a 410 full resync, a calendar switched off and back
         *    on. `coalesce(existing, resolved)` is the whole rule.
         *  - `attendee_member_ids` is a **union**: sync may add participants it
         *    matched, and removes nobody.
         *
         * The earlier `?? keep-existing` guard did not do this. `attributeEvent`
         * almost always resolves *something* (organizer, else the calendar
         * owner), so the guard only ever fired on the push-echo path and every
         * ordinary Google pass overwrote the parent's choice with Google's.
         * That path still behaves identically: `applyRemote` re-maps our own
         * write, which carries no attribution at all, and `coalesce` of a null
         * is the existing value.
         *
         * The insert path is untouched — a brand-new row has nothing to protect,
         * so it simply takes what the pass resolved (see `upsertValues`).
         */
        ownerMemberId: sql`coalesce(${event.ownerMemberId}, ${input.ownerMemberId}::uuid)`,
        attendeeMemberIds:
          input.attendeeMemberIds.length > 0
            ? sql`(
                select coalesce(array_agg(distinct m), '{}'::uuid[])
                from unnest(
                  ${event.attendeeMemberIds} || ${sql.param(input.attendeeMemberIds)}::uuid[]
                ) as m
              )`
            : sql`${event.attendeeMemberIds}`,
        version: sql`${event.version} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: event.id, version: event.version });

  return row;
}

export const syncStore: SyncStore = {
  async findByGoogleIds(calendarId, googleEventIds) {
    const found = new Map<string, StoredEvent>();
    if (googleEventIds.length === 0) return found;

    const rows = await getDb()
      .select({
        id: event.id,
        googleEventId: event.googleEventId,
        etag: event.etag,
        recurrenceOriginalStart: event.recurrenceOriginalStart,
        updatedAtRemote: event.updatedAtRemote,
        updatedAt: event.updatedAt,
        version: event.version,
        deletedAt: event.deletedAt,
      })
      .from(event)
      .where(and(eq(event.calendarId, calendarId), inArray(event.googleEventId, googleEventIds)));

    for (const row of rows) {
      if (row.googleEventId) found.set(row.googleEventId, row);
    }
    return found;
  },

  upsertEvent,

  async tombstone(calendarState, googleEventId, at) {
    const [row] = await getDb()
      .update(event)
      .set({ deletedAt: at, version: sql`${event.version} + 1`, updatedAt: at })
      .where(
        and(
          eq(event.calendarId, calendarState.id),
          eq(event.googleEventId, googleEventId),
          // Already tombstoned: nothing changed, so nothing to broadcast.
          isNull(event.deletedAt)
        )
      )
      .returning({ id: event.id, version: event.version });

    return row ?? null;
  },

  async setSyncToken(calendarId, token, syncedAt) {
    await getDb()
      .update(calendar)
      .set({ syncToken: token, syncedAt, updatedAt: new Date() })
      .where(eq(calendar.id, calendarId));
  },
};

/**
 * The standing half of the M18/M23 attribution repair (`discoverCalendars`
 * calls this once a calendar's `owner_member_id` is known) — see the doc
 * comment there for why a code-side repair is needed at all.
 *
 * `owner_member_id`'s update rule is deliberately one-directional
 * (`upsertEvent` above, M18's `coalesce`): a parent's own attribution must
 * survive every later sync pass, which also means an event that synced
 * *before* its calendar had a resolved owner is stuck with a null one
 * forever — nothing about an ordinary incremental pass ever revisits a row
 * Google itself has not changed. `0013`/`0019` fixed this once, in SQL, for
 * every row that was stuck at the time; this is the same statement, run
 * every time discovery resolves (or re-resolves) a calendar's owner, so the
 * fix does not silently stop working the next time a calendar spends any time
 * with a null owner — a member deleted and re-created while their calendar
 * keeps syncing, for instance (`calendar.owner_member_id` is `onDelete: 'set
 * null'`).
 *
 * The predicate is the same invariant `upsertEvent`'s conflict branch reads:
 * `owner_member_id IS NULL` *and* an empty `attendee_member_ids` together mean
 * "nobody — sync or parent — has ever attributed this row", so this can never
 * overwrite a parent's own choice. Soft-deleted rows are skipped; they are off
 * every board already.
 */
export async function backfillCalendarAttribution(
  calendarId: string,
  ownerMemberId: string
): Promise<void> {
  await getDb()
    .update(event)
    .set({
      ownerMemberId,
      attendeeMemberIds: sql`ARRAY[${ownerMemberId}::uuid]`,
      version: sql`${event.version} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(event.calendarId, calendarId),
        isNull(event.deletedAt),
        isNull(event.ownerMemberId),
        sql`cardinality(${event.attendeeMemberIds}) = 0`
      )
    );
}

export const pushStore: PushStore = {
  /**
   * Claim the id *before* the insert (M04 carry-forward: the
   * `(calendarId, googleEventId)` unique index is NULLS DISTINCT, so an
   * unclaimed row is no protection against a duplicate push). The `IS NULL`
   * predicate makes the claim atomic; if another attempt won the race we adopt
   * whatever it stored rather than minting a second id.
   */
  async claimGoogleEventId(eventId, googleEventId) {
    const db = getDb();

    const [claimed] = await db
      .update(event)
      .set({ googleEventId })
      .where(and(eq(event.id, eventId), isNull(event.googleEventId)))
      .returning({ googleEventId: event.googleEventId });

    if (claimed?.googleEventId) return claimed.googleEventId;

    const [existing] = await db
      .select({ googleEventId: event.googleEventId })
      .from(event)
      .where(eq(event.id, eventId))
      .limit(1);

    return existing?.googleEventId ?? googleEventId;
  },

  async recordPush(eventId, patch) {
    await getDb()
      .update(event)
      .set({
        ...(patch.googleEventId ? { googleEventId: patch.googleEventId } : {}),
        etag: patch.etag,
        updatedAtRemote: patch.updatedAtRemote,
      })
      .where(eq(event.id, eventId));
  },

  async applyRemote(calendarState, input) {
    const parentId = input.recurringEventId
      ? await resolveParentId(calendarState.id, input.recurringEventId)
      : null;
    return upsertEvent(calendarState, input, parentId);
  },
};

async function resolveParentId(calendarId: string, googleEventId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: event.id })
    .from(event)
    .where(and(eq(event.calendarId, calendarId), eq(event.googleEventId, googleEventId)))
    .limit(1);

  return row?.id ?? null;
}

/**
 * The emitter the jobs use: engine emissions → `event_log` + `pg_notify` (§4).
 * `source: 'sync'` marks these as machine-originated, so a client can tell a
 * Google-driven change from a parent's tap.
 */
export const publishEmitter: Emitter = async (emission) => {
  await publish({
    familyId: emission.familyId,
    type: emission.type,
    entity:
      emission.type === 'sync.status'
        ? { id: emission.entityId }
        : { id: emission.entityId, version: emission.version },
    actor: { source: 'sync' },
    ...(emission.type === 'sync.status' ? { patch: emission.patch } : {}),
  });
};
