import { describe, expect, it } from 'vitest';
// The domain module directly, like `flow.test.ts`: the slice barrel also
// exports its Server Components, and importing those into a node test drags
// next-intl's client navigation in behind them.
import { resolveTodayTheme } from '@/modules/today/domain/theme';
import { schoolHolidays, type BirthdayPerson } from '@/modules/holidays';

/**
 * D1: the theme banner replaces the NU block on the days it appears, so which
 * theme wins is not decoration — it decides what the wall's first column opens
 * with. These are the collisions the ordering exists for.
 */

const mila: BirthdayPerson[] = [{ id: 'mila', displayName: 'Mila', birthDate: '2019-12-25' }];
const nobody: BirthdayPerson[] = [];

const summer = schoolHolidays(2026).find((holiday) => holiday.slug === 'summerBreak')!;

describe('resolveTodayTheme', () => {
  it('is null on an ordinary day', () => {
    expect(resolveTodayTheme({ dayKey: '2026-09-15', isToday: true, people: nobody })).toBeNull();
  });

  it('names the special day it falls on', () => {
    const theme = resolveTodayTheme({ dayKey: '2026-12-25', isToday: true, people: nobody });
    expect(theme).toMatchObject({ source: 'special', key: 'christmasDay', nights: null });
  });

  it('names the school holiday it falls inside, with its length', () => {
    const theme = resolveTodayTheme({ dayKey: summer.from, isToday: true, people: nobody });
    expect(theme).toMatchObject({ source: 'school', key: 'summerBreak', nights: null });
    expect(theme?.days).toBeGreaterThan(28);
    expect(theme?.from).toBe(summer.from);
    expect(theme?.to).toBe(summer.to);
  });

  it('puts a birthday above the day it shares with Kerst', () => {
    const theme = resolveTodayTheme({ dayKey: '2026-12-25', isToday: true, people: mila });
    expect(theme).toMatchObject({ source: 'birthday', key: 'birthday', nights: null });
    expect(theme?.person).toEqual({ name: 'Mila', age: 7 });
  });

  it('puts a named day above the school holiday it sits inside', () => {
    // 25 December is inside the Christmas break in every school year.
    const theme = resolveTodayTheme({ dayKey: '2026-12-25', isToday: true, people: nobody });
    expect(theme?.source).toBe('special');
  });

  it('offers a countdown only when nothing is happening today', () => {
    const theme = resolveTodayTheme({ dayKey: '2026-12-02', isToday: true, people: nobody });
    expect(theme).toMatchObject({ source: 'special', key: 'sinterklaas' });
    expect(theme?.nights).toBe(3);
  });

  it('offers no countdown under a browsed date, where it would be a wrong number', () => {
    expect(resolveTodayTheme({ dayKey: '2026-12-02', isToday: false, people: nobody })).toBeNull();
    // …but the day *itself* still states what it is on a browsed date.
    expect(resolveTodayTheme({ dayKey: '2026-12-05', isToday: false, people: nobody })?.key).toBe(
      'sinterklaas'
    );
  });

  it('counts down to the nearest of the three, not to the most important', () => {
    // Two nights before the summer break starts, with a birthday five nights
    // out: the break is what happens first, and that is what a family is
    // counting.
    const soon: BirthdayPerson[] = [
      { id: 'x', displayName: 'X', birthDate: `2015-${shift(summer.from, 5).slice(5)}` },
    ];
    const theme = resolveTodayTheme({
      dayKey: shift(summer.from, -2),
      isToday: true,
      people: soon,
    });

    expect(theme).toMatchObject({ source: 'school', key: 'summerBreak', nights: 2 });
  });
});

function shift(day: string, days: number): string {
  const moved = new Date(`${day}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}
