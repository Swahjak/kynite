import 'server-only';
import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm';
import { getDb } from '@/server/db';
// The schema assembly point, not a slice barrel: `queries.ts` is not a
// `schema.ts`, so the cross-slice deep import exemption does not apply to it.
import { member } from '@/server/db/schema';
import { timer, type Timer } from './schema';

/**
 * Reads for the timers slice. `server-only`, like every other slice's
 * `queries.ts` — a client component that imported this would ship the database
 * client to the browser.
 *
 * Every read is family-scoped by `where`, never by the caller remembering to
 * filter afterwards.
 */

export type TimerWithMember = Timer & {
  memberName: string | null;
  memberColor: string | null;
};

/**
 * How far back `listRunningTimers` looks (M09 review carry-forward: the
 * predicate was `stoppedAt IS NULL` and nothing else, so a timer nobody ever
 * stopped stayed on the board forever and the query was unbounded in the one
 * place a wall display reads it every few seconds).
 *
 * A day is the honest bound: a timer is a "shoes on in five minutes" object,
 * and one that started more than 24 hours ago is not running, it is abandoned.
 * It is still *in* the table — nothing is deleted here — it simply stops being
 * something the board has to render or the query has to scan.
 */
export const RUNNING_TIMER_WINDOW_MS = 86_400_000;

/** Everything currently running in a family, oldest first (the board's order). */
export async function listRunningTimers(
  familyId: string,
  now: Date = new Date()
): Promise<TimerWithMember[]> {
  const since = new Date(now.getTime() - RUNNING_TIMER_WINDOW_MS);

  const rows = await getDb()
    .select({
      timer,
      memberName: member.displayName,
      memberColor: member.color,
    })
    .from(timer)
    .leftJoin(member, eq(member.id, timer.memberId))
    .where(
      and(
        eq(timer.familyId, familyId),
        isNull(timer.stoppedAt),
        // Bounded, and index-friendly: `timer_family_started_idx` is
        // `(family_id, started_at)`, so this is a range scan rather than a
        // full partition read.
        gte(timer.startedAt, since)
      )
    )
    .orderBy(timer.startedAt);

  return rows.map((row) => ({
    ...row.timer,
    memberName: row.memberName ?? null,
    memberColor: row.memberColor ?? null,
  }));
}

/** The Controller's short history strip: what ran recently, running or not. */
export async function listRecentTimers(familyId: string, limit = 10): Promise<TimerWithMember[]> {
  const rows = await getDb()
    .select({
      timer,
      memberName: member.displayName,
      memberColor: member.color,
    })
    .from(timer)
    .leftJoin(member, eq(member.id, timer.memberId))
    .where(eq(timer.familyId, familyId))
    .orderBy(desc(timer.startedAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row.timer,
    memberName: row.memberName ?? null,
    memberColor: row.memberColor ?? null,
  }));
}

/** One timer, family-scoped. Null for another family's id — never a leak. */
export async function getTimer(familyId: string, timerId: string): Promise<Timer | null> {
  const [row] = await getDb()
    .select()
    .from(timer)
    .where(and(eq(timer.id, timerId), eq(timer.familyId, familyId)))
    .limit(1);

  return row ?? null;
}

/**
 * The nightly trim (§8's `maintenance:trim`), in two passes.
 *
 * **Delete.** Only *finished* timers: a row still running is never deleted
 * regardless of age, because deleting it would take a countdown off the wall
 * mid-morning. Rows are removed by `startedAt`, matching
 * `timer_family_started_idx`, and `stoppedAt IS NOT NULL` is the whole safety
 * argument, so it is a predicate rather than a comment.
 *
 * **Stop.** A timer nobody ever stopped leaves `stoppedAt` null forever, and
 * `RUNNING_TIMER_WINDOW_MS` already hides it from the board after a day. Left
 * alone it is not harmless: `timer_running_step_unique` is a partial unique on
 * the running rows, so an invisible abandoned row *permanently blocks its own
 * routine step* from ever being timed again — a step whose start silently
 * "replays" instead of starting. So the trim stamps the honest end time
 * (`startedAt + durationSeconds`, when it would have finished) on every running
 * row already outside the board window. Nothing is deleted by this pass; it
 * converts an abandoned timer into a finished one, which is what it is.
 *
 * The delete runs *first* on purpose: a row still running when this job started
 * is never deleted by the same run that stops it. It becomes deletable
 * tomorrow, once it has been a finished timer for a night.
 */
export async function trimFinishedTimers(before: Date, now: Date = new Date()): Promise<number> {
  const db = getDb();

  // `rowCount`, not `.returning({ id })` — the caller wants a count, and the
  // ids of deleted rows are bytes fetched only to be counted.
  const deleted = await db
    .delete(timer)
    .where(and(lt(timer.startedAt, before), sql`${timer.stoppedAt} is not null`));

  await db
    .update(timer)
    .set({
      // The time it *would* have ended, not "now": a countdown that ran out
      // three weeks ago did not end tonight, and the history strip should not
      // claim it did.
      stoppedAt: sql`${timer.startedAt} + (${timer.durationSeconds} * interval '1 second')`,
      updatedAt: now,
    })
    .where(
      and(
        isNull(timer.stoppedAt),
        lt(timer.startedAt, new Date(now.getTime() - RUNNING_TIMER_WINDOW_MS))
      )
    );

  return deleted.rowCount ?? 0;
}
