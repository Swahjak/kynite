/**
 * Routine schedules: the small, closed slice of RFC-5545 a routine builder can
 * author, and the round-trip between it and the weekday-picker UI.
 *
 * A routine's `schedule` column is `{ rrule, timeOfDay, graceDays }`
 * (docs/architecture.md §3). Storing an RRULE rather than a `weekdays[]` array
 * is deliberate: it is the same vocabulary M06 already expands for events, so
 * a routine that later needs "every other week" needs no migration — only a
 * richer builder. The builder itself stays a weekday picker plus a time,
 * because that is what every real morning/bedtime routine actually is.
 *
 * Pure and framework-free (architecture §2 rule 2): no database, no React, no
 * `server-only`. The only import is M06's RRULE engine, which is equally pure.
 */

import { WEEKDAYS, parseRule, type Weekday } from '@/modules/calendar/domain/rrule';
import { parseDateKey } from '@/modules/calendar/domain/zone';

/**
 * How a routine is scheduled.
 *
 * `'recurring'` is the RRULE the weekday picker authors. `'once'` is M20's
 * one-off chore — "clean the garage on Saturday, 10 stars" — which is due on a
 * single named day and then, once done or once its grace has run out, simply
 * stops appearing. An absent `kind` reads as `'recurring'`: every routine
 * written before M20 is one, and a default is cheaper than a backfill.
 */
export const SCHEDULE_KINDS = ['recurring', 'once'] as const;
export type ScheduleKind = (typeof SCHEDULE_KINDS)[number];

/** Structurally the `RoutineSchedule` of `../schema`, without importing it. */
export type Schedule = {
  /**
   * The RRULE a recurring routine repeats on. Absent for a one-off, which
   * recurs never — and absence is the safe shape: any reader that forgets the
   * one-off branch gets "no rule, therefore never due", which is this
   * product's neutral failure rather than a wrong occurrence.
   */
  rrule?: string;
  timeOfDay?: string;
  graceDays?: number;
  kind?: ScheduleKind;
  /** The single family-timezone date key (`YYYY-MM-DD`) a one-off is due on. */
  date?: string;
};

/** `HH:mm`, 24h. The wall clock the routine is due at in the family's zone. */
const TIME_OF_DAY = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** The default when a routine names no time: first thing in the morning. */
export const DEFAULT_TIME_OF_DAY = '07:30';

/**
 * Upper bound on `graceDays`. A grace miss is a kindness, not an open-ended
 * backlog: research §Decisions 2 wants bounded grace precisely so a child is
 * never looking at a week of catching up.
 */
export const MAX_GRACE_DAYS = 7;

export function isValidTimeOfDay(value: string): boolean {
  return TIME_OF_DAY.test(value);
}

/**
 * A real calendar day, not merely ten characters in the right shape.
 * `parseDateKey` rejects `2026-02-30`, which a regex would happily accept and
 * `fromWall` would silently roll forward into March.
 */
export function isValidDateKey(value: string | undefined): boolean {
  return typeof value === 'string' && parseDateKey(value) !== null;
}

/**
 * The date a one-off is due on, or null when this schedule is not one.
 *
 * A schedule that *claims* `kind: 'once'` but carries no usable date is not a
 * one-off here: it has no rrule either, so it resolves to "never due" and is
 * absent from every board. That is the intended failure — a routine nobody can
 * see is recoverable by editing it; a routine due on a date nobody can name is
 * not.
 */
export function oneOffDateOf(schedule: Schedule): string | null {
  if (schedule.kind !== 'once') return null;
  return isValidDateKey(schedule.date) ? schedule.date! : null;
}

export function isOneOff(schedule: Schedule): boolean {
  return oneOffDateOf(schedule) !== null;
}

/** `'2026-08-08'` in `timeZone` — never `toISOString().slice(0, 10)`, which is UTC. */
export function todayKeyIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

/** `'07:30'` → `{ hour: 7, minute: 30 }`. Null for anything else. */
export function parseTimeOfDay(value: string | undefined): { hour: number; minute: number } | null {
  const match = TIME_OF_DAY.exec(value ?? '');
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/** The time a schedule is due at, falling back rather than failing. */
export function timeOfDayOf(schedule: Schedule): { hour: number; minute: number } {
  return parseTimeOfDay(schedule.timeOfDay) ?? parseTimeOfDay(DEFAULT_TIME_OF_DAY)!;
}

/** Clamped into `[0, MAX_GRACE_DAYS]`; a negative value is not a penalty, it is a typo. */
export function graceDaysOf(schedule: Schedule): number {
  const raw = schedule.graceDays;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  return Math.min(MAX_GRACE_DAYS, Math.max(0, Math.trunc(raw)));
}

/**
 * The weekday picker's selection → an RRULE.
 *
 * Seven days collapses to `FREQ=DAILY`, which is both shorter and what a human
 * reading the row expects. An empty selection has no rule: the caller rejects
 * it rather than storing a routine that is never due.
 */
export function ruleForWeekdays(days: readonly Weekday[]): string | null {
  const selected = WEEKDAYS.filter((day) => days.includes(day));
  if (selected.length === 0) return null;
  if (selected.length === WEEKDAYS.length) return 'FREQ=DAILY';
  return `FREQ=WEEKLY;BYDAY=${selected.join(',')}`;
}

/**
 * An RRULE → the weekdays the picker should show ticked.
 *
 * A rule the builder did not author (an imported or hand-written one) still
 * answers this question honestly: `FREQ=DAILY` is all seven, a weekly rule is
 * its `BYDAY`, and anything else reports the days it actually contains as far
 * as the parser understands them — never a guess.
 */
export function weekdaysOfRule(rrule: string | undefined, timeZone: string): Weekday[] {
  const rule = parseRule(rrule ?? '', timeZone);
  if (!rule) return [];

  if (rule.byDay.length > 0) {
    const named = new Set(rule.byDay.map(({ weekday }) => weekday));
    return WEEKDAYS.filter((day) => named.has(day));
  }

  return rule.freq === 'DAILY' ? [...WEEKDAYS] : [];
}

/** True for a rule this builder can round-trip without losing information. */
export function isSimpleWeeklyRule(rrule: string | undefined, timeZone: string): boolean {
  const rule = parseRule(rrule ?? '', timeZone);
  if (!rule) return false;

  return (
    rule.unsupported.length === 0 &&
    rule.interval === 1 &&
    rule.count === null &&
    rule.until === null &&
    rule.byMonthDay.length === 0 &&
    rule.byMonth.length === 0 &&
    rule.bySetPos.length === 0 &&
    (rule.freq === 'DAILY' || rule.freq === 'WEEKLY') &&
    rule.byDay.every(({ ordinal }) => ordinal === null)
  );
}

export { WEEKDAYS, type Weekday };
