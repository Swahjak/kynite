import 'server-only';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { event } from '@/modules/calendar';
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
