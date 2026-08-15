import 'server-only';
import { and, eq, inArray, isNotNull, notInArray } from 'drizzle-orm';
import { getDb } from '@/server/db';
// The tables from the schema assembly point rather than a slice barrel — the
// same note (and the same import-cycle reason) as `modules/google/sync.ts`.
import { calendar, event } from '@/server/db/schema';
import { publish } from '@/modules/realtime';
import { parseIcs, type ParsedFeedEvent } from './domain/parse';
import { fetchFeed, type FetchFailure, type FetchOptions } from './fetch';
import { icsSubscription } from './schema';

/**
 * One subscription, refreshed (M25).
 *
 * The whole ingest path: fetch (conditionally), parse, upsert, prune. It
 * mirrors `modules/google/sync.ts`'s conventions where they apply — rows keyed
 * on (calendar, remote id), `updatedAt` bumped on write — and deliberately
 * departs on two:
 *
 * - **No tombstones.** A Google row is soft-deleted so the sync engine can echo
 *   the deletion back; a feed is read-only, nothing is ever echoed anywhere,
 *   and a row that has left the feed is simply gone. A `deleted_at` here would
 *   be a permanently invisible row that every query still has to filter.
 * - **No `syncToken`.** ICS has no incremental protocol: every refresh is the
 *   whole calendar. What replaces it is the conditional GET — `ETag` /
 *   `Last-Modified` on the subscription — so an unchanged feed costs one 304
 *   and no parsing at all.
 *
 * **Failures keep the events.** A school server that 500s, a link that moved, a
 * feed that briefly serves an HTML error page: each records `lastError` and
 * returns. The last good import stays on the board, because a family's holiday
 * list silently emptying itself is a far worse failure than a stale one — and
 * the settings row shows the error either way.
 */

export type RefreshFailure = FetchFailure | 'parseFailed';

/**
 * The zone a floating DTSTART is read in when the calendar row has none of its
 * own — the same default the Google mapper carries, and for the same reason:
 * some zone has to be chosen and this is the household's.
 */
export const DEFAULT_FEED_TIMEZONE = 'Europe/Amsterdam';

export type RefreshOutcome =
  | { status: 'synced'; imported: number; removed: number }
  | { status: 'unchanged' }
  | { status: 'skipped'; reason: 'not-found' | 'disabled' }
  | { status: 'failed'; error: RefreshFailure };

/** The `ics:refresh` sweep's row set: every subscription whose calendar is on. */
export async function listRefreshableSubscriptionIds(): Promise<string[]> {
  const rows = await getDb()
    .select({ id: icsSubscription.id })
    .from(icsSubscription)
    .innerJoin(calendar, eq(icsSubscription.calendarId, calendar.id))
    .where(eq(calendar.syncEnabled, true));

  return rows.map((row) => row.id);
}

export async function refreshSubscription(
  subscriptionId: string,
  options: FetchOptions = {}
): Promise<RefreshOutcome> {
  const db = getDb();

  const [row] = await db
    .select({ subscription: icsSubscription, calendar })
    .from(icsSubscription)
    .innerJoin(calendar, eq(icsSubscription.calendarId, calendar.id))
    .where(eq(icsSubscription.id, subscriptionId))
    .limit(1);

  if (!row) return { status: 'skipped', reason: 'not-found' };
  // A disabled subscription is left exactly as it is — including its events,
  // which the calendar query already hides on `sync_enabled` (M18's safety
  // net). Re-enabling therefore costs nothing and shows the feed instantly.
  if (!row.calendar.syncEnabled) return { status: 'skipped', reason: 'disabled' };

  const { subscription } = row;

  const result = await fetchFeed(subscription.url, {
    ...options,
    etag: subscription.etag,
    lastModified: subscription.lastModified,
  });

  if (!result.ok) {
    await recordFailure(subscription.id, result.error);
    return { status: 'failed', error: result.error };
  }

  if (result.notModified || result.body === null) {
    await db
      .update(icsSubscription)
      .set({ lastSyncedAt: new Date(), lastError: null, lastErrorAt: null, updatedAt: new Date() })
      .where(eq(icsSubscription.id, subscription.id));
    return { status: 'unchanged' };
  }

  const { imported, removed } = await ingestFeed({
    subscriptionId: subscription.id,
    familyId: row.calendar.familyId,
    calendarId: subscription.calendarId,
    body: result.body,
    etag: result.etag,
    lastModified: result.lastModified,
    defaultTimeZone: row.calendar.timeZone,
  });

  if (imported > 0 || removed > 0) {
    // One publish for the whole feed, not one per event: a hub reads
    // `settings.updated` as "re-read yourself" (M16), and two hundred
    // `event.upserted` frames would say the same thing two hundred times.
    await publish({
      familyId: row.calendar.familyId,
      type: 'settings.updated',
      entity: { id: subscription.calendarId },
      actor: { source: 'sync' },
      patch: { subscriptionId: subscription.id, imported, removed },
    }).catch(() => {});
  }

  return { status: 'synced', imported, removed };
}

/**
 * A fetched body, made into events — parse, store, stamp the subscription.
 *
 * Exported because "subscribe" and "refresh" are the same ingest with different
 * front halves: the add action in `./actions.ts` has already fetched the feed
 * once to validate the URL a parent typed, and making it fetch a second time
 * just to reuse `refreshSubscription` would double the load on a school's
 * server for every subscription ever created.
 */
