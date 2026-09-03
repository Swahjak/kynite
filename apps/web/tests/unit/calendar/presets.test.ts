import { describe, expect, it } from 'vitest';

import {
  preservesExistingRule,
  presetFor,
  ruleForPreset,
  ruleForWeeklyDays,
  ruleForWeeklySelection,
  weeklyDaysOf,
} from '@/modules/calendar/domain/presets';

const AMSTERDAM = 'Europe/Amsterdam';

/**
 * The recurrence presets, plus the weekday-chip authoring the event dialog
 * uses for the `weekly` preset (Google-Calendar-style ma/di/wo/do/vr chips).
 */

describe('ruleForWeeklyDays', () => {
  it('writes the days in WEEKDAYS order regardless of selection order', () => {
    expect(ruleForWeeklyDays(['FR', 'MO', 'TH', 'TU'])).toBe('FREQ=WEEKLY;BYDAY=MO,TU,TH,FR');
  });

  it('writes a single day plainly', () => {
    expect(ruleForWeeklyDays(['WE'])).toBe('FREQ=WEEKLY;BYDAY=WE');
  });

  it('de-duplicates a repeated day', () => {
    expect(ruleForWeeklyDays(['MO', 'MO'])).toBe('FREQ=WEEKLY;BYDAY=MO');
  });
});

