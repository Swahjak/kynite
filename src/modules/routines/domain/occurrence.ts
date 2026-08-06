/**
 * Occurrence-date derivation and grace-day logic.
 *
 * The completion table keys on `occurrenceDate` — "the logical day satisfied,
 * not the wall clock of the tap" (docs/architecture.md §3). Everything that
 * makes that date the *right* date lives here, pure and testable:
 *
 *   - which days a routine is due on (its RRULE, expanded in the family zone);
 *   - which occurrence an interaction *now* satisfies, including a catch-up on
 *     an earlier day the routine allows grace for;
 *   - whether an occurrence is still ahead, live, or a grace catch-up.
 *
 * Grace is the mechanic research §Decisions 2 asks for, and its shape matters:
 * a grace day never marks anything. It only *widens the window in which a tap
 * still counts*. A routine outside its grace window produces no state at all —
 * the absence of a row, rendered dimmed (§Decisions 1), never a failure.
 */

import {
  addDays,
  fromWall,
  parseDateKey,
  toDateKey,
  toWall,
  type Wall,
} from '@/modules/calendar/domain/zone';
import { occurrencesOf, parseRule } from '@/modules/calendar/domain/rrule';
import { graceDaysOf, timeOfDayOf, type Schedule } from './schedule';

/** The board's three bands (the Stitch "chores routines" hub screen). */
export const TIME_SECTIONS = ['morning', 'afternoon', 'evening'] as const;
export type TimeSection = (typeof TIME_SECTIONS)[number];

/** Where a routine sits on the board. Boundaries are noon and 17:00 local. */
export function sectionOf(schedule: Schedule): TimeSection {
  const { hour } = timeOfDayOf(schedule);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * `('2026-03-11', '07:45')` → the instant clocks in `timeZone` read that at.
 *
 * Used to pin the board's "now" for deterministic snapshots. Null for anything
 * that is not a real calendar day, so a malformed query parameter falls back to
 * the real clock rather than rendering an invalid date.
 */
export function instantAt(
  dateKey: string,
  time: string | undefined,
  timeZone: string
): Date | null {
  const wall = parseDateKey(dateKey);
  if (!wall) return null;

  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? '');
  return fromWall(
    {
      ...wall,
      hour: match ? Number(match[1]) : 12,
      minute: match ? Number(match[2]) : 0,
      second: 0,
    },
    timeZone
  );
}

export type OccurrenceInput = {
  schedule: Schedule;
  /**
   * The instant the routine started existing (`routine.createdAt`), which is
   * the series' DTSTART. A routine is not retroactively due for the weeks
   * before a parent created it, and an `INTERVAL=2` rule needs *some* phase
   * anchor — this is the only one that is both stable and honest.
   */
  anchor: Date;
  timeZone: string;
};

/** The routine's due instant on a given calendar day, ignoring the rule. */
function dueInstantOn(input: OccurrenceInput, wall: Pick<Wall, 'year' | 'month' | 'day'>): Date {
  const { hour, minute } = timeOfDayOf(input.schedule);
  return fromWall({ ...wall, hour, minute, second: 0 }, input.timeZone);
}

/** DTSTART: the anchor's calendar day, at the routine's own time of day. */
function seriesStart(input: OccurrenceInput): Date {
  return dueInstantOn(input, toWall(input.anchor, input.timeZone));
}

/**
 * Occurrence instants in `[from, to)`, ascending. Returns `[]` — never throws —
 * for a rule the parser cannot classify: a routine with a broken schedule
 * simply does not appear, which is the neutral failure this product wants.
 */
export function occurrenceStartsBetween(input: OccurrenceInput, from: Date, to: Date): Date[] {
  const rule = parseRule(input.schedule.rrule, input.timeZone);
  if (!rule) return [];

  return occurrencesOf(rule, {
    start: seriesStart(input),
    timeZone: input.timeZone,
    from,
    to,
  });
}

