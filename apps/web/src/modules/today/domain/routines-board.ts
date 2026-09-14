/**
 * Pure domain logic for the family-wide "Taken & routines" board
 * (`(hub)/hub/taken`, M-R2).
 *
 * Framework-free (architecture §2 rule 2), like every other file under
 * `domain/`: no database, no React. Three questions live here, independent of
 * how the data was fetched:
 *
 * - **Which daypart tab is selected by default** — the wall clock's hour,
 *   bucketed 00–12 / 12–18 / 18–24. This is a *display* default a viewer can
 *   override locally (the board keeps the override in local state, never
 *   writes it anywhere), and it is deliberately a **different** boundary than
 *   `sectionOf` (`modules/routines/domain/occurrence.ts`, noon/17:00), which
 *   decides which band a *routine itself* belongs in. The two answer
 *   different questions — "what does the clock on the wall suggest a viewer
 *   wants to see right now" vs. "when is this routine due" — and conflating
 *   them would make a routine due at 17:30 (`sectionOf` → evening) vanish from
 *   an "afternoon" tab a viewer explicitly selected at 17:15.
 * - **Which of a household's tasks have no owner yet** — the pool column's
 *   membership, and the per-member buckets beside it. One partition, so the
 *   pool and every column read the same list exactly once.
 * - **A column's progress** — how much of what it currently shows is done,
 *   and whether that is 100%. Shared by every member column and the pool so
 *   "3 van 5" and the celebration threshold can never disagree between one
 *   column and the next.
 *
 *   Generic on purpose: the 2026-09-14 taken-board-routines-page plan (M1+M2)
 *   calls this on two different lists that must never be confused — a
 *   column's *header* (count label, bar, celebrate treatment) counts that
 *   member's **tasks only**, while the collapsed routine progress card at
 *   the top of the column calls it again on that member's routine steps for
 *   the daypart to get its own "X van Y stappen". Neither call site may feed
 *   it the other's list.
 */

import type { TimeSection } from '@/modules/routines';

export type { TimeSection };

/** Wall-clock hour (0–23) → the daypart tab selected by default. */
export function daypartFromHour(hour: number): TimeSection {
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export type ColumnItem = { done: boolean };

export type ColumnProgress = {
  doneCount: number;
  total: number;
  /** 0 when `total` is 0 — an empty column is not 100% of nothing. */
  percent: number;
  /**
   * True only once there is something to finish. A member with nothing on
   * their plate today does not wear the same "Klaar" badge as one who
   * finished five things — the empty-column edge case this guards.
   */
  celebrate: boolean;
};

/**
 * A column's progress from its currently-visible items — the selected
 * daypart's routine steps, concatenated with its (always-visible) tasks.
 */
export function columnProgress(items: readonly ColumnItem[]): ColumnProgress {
  const total = items.length;
  const doneCount = items.filter((item) => item.done).length;
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  return { doneCount, total, percent, celebrate: total > 0 && doneCount === total };
}

/**
 * Split a family's tasks into the pool (nobody's yet) and one bucket per
 * assignee — the one partition both the pool column and every member column
 * read from, so a task can never be drawn twice or dropped between the two.
 */
export function partitionTasksByAssignee<T extends { assigneeMemberId: string | null }>(
  tasks: readonly T[]
): { pool: T[]; byMember: Map<string, T[]> } {
  const pool: T[] = [];
  const byMember = new Map<string, T[]>();

  for (const item of tasks) {
    if (item.assigneeMemberId === null) {
      pool.push(item);
      continue;
    }

    const bucket = byMember.get(item.assigneeMemberId);
    if (bucket) bucket.push(item);
    else byMember.set(item.assigneeMemberId, [item]);
  }

  return { pool, byMember };
}

/**
 * A viewer's manual accordion choice on the "Actieve routines" page, pinned to
 * the server state it was made against.
 *
 * `against` is the `activeRoutineId` the column was showing when the tap
 * happened; `openId` is what the viewer opened, or `null` for "they closed the
 * open card". Storing the pair is what lets the override *yield*: without it a
 * single tap would park a column on one card forever, and once that routine
 * finished the column would sit on a done card while the live one stayed
 * collapsed — the opposite of what an open card is there to say.
 */
export type OpenOverride = { against: string | null; openId: string | null };

/** The read subset of a routine the accordion decision needs. */
export type OpenableItem = { id: string; complete: boolean };

/**
 * Which card a column actually opens: the server's choice, unless a viewer has
 * overridden it *and* that override is still about today's state.
 *
 * The override is dropped when either half of it goes stale — the server has
 * moved on to a different live routine, or the routine it names has since been
 * finished (or has left the board). In both cases the column reopens whatever
 * the loader's `firstOpenRoutineId` now points at, exactly as a fresh load
 * would, which is also how `/hub/routines/[memberId]` behaves.
 */
export function resolveOpenRoutineId(
  routines: readonly OpenableItem[],
  activeRoutineId: string | null,
  override: OpenOverride | undefined
): string | null {
  if (!override) return activeRoutineId;
  // The day moved under the viewer's choice: their tap was about a board that
  // no longer exists, so it stops speaking for this column.
  if (override.against !== activeRoutineId) return activeRoutineId;
  if (override.openId === null) return null;

  const target = routines.find((routine) => routine.id === override.openId);
  return target && !target.complete ? override.openId : activeRoutineId;
}
