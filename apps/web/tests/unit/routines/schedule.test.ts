import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIME_OF_DAY,
  MAX_GRACE_DAYS,
  graceDaysOf,
  isOneOff,
  isSchedulable,
  isSimpleWeeklyRule,
  isValidDateKey,
  isValidTimeOfDay,
  oneOffDateOf,
  parseTimeOfDay,
  ruleForWeekdays,
  timeOfDayOf,
  todayKeyIn,
  weekdaysOfRule,
} from '@/modules/routines/domain/schedule';

const ZONE = 'Europe/Amsterdam';

describe('one-off schedules (M20)', () => {
  it('names the single day it is due on', () => {
    const schedule = { kind: 'once' as const, date: '2026-08-08', timeOfDay: '10:00' };
    expect(isOneOff(schedule)).toBe(true);
    expect(oneOffDateOf(schedule)).toBe('2026-08-08');
  });

  it('is not a one-off without the `once` kind, however dated', () => {
    expect(oneOffDateOf({ rrule: 'FREQ=DAILY', date: '2026-08-08' })).toBeNull();
    expect(isOneOff({ rrule: 'FREQ=DAILY' })).toBe(false);
  });

  it('rejects a date that is the right shape but not a day', () => {
    // A regex would take this; the whole point of parsing it is that
    // `fromWall` would otherwise roll it silently into March.
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('2026-8-8')).toBe(false);
    expect(isValidDateKey('zaterdag')).toBe(false);
    expect(isValidDateKey(undefined)).toBe(false);
    expect(isValidDateKey('2026-02-28')).toBe(true);
  });

  it('degrades a `once` schedule with no usable date to "not a one-off" — never a guess', () => {
    expect(oneOffDateOf({ kind: 'once' })).toBeNull();
    expect(oneOffDateOf({ kind: 'once', date: '2026-13-01' })).toBeNull();
  });

  it('reads "today" in the family zone, not in UTC', () => {
    // 23:30 UTC on 7 August is already 8 August in Amsterdam, and still
    // 7 August in New York. `toISOString().slice(0, 10)` would say the 7th to
    // both of them.
    const instant = new Date('2026-08-07T23:30:00Z');
    expect(todayKeyIn('Europe/Amsterdam', instant)).toBe('2026-08-08');
    expect(todayKeyIn('America/New_York', instant)).toBe('2026-08-07');
    expect(todayKeyIn('Pacific/Kiritimati', instant)).toBe('2026-08-08');
  });
});

