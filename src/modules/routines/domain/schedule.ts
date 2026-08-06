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

/** Structurally the `RoutineSchedule` of `../schema`, without importing it. */
export type Schedule = {
  rrule: string;
  timeOfDay?: string;
  graceDays?: number;
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
export function weekdaysOfRule(rrule: string, timeZone: string): Weekday[] {
  const rule = parseRule(rrule, timeZone);
  if (!rule) return [];

  if (rule.byDay.length > 0) {
    const named = new Set(rule.byDay.map(({ weekday }) => weekday));
    return WEEKDAYS.filter((day) => named.has(day));
  }

  return rule.freq === 'DAILY' ? [...WEEKDAYS] : [];
}

/** True for a rule this builder can round-trip without losing information. */
export function isSimpleWeeklyRule(rrule: string, timeZone: string): boolean {
  const rule = parseRule(rrule, timeZone);
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