describe('weeklyDaysOf', () => {
  it('reads back a rule ruleForWeeklyDays wrote — the round trip', () => {
    const rule = ruleForWeeklyDays(['MO', 'TU', 'TH', 'FR']);
    expect(weeklyDaysOf(rule)).toEqual(['MO', 'TU', 'TH', 'FR']);
  });

  it('is case-insensitive, matching presetFor/actions.ts normalisation', () => {
    expect(weeklyDaysOf('freq=weekly;byday=mo,we')).toEqual(['MO', 'WE']);
  });

  it('returns null for a bare weekly rule (no BYDAY)', () => {
    expect(weeklyDaysOf('FREQ=WEEKLY')).toBeNull();
  });

  it('returns null for a non-weekly FREQ', () => {
    expect(weeklyDaysOf('FREQ=DAILY;BYDAY=MO')).toBeNull();
  });

  it('returns null when an INTERVAL or any other part is present', () => {
    expect(weeklyDaysOf('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO')).toBeNull();
    expect(weeklyDaysOf('FREQ=WEEKLY;BYDAY=MO;COUNT=5')).toBeNull();
  });

  it('returns null for an ordinal weekday (not a plain code)', () => {
    expect(weeklyDaysOf('FREQ=WEEKLY;BYDAY=1MO')).toBeNull();
  });

  it('returns null for a garbled or empty BYDAY', () => {
    expect(weeklyDaysOf('FREQ=WEEKLY;BYDAY=XX')).toBeNull();
    expect(weeklyDaysOf('FREQ=WEEKLY;BYDAY=')).toBeNull();
  });

  it('returns null for a duplicated day', () => {
    expect(weeklyDaysOf('FREQ=WEEKLY;BYDAY=MO,MO')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(weeklyDaysOf(null)).toBeNull();
  });
});

describe('presetFor — weekday-chip rules', () => {
  it('maps a chip-authored weekly rule back to the weekly preset', () => {
    expect(presetFor('FREQ=WEEKLY;BYDAY=MO,TU,TH,FR')).toBe('weekly');
  });

  it('still maps the full Mon–Fri rule to the fixed weekdays preset, not weekly', () => {
    // Exact-match presets are checked before the generic weekday fallback, so
    // the dedicated `weekdays` preset keeps winning this one.
    expect(presetFor('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')).toBe('weekdays');
  });

  it('still maps the bare weekly rule to weekly', () => {
    expect(presetFor('FREQ=WEEKLY')).toBe('weekly');
  });

  it('does not misclassify custody-alternating-weeks as a chip-authored weekly rule', () => {
    expect(presetFor('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO')).toBe('custody-alternating-weeks');
  });

  it('falls back to custom for a weekly rule with an ordinal BYDAY', () => {
    expect(presetFor('FREQ=WEEKLY;BYDAY=1MO')).toBe('custom');
  });

  it('never treats a weekly-chip rule as preserving the existing rule verbatim', () => {
    expect(preservesExistingRule(presetFor('FREQ=WEEKLY;BYDAY=MO,WE'))).toBe(false);
  });
});

describe('ruleForWeeklySelection', () => {
  it('writes the bare weekly rule when no selection was made', () => {
    expect(ruleForWeeklySelection(undefined, new Date('2026-03-02T07:30:00.000Z'), AMSTERDAM)).toBe(
      'FREQ=WEEKLY'
    );
    expect(ruleForWeeklySelection([], new Date('2026-03-02T07:30:00.000Z'), AMSTERDAM)).toBe(
      'FREQ=WEEKLY'
    );
  });

  it('writes the bare weekly rule for a single day matching DTSTART’s own weekday', () => {
    // Monday 2 March 2026, 08:30 Amsterdam (CET, UTC+1).
    const startsAt = new Date('2026-03-02T07:30:00.000Z');
    expect(ruleForWeeklySelection(['MO'], startsAt, AMSTERDAM)).toBe('FREQ=WEEKLY');
  });

  it('writes an explicit BYDAY for a single day that differs from DTSTART’s weekday', () => {
    const startsAt = new Date('2026-03-02T07:30:00.000Z'); // Monday in Amsterdam.
    expect(ruleForWeeklySelection(['TU'], startsAt, AMSTERDAM)).toBe('FREQ=WEEKLY;BYDAY=TU');
  });

  it('always writes an explicit BYDAY for more than one day', () => {
    const startsAt = new Date('2026-03-02T07:30:00.000Z'); // Monday in Amsterdam.
    expect(ruleForWeeklySelection(['MO', 'WE'], startsAt, AMSTERDAM)).toBe(
      'FREQ=WEEKLY;BYDAY=MO,WE'
    );
  });

  /**
   * The timezone-crossing edge: `startsAt` is stored as a UTC instant, and a
   * late-evening Amsterdam start can carry a *UTC calendar date* one day
   * behind the Amsterdam *wall* date. `2026-03-02T23:30:00.000Z` is Monday
   * 23:30 UTC — but read on an Amsterdam clock (CET, UTC+1, before the 2026
   * DST change) it is already Tuesday 00:30. If the "does the selection match
   * DTSTART's own weekday" check ever regressed to a UTC-based weekday (e.g.
   * `startsAt.getUTCDay()`) instead of `isoWeekday(toWall(startsAt, tz))`,
   * these two assertions would swap.
   */
  it('resolves DTSTART’s weekday from the Amsterdam wall clock, not the UTC calendar date', () => {
    const startsAt = new Date('2026-03-02T23:30:00.000Z'); // Tuesday 00:30 in Amsterdam.

    // Matches the wall-clock weekday (Tuesday) → stays the bare rule.
    expect(ruleForWeeklySelection(['TU'], startsAt, AMSTERDAM)).toBe('FREQ=WEEKLY');

    // Matches only the UTC calendar day (Monday), not the wall weekday →
    // must still write it out explicitly rather than treating it as the
    // unedited default.
    expect(ruleForWeeklySelection(['MO'], startsAt, AMSTERDAM)).toBe('FREQ=WEEKLY;BYDAY=MO');
  });
});

describe('ruleForPreset — unchanged for the non-weekly presets', () => {
  it('still writes the fixed presets exactly as before', () => {
    expect(ruleForPreset('daily')).toBe('FREQ=DAILY');
    expect(ruleForPreset('weekdays')).toBe('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
    expect(ruleForPreset('weekly')).toBe('FREQ=WEEKLY');
    expect(ruleForPreset('biweekly')).toBe('FREQ=WEEKLY;INTERVAL=2');
  });
});
