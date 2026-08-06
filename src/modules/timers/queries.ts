import 'server-only';
import { and, desc, eq, isNull } from 'drizzle-orm';
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

/** Everything currently running in a family, oldest first (the board's order). */
export async function listRunningTimers(familyId: string): Promise<TimerWithMember[]> {
  const rows = await getDb()
    .select({
      timer,
      memberName: member.displayName,
      memberColor: member.color,
    })
    .from(timer)
    .leftJoin(member, eq(member.id, timer.memberId))
    .where(and(eq(timer.familyId, familyId), isNull(timer.stoppedAt)))
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
