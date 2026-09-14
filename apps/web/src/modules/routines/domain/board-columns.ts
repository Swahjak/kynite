/**
 * Pure column arithmetic for the family-wide "Actieve routines" page
 * (`(hub)/hub/routines`, 2026-09-14 taken-board-routines-page plan M3).
 *
 * Framework-free like every other file under `domain/`: no database, no React,
 * no `page-data` types. The three questions the page asks of a member's
 * routines all live here, so the column head, the daypart bands and the
 * "which card is open" decision can never disagree with each other or with
 * the child's own board:
 *
 * - **Which band a routine belongs to, and how full that band is.** The band
 *   is `sectionOf` — already decided upstream, and carried on the routine —
 *   so this only groups and counts. Empty bands are dropped by the caller
 *   (`visibleBands`) rather than rendered as three empty headings.
 * - **How far along the whole column is.** Steps, not routines: a column that
 *   reads "6 van 11 stappen" is counting the same units the child taps, and
 *   the percentage beside it is that fraction rounded — one computation, so
 *   the label, the bar and the celebrate treatment cannot drift apart.
 * - **Which routine opens.** The first one that is actually actionable —
 *   live (`due`/`grace`) and unfinished — falling back to the first unfinished
 *   one at all. A routine still ahead of its time never steals the expansion
 *   from the thing a child is meant to be doing right now, and a finished one
 *   never does either.
 *
 * Everything is generic over the *read subset* it needs rather than importing
 * `BoardRoutine`, for the same reason `RoutineCard` restates its props
 * structurally: the loader's richer row passes straight in, and a test can
 * hand these functions two-field literals.
 */

import { TIME_SECTIONS, type RoutineState, type TimeSection } from './occurrence';

/** The read subset of a routine these helpers count. */
export type CountableRoutine = {
  section: TimeSection;
  doneCount: number;
  total: number;
  complete: boolean;
};

/** One daypart band inside a column. */
export type ColumnBand<T extends CountableRoutine> = {
  section: TimeSection;
  routines: T[];
  doneCount: number;
  total: number;
  /** 0–1. Zero for an empty band — nothing done out of nothing is not 100%. */
  ratio: number;
};

export type ColumnProgress = {
  /** Steps done across every band of the column. */
  doneSteps: number;
  totalSteps: number;
  /** `doneSteps / totalSteps`, rounded to whole percent. 0 when empty. */
  percent: number;
  /**
   * True only once there is something to finish. A member with no routines
   * today does not wear the finished column's gold treatment — the empty
   * column edge case this guards, exactly as `columnProgress` guards it on
   * the taken board.
   */
  complete: boolean;
};

function ratioOf(total: number, done: number): number {
  return total === 0 ? 0 : done / total;
}

/** Every daypart, in day order — including the ones with nothing in them. */
export function bandsOf<T extends CountableRoutine>(routines: readonly T[]): ColumnBand<T>[] {
  return TIME_SECTIONS.map((section) => {
    const inBand = routines.filter((routine) => routine.section === section);
    const total = inBand.reduce((sum, routine) => sum + routine.total, 0);
    const doneCount = inBand.reduce((sum, routine) => sum + routine.doneCount, 0);

    return { section, routines: inBand, total, doneCount, ratio: ratioOf(total, doneCount) };
  });
}

/**
 * The bands a column actually draws: the mockup hides a daypart a member has
 * nothing in rather than showing an empty heading with a 0/0 beside it.
 */
export function visibleBands<T extends CountableRoutine>(routines: readonly T[]): ColumnBand<T>[] {
  return bandsOf(routines).filter((band) => band.routines.length > 0);
}

/** The column head's "X van Y stappen", its bar and its celebrate threshold. */
export function columnProgress(routines: readonly CountableRoutine[]): ColumnProgress {
  const totalSteps = routines.reduce((sum, routine) => sum + routine.total, 0);
  const doneSteps = routines.reduce((sum, routine) => sum + routine.doneCount, 0);

  return {
    doneSteps,
    totalSteps,
    percent: totalSteps === 0 ? 0 : Math.round((doneSteps / totalSteps) * 100),
    complete: totalSteps > 0 && doneSteps === totalSteps,
  };
}

/** The read subset of a routine the "which card is open" decision needs. */
export type OpenableRoutine = { id: string; complete: boolean; state: RoutineState };

/**
 * The one routine a column renders expanded — the first live unfinished one,
 * else the first unfinished one at all, else nothing.
 */
export function firstOpenRoutineId(routines: readonly OpenableRoutine[]): string | null {
  const live = routines.find(
    (routine) => !routine.complete && (routine.state === 'due' || routine.state === 'grace')
  );
  if (live) return live.id;

  return routines.find((routine) => !routine.complete)?.id ?? null;
}

/**
 * Stars this column has actually earned today.
 *
 * Per *step*, never per routine (the star economy's first rule, FR11–FR19 and
 * `tools/instructions.ts`): a five-step routine at three stars pays fifteen
 * for a full run and six for two steps. The pill in the column head is
 * therefore a running total of work already done, not a promise of what a
 * finished routine would pay.
 */
export function starsEarnedIn(
  routines: readonly { doneCount: number; starsPerCompletion: number }[]
): number {
  return routines.reduce((sum, routine) => sum + routine.doneCount * routine.starsPerCompletion, 0);
}