export async function ingestFeed(params: {
  subscriptionId: string;
  familyId: string;
  calendarId: string;
  body: string;
  etag: string | null;
  lastModified: string | null;
  /** The calendar's own zone, when it has one — how a floating DTSTART is read. */
  defaultTimeZone: string | null;
}): Promise<{ imported: number; removed: number }> {
  const feed = parseIcs(params.body, {
    defaultTimeZone: params.defaultTimeZone ?? DEFAULT_FEED_TIMEZONE,
  });

  // A feed that parses to no events is not an error — a school's calendar is
  // legitimately empty over the summer. A body that was not a calendar at all
  // was already refused by `looksLikeCalendar` in `./fetch.ts`.
  const stored = await storeFeed(params.familyId, params.calendarId, feed.events);

  const now = new Date();
  await getDb()
    .update(icsSubscription)
    .set({
      etag: params.etag,
      lastModified: params.lastModified,
      lastSyncedAt: now,
      lastError: null,
      lastErrorAt: null,
      updatedAt: now,
    })
    .where(eq(icsSubscription.id, params.subscriptionId));

  return stored;
}

async function recordFailure(subscriptionId: string, error: RefreshFailure): Promise<void> {
  const now = new Date();
  await getDb()
    .update(icsSubscription)
    .set({ lastError: error, lastErrorAt: now, updatedAt: now })
    .where(eq(icsSubscription.id, subscriptionId));
}

/**
 * The feed's events, made to be the calendar's events — inserts, updates and
 * removals in one transaction.
 *
 * Three passes, and the order is load-bearing:
 *
 *  1. **Masters** (everything without a `RECURRENCE-ID`) upsert first, so that
 *  2. **overrides** can point `recurrence_parent_id` at a row that exists. An
 *     override whose master is missing from the feed is stored parentless
 *     rather than dropped — it is still a real appointment on a real day.
 *  3. **Prune**: any row on this calendar carrying a `source_uid` the feed no
 *     longer contains. Scoped by `source_uid IS NOT NULL`, so a native event a
 *     parent somehow created here could never be deleted by a refresh.
 */
async function storeFeed(
  familyId: string,
  calendarId: string,
  events: ParsedFeedEvent[]
): Promise<{ imported: number; removed: number }> {
  const masters = events.filter((entry) => entry.overrideOf === null);
  const overrides = events.filter((entry) => entry.overrideOf !== null);
  const keep = [...new Set(events.map((entry) => entry.sourceUid))];

  return getDb().transaction(async (tx) => {
    for (const parsed of masters) {
      await upsertEvent(tx, familyId, calendarId, parsed, null);
    }

    let parentByUid = new Map<string, string>();
    if (overrides.length > 0) {
      const parentUids = [...new Set(overrides.map((entry) => entry.overrideOf as string))];
      const rows = await tx
        .select({ id: event.id, sourceUid: event.sourceUid })
        .from(event)
        .where(and(eq(event.calendarId, calendarId), inArray(event.sourceUid, parentUids)));
      parentByUid = new Map(rows.map((entry) => [entry.sourceUid as string, entry.id]));
    }

    for (const parsed of overrides) {
      await upsertEvent(
        tx,
        familyId,
        calendarId,
        parsed,
        parentByUid.get(parsed.overrideOf as string) ?? null
      );
    }

    const stale = await tx
      .delete(event)
      .where(
        and(
          eq(event.calendarId, calendarId),
          isNotNull(event.sourceUid),
          // `notInArray` with an empty list is not valid SQL, and "the feed is
          // empty" is a real state (a school between school years), so it gets
          // the predicate without the exclusion.
          keep.length > 0 ? notInArray(event.sourceUid, keep) : undefined
        )
      )
      .returning({ id: event.id });

    return { imported: events.length, removed: stale.length };
  });
}

type Executor = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

async function upsertEvent(
  tx: Executor,
  familyId: string,
  calendarId: string,
  parsed: ParsedFeedEvent,
  recurrenceParentId: string | null
): Promise<void> {
  const values = {
    familyId,
    calendarId,
    sourceUid: parsed.sourceUid,
    title: parsed.title,
    description: parsed.description,
    location: parsed.location,
    startsAt: parsed.startsAt,
    endsAt: parsed.endsAt,
    allDay: parsed.allDay,
    tz: parsed.tz,
    rrule: parsed.rrule,
    rdates: parsed.rdates,
    exdates: parsed.exdates,
    recurrenceParentId,
    recurrenceOriginalStart: parsed.recurrenceOriginalStart,
    /**
     * Left null on purpose: a feed knows nothing about this household's
     * members, and `event_type` null means "inherit the calendar's
     * `default_type`" (M23) — which is the one place a parent can say "this
     * agenda is school" once and have every one of its events say so.
     */
    updatedAt: new Date(),
  };

  await tx
    .insert(event)
    .values(values)
    .onConflictDoUpdate({
      target: [event.calendarId, event.sourceUid],
      set: {
        title: values.title,
        description: values.description,
        location: values.location,
        startsAt: values.startsAt,
        endsAt: values.endsAt,
        allDay: values.allDay,
        tz: values.tz,
        rrule: values.rrule,
        rdates: values.rdates,
        exdates: values.exdates,
        recurrenceParentId: values.recurrenceParentId,
        recurrenceOriginalStart: values.recurrenceOriginalStart,
        // A row that came back after a prune-and-reappear cycle must not stay
        // invisible; nothing else in this slice ever sets it.
        deletedAt: null,
        updatedAt: values.updatedAt,
      },
    });
}
