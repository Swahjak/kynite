import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIME_OF_DAY,
  MAX_GRACE_DAYS,
  graceDaysOf,
  isSimpleWeeklyRule,
  isValidTimeOfDay,
  parseTimeOfDay,
  ruleForWeekdays,
  timeOfDayOf,
  weekdaysOfRule,
} from '@/modules/routines/domain/schedule';

const ZONE = 'Europe/Amsterdam';

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