describe('weekday picker ⇄ RRULE', () => {
  it('builds a weekly rule in RFC-5545 weekday order, not click order', () => {
    expect(ruleForWeekdays(['FR', 'MO', 'WE'])).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR');
  });

  it('collapses all seven days to FREQ=DAILY', () => {
    expect(ruleForWeekdays(['SU', 'SA', 'FR', 'TH', 'WE', 'TU', 'MO'])).toBe('FREQ=DAILY');
  });

  it('has no rule for an empty selection — a routine that is never due is not a routine', () => {
    expect(ruleForWeekdays([])).toBeNull();
  });

  it('round-trips a school-week selection', () => {
    const rule = ruleForWeekdays(['MO', 'TU', 'WE', 'TH', 'FR'])!;
    expect(weekdaysOfRule(rule, ZONE)).toEqual(['MO', 'TU', 'WE', 'TH', 'FR']);
  });

  it('reads FREQ=DAILY back as all seven days', () => {
    expect(weekdaysOfRule('FREQ=DAILY', ZONE)).toEqual(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);
  });

  it('returns no days for a rule it cannot classify rather than guessing', () => {
    expect(weekdaysOfRule('NONSENSE', ZONE)).toEqual([]);
  });

  it('reports which rules the simple builder can round-trip without loss', () => {
    expect(isSimpleWeeklyRule('FREQ=WEEKLY;BYDAY=MO,WE', ZONE)).toBe(true);
    expect(isSimpleWeeklyRule('FREQ=DAILY', ZONE)).toBe(true);
    // Everything the picker cannot express must say so, so a future editor
    // knows not to silently overwrite it.
    expect(isSimpleWeeklyRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO', ZONE)).toBe(false);
    expect(isSimpleWeeklyRule('FREQ=MONTHLY;BYDAY=FR;BYSETPOS=1,3', ZONE)).toBe(false);
    expect(isSimpleWeeklyRule('FREQ=WEEKLY;BYDAY=MO;COUNT=4', ZONE)).toBe(false);
  });
});

describe('time of day', () => {
  it('accepts 24h wall clock and nothing else', () => {
    expect(isValidTimeOfDay('07:30')).toBe(true);
    expect(isValidTimeOfDay('23:59')).toBe(true);
    expect(isValidTimeOfDay('24:00')).toBe(false);
    expect(isValidTimeOfDay('7:30')).toBe(false);
    expect(isValidTimeOfDay('07:60')).toBe(false);
  });

  it('parses to hour/minute', () => {
    expect(parseTimeOfDay('18:05')).toEqual({ hour: 18, minute: 5 });
    expect(parseTimeOfDay(undefined)).toBeNull();
  });

  it('falls back rather than failing when a schedule names no time', () => {
    expect(timeOfDayOf({ rrule: 'FREQ=DAILY' })).toEqual(parseTimeOfDay(DEFAULT_TIME_OF_DAY));
  });
});

describe('grace days', () => {
  it('defaults to none', () => {
    expect(graceDaysOf({ rrule: 'FREQ=DAILY' })).toBe(0);
  });

  it('clamps into range — a negative value is a typo, never a penalty', () => {
    expect(graceDaysOf({ rrule: 'FREQ=DAILY', graceDays: -3 })).toBe(0);
    expect(graceDaysOf({ rrule: 'FREQ=DAILY', graceDays: 99 })).toBe(MAX_GRACE_DAYS);
    expect(graceDaysOf({ rrule: 'FREQ=DAILY', graceDays: 2 })).toBe(2);
  });

  it('ignores a non-numeric value instead of producing NaN days', () => {
    expect(graceDaysOf({ rrule: 'FREQ=DAILY', graceDays: Number.NaN })).toBe(0);
  });
});

/**
 * `weekdaysOfRule` answers "which boxes are ticked" and returns `[]` for two
 * opposite situations: a rule the parser rejected, and a rule with no weekdays
 * in it at all. The parent's list used to collapse both into "Elke dag", which
 * is right for one and a lie about the other. `isSchedulable` is the question
 * that separates them, asked before the picker's.
 */
describe('isSchedulable', () => {
  it('is true for a rule the engine can expand', () => {
    expect(isSchedulable({ rrule: 'FREQ=DAILY' })).toBe(true);
    expect(isSchedulable({ rrule: 'FREQ=WEEKLY;BYDAY=MO,WE' })).toBe(true);
    expect(isSchedulable({ rrule: 'FREQ=MONTHLY;BYMONTHDAY=1' })).toBe(true);
  });

  it('is true for a one-off with a real date', () => {
    expect(isSchedulable({ kind: 'once', date: '2026-08-15' })).toBe(true);
  });

  it('is false for a one-off whose date is not a real day', () => {
    expect(isSchedulable({ kind: 'once', date: '2026-02-30' })).toBe(false);
    expect(isSchedulable({ kind: 'once' })).toBe(false);
  });

  it('is false for a schedule that names neither a rule nor a date', () => {
    expect(isSchedulable({})).toBe(false);
    expect(isSchedulable({ timeOfDay: '07:15', graceDays: 1 })).toBe(false);
    // The row that emptied a child's board: a `kind` the domain does not know,
    // and nothing else.
    expect(isSchedulable({ kind: 'daily' } as never)).toBe(false);
  });

  it('round-trips the builder: all seven days save and read back as all seven', () => {
    const rule = ruleForWeekdays(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']);
    expect(rule).toBe('FREQ=DAILY');
    expect(isSchedulable({ rrule: rule! })).toBe(true);
    // The builder seeds its picker from this. Anything shorter than seven here
    // is the bug where saving an "Elke dag" routine silently narrowed it.
    expect(weekdaysOfRule(rule!, ZONE)).toHaveLength(7);
  });
});
