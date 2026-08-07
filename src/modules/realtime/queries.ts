import 'server-only';
import { and, asc, eq, gt, lt, sql } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { MAX_REPLAY_ROWS, RETENTION_DAYS } from './domain/cursor';
import { eventLog, type RealtimeEvent } from './schema';

/**
 * Reads of the realtime log (docs/architecture.md §4 "Catch-up").
 *
 * Every query here is scoped by `familyId` from the *principal*, never from
 * anything a client sent: the SSE route resolves the principal first and this
 * module is only ever handed that value. There is no "all families" read, and
 * no query takes a family id from a query string.
 */

/** The log head — the cursor a fresh client starts from. `null` on an empty log. */
export async function latestEventId(familyId: string): Promise<bigint | null> {
  const [row] = await getDb()
    .select({ id: sql<string>`max(${eventLog.id})` })
    .from(eventLog)
    .where(eq(eventLog.familyId, familyId));

  return row?.id == null ? null : BigInt(row.id);
}

/** The smallest id still stored — what the nightly retention trim left behind. */
export async function oldestRetainedEventId(familyId: string): Promise<bigint | null> {
  const [row] = await getDb()
    .select({ id: sql<string>`min(${eventLog.id})` })
    .from(eventLog)
    .where(eq(eventLog.familyId, familyId));

  return row?.id == null ? null : BigInt(row.id);
}

/**
 * How many rows sit after the cursor, counted to at most `MAX_REPLAY_ROWS + 1`.
 *
 * Bounded deliberately: the answer is only ever compared against the replay
 * ceiling, so counting a million rows to learn "more than 500" would be work
 * done to throw away. The subquery's `limit` is what keeps it an index scan of
 * at most 501 rows on `(family_id, id)`.
 */
export async function countEventsAfter(familyId: string, cursor: bigint): Promise<number> {
  const bounded = getDb()
    .select({ id: eventLog.id })
    .from(eventLog)
    .where(and(eq(eventLog.familyId, familyId), gt(eventLog.id, cursor)))
    .orderBy(asc(eventLog.id))
    .limit(MAX_REPLAY_ROWS + 1)
    .as('bounded');

  const [row] = await getDb()
    .select({ count: sql<string>`count(*)` })
    .from(bounded);

  return Number(row?.count ?? 0);
}

/**
 * The replay itself: `id > cursor`, in order, capped.
 *
 * §4's predicate exactly — `SELECT * FROM event_log WHERE family_id=$1 AND
 * id > $2 ORDER BY id`. The stored `payload` already *is* the event the client
 * gets, so nothing is reconstructed on the way out; the `id` is re-stamped from
 * the column rather than trusted from the JSON, which is what makes an event
 * written before its own id was known (see `publish()`) replay correctly.
 */
export async function replayEvents(
  familyId: string,
  cursor: bigint,
  limit: number = MAX_REPLAY_ROWS
): Promise<RealtimeEvent[]> {
  const rows = await getDb()
    .select({ id: eventLog.id, payload: eventLog.payload })
    .from(eventLog)
    .where(and(eq(eventLog.familyId, familyId), gt(eventLog.id, cursor)))
    .orderBy(asc(eventLog.id))
    .limit(limit);

  return rows.map((row) => ({ ...row.payload, id: String(row.id) }));
}

/**
 * One event by id, family-scoped — the resolution step for an oversized
 * NOTIFY that travelled as `{ref}` instead of inline (`publish.ts`).
 *
 * The `familyId` predicate is not belt-and-braces: the id arrives from a
 * channel this family is listening on, but the row is still fetched under the
 * principal's scope so a bug in channel naming can never become a cross-family
 * read.
 */
export async function getEvent(familyId: string, id: bigint): Promise<RealtimeEvent | null> {
  const [row] = await getDb()
    .select({ id: eventLog.id, payload: eventLog.payload })
    .from(eventLog)
    .where(and(eq(eventLog.familyId, familyId), eq(eventLog.id, id)))
    .limit(1);

  return row ? { ...row.payload, id: String(row.id) } : null;
}

/**
 * The nightly retention trim (§4: "Retention is 7 days, trimmed by a nightly
 * job"; §8's `maintenance:trim`).
 *
 * Install-wide, not family-scoped — it is a job body with no principal, and
 * the one read in this module that deliberately crosses families. Deleting by
 * `created_at` uses `event_log_created_at_idx`, which exists for exactly this
 * predicate.
 *
 * Trimming is what makes `decideReplay`'s `resync` branch reachable: a client
 * that was away longer than retention finds its cursor below
 * `oldestRetainedEventId` and is told to refetch instead of being replayed a
 * gap that no longer exists.
 */
export async function trimEventLog(before: Date): Promise<number> {
  // `rowCount` rather than `.returning({ id })`: the caller wants a count, and
  // returning a column would ship every deleted id back over the wire — a
  // fortnight of a busy household's events — to be thrown away after `.length`.
  const result = await getDb().delete(eventLog).where(lt(eventLog.createdAt, before));

  return result.rowCount ?? 0;
}

/** `now` minus the retention window — the cutoff `trimEventLog` takes. */
export function retentionCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - RETENTION_DAYS * 86_400_000);
}