/** The routine's due instant on `dateKey`, or null when it is not due that day. */
export function occurrenceStartOn(input: OccurrenceInput, dateKey: string): Date | null {
  const wall = parseDateKey(dateKey);
  if (!wall) return null;

  const dayStart = fromWall(wall, input.timeZone);
  const dayEnd = fromWall(addDays(wall, 1), input.timeZone);

  const [first] = occurrenceStartsBetween(input, dayStart, dayEnd);
  return first ?? null;
}

export function occursOn(input: OccurrenceInput, dateKey: string): boolean {
  return occurrenceStartOn(input, dateKey) !== null;
}

/** `YYYY-MM-DD` of the calendar day containing `instant` in `timeZone`. */
export function dateKeyOf(instant: Date, timeZone: string): string {
  return toDateKey(toWall(instant, timeZone));
}

export type OpenOccurrence = {
  /** The `completion.occurrenceDate` a tap right now satisfies. */
  occurrenceDate: string;
  /** When that occurrence became due. */
  startsAt: Date;
  /** 0 = today's occurrence; >0 = a catch-up this many days late. */
  daysLate: number;
};

/**
 * The occurrence a tap at `now` satisfies — today's if the routine is due
 * today, otherwise the most recent earlier one still inside its grace window.
 *
 * Null means there is nothing to complete, which is not an error state and has
 * no UI of its own: the routine is simply absent from the board.
 */
export function openOccurrence(input: OccurrenceInput, now: Date): OpenOccurrence | null {
  const today = toWall(now, input.timeZone);
  const grace = graceDaysOf(input.schedule);

  for (let daysLate = 0; daysLate <= grace; daysLate += 1) {
    const wall = addDays(today, -daysLate);
    const dateKey = toDateKey(wall);
    const startsAt = occurrenceStartOn(input, dateKey);
    if (startsAt) return { occurrenceDate: dateKey, startsAt, daysLate };
  }

  return null;
}

/**
 * Is `occurrenceDate` a day this routine may still be completed for at `now`?
 * The Server Action's guard, so a stale tab or a forged date cannot write a
 * completion against a day the routine was never due on.
 */
export function isCompletableOn(
  input: OccurrenceInput,
  occurrenceDate: string,
  now: Date
): boolean {
  if (!occursOn(input, occurrenceDate)) return false;

  const today = parseDateKey(dateKeyOf(now, input.timeZone));
  const target = parseDateKey(occurrenceDate);
  if (!today || !target) return false;

  const dayMs = 86_400_000;
  const daysLate = Math.round(
    (Date.UTC(today.year, today.month - 1, today.day) -
      Date.UTC(target.year, target.month - 1, target.day)) /
      dayMs
  );

  // Ahead of the day itself is fine — a child who gets dressed before the
  // clock says so has still got dressed. Behind it is bounded by grace.
  return daysLate <= graceDaysOf(input.schedule) && daysLate >= -1;
}

/**
 * How a routine reads on the board right now.
 *
 * `grace` is deliberately not called "missed" or "overdue": it is an occurrence
 * from an earlier day that still counts, rendered dimmed and neutral. Nothing
 * here ever returns a failure state, because there is not one.
 */
export type RoutineState = 'upcoming' | 'due' | 'grace' | 'none';

export type RoutineTiming = {
  state: RoutineState;
  occurrence: OpenOccurrence | null;
  /** Whole minutes until the occurrence starts; null once it has. */
  minutesUntil: number | null;
};

export function timingAt(input: OccurrenceInput, now: Date): RoutineTiming {
  const occurrence = openOccurrence(input, now);
  if (!occurrence) return { state: 'none', occurrence: null, minutesUntil: null };

  if (occurrence.daysLate > 0) {
    return { state: 'grace', occurrence, minutesUntil: null };
  }

  const deltaMs = occurrence.startsAt.getTime() - now.getTime();
  if (deltaMs > 0) {
    return { state: 'upcoming', occurrence, minutesUntil: Math.ceil(deltaMs / 60_000) };
  }

  return { state: 'due', occurrence, minutesUntil: null };
}
