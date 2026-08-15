import { describe, expect, it } from 'vitest';
import {
  SCHOOL_HOLIDAY_SLUGS,
  schoolHolidayLength,
  schoolHolidayOn,
  schoolHolidays,
  upcomingSchoolHoliday,
} from '@/modules/holidays';

/**
 * D1: school holidays are the one thing in this slice that is a *table* rather
 * than arithmetic (there is no computus for a policy), so the tests are the
 * other shape too: they check the invariants a copied table can violate, and
 * the query behaviour a screen depends on — not the literal dates, which are
 * the government's and would only be restated here.
 *
 * The one thing they *do* pin is that the table runs out quietly. A missing
 * school year has to mean "no banner", never a thrown error or a wrong date,
 * because the year after the last row in the table always arrives.
 */

describe('the published table', () => {
  it('has all five breaks in every school year it covers', () => {
    // Every year in the table contributes one of each; the flattened list is
    // therefore a whole multiple of five, and every slug appears equally often.
    const all = [2026, 2027, 2028].flatMap((year) => schoolHolidays(year));
    const counts = new Map<string, number>();
    for (const holiday of all) counts.set(holiday.slug, (counts.get(holiday.slug) ?? 0) + 1);

    expect([...counts.keys()].sort()).toEqual([...SCHOOL_HOLIDAY_SLUGS].sort());
  });

  it('never starts a break after it ends', () => {
    for (const holiday of schoolHolidays(2026)) {
      expect(holiday.from <= holiday.to).toBe(true);
    }
  });

  it('never overlaps two breaks', () => {
    const sorted = [2025, 2026, 2027, 2028]
      .flatMap((year) => schoolHolidays(year))
      // A break spanning New Year is returned by both its years.
      .filter((holiday, index, list) => list.findIndex((h) => h.from === holiday.from) === index)
      .sort((left, right) => left.from.localeCompare(right.from));

    for (let index = 1; index < sorted.length; index += 1) {
      expect(sorted[index - 1].to < sorted[index].from).toBe(true);
    }
  });

  it('returns a break that crosses New Year for both of its years', () => {
    // The one starting in December 2026 ends in January 2027, so `2026` and
    // `2027` both return it — the same row, seen from either side.
    const fromTheDecemberSide = schoolHolidays(2026).find(
      (h) => h.slug === 'christmasBreak' && h.from.startsWith('2026')
    );
    const fromTheJanuarySide = schoolHolidays(2027).find(
      (h) => h.slug === 'christmasBreak' && h.from.startsWith('2026')
    );

    expect(fromTheDecemberSide).toBeDefined();
    expect(fromTheDecemberSide).toEqual(fromTheJanuarySide);
    expect(fromTheDecemberSide!.to.startsWith('2027-01')).toBe(true);
  });
});

describe('schoolHolidayOn', () => {
  it('is true on the first and the last day, inclusive', () => {
    const summer = schoolHolidays(2026).find((h) => h.slug === 'summerBreak')!;

    expect(schoolHolidayOn(summer.from)?.slug).toBe('summerBreak');
    expect(schoolHolidayOn(summer.to)?.slug).toBe('summerBreak');
  });

  it('is null the day before and the day after', () => {
    const summer = schoolHolidays(2026).find((h) => h.slug === 'summerBreak')!;

    expect(schoolHolidayOn(shift(summer.from, -1))).toBeNull();
    expect(schoolHolidayOn(shift(summer.to, 1))).toBeNull();
  });

  it('is null outside the years the table covers, rather than throwing', () => {
    expect(schoolHolidayOn('2019-07-20')).toBeNull();
    expect(schoolHolidayOn('2099-07-20')).toBeNull();
  });

  it('is null for anything that is not a date key', () => {
    expect(schoolHolidayOn('')).toBeNull();
    expect(schoolHolidayOn('20 juli')).toBeNull();
    expect(schoolHolidayOn('2026-7-1')).toBeNull();
  });
});

describe('upcomingSchoolHoliday', () => {
  it('counts nights to the first day, and never counts the first day itself', () => {
    const summer = schoolHolidays(2026).find((h) => h.slug === 'summerBreak')!;

    expect(upcomingSchoolHoliday(shift(summer.from, -3), 10)?.nights).toBe(3);
    // Day one is the holiday, which is a banner and not a countdown.
    expect(upcomingSchoolHoliday(summer.from, 10)).toBeNull();
  });

  it('stays quiet outside the window', () => {
    const summer = schoolHolidays(2026).find((h) => h.slug === 'summerBreak')!;

    expect(upcomingSchoolHoliday(shift(summer.from, -10), 10)?.nights).toBe(10);
    expect(upcomingSchoolHoliday(shift(summer.from, -11), 10)).toBeNull();
  });
});

describe('schoolHolidayLength', () => {
  it('counts both ends', () => {
    // A break from Saturday to the Sunday eight days later is nine days off,
    // which is the number the banner says out loud.
    const spring = schoolHolidays(2026).find((h) => h.slug === 'springBreak')!;
    expect(schoolHolidayLength(spring)).toBe(9);
  });
});

/** `YYYY-MM-DD` moved by whole days. Dates only, so UTC arithmetic is exact. */
function shift(day: string, days: number): string {
  const moved = new Date(`${day}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}
