import { describe, expect, it } from 'vitest';
import {
  CONFETTI_SLUGS,
  COUNTDOWN_NIGHTS,
  COUNTDOWN_SLUGS,
  SPECIAL_DAYS_NL,
  SPECIAL_DAY_SLUGS,
  easterSunday,
  specialDays,
  specialDaysOn,
  upcomingCountdown,
} from '@/modules/holidays';

/**
 * M26: "speciale dagen" are arithmetic, not data — which is only a good trade
 * if the arithmetic is right. The cases below are the ones that have historically
 * been got wrong: the computus, the Koningsdag Sunday shift (which moves the day
 * *back*, not forward), the nth-Sunday days, and the year boundary the countdown
 * has to cross every December.
 */

/** The one date every other Easter-derived day hangs off. */
const dateOf = (year: number, slug: string) => {
  const day = specialDays(year).find((candidate) => candidate.slug === slug);
  return day?.date ?? null;
};

describe('easterSunday (Anonymous Gregorian computus)', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    // A very early and a very late Easter, so the month rollover is exercised
    // in both directions rather than only in April.
    [2027, '2027-03-28'],
    [2038, '2038-04-25'],
  ])('puts Easter %i on %s', (year, expected) => {
    expect(easterSunday(year)).toBe(expected);
  });
});

describe('the days that hang off Easter', () => {
  it('places Goede Vrijdag two days before and Tweede Paasdag one day after', () => {
    expect(dateOf(2026, 'goodFriday')).toBe('2026-04-03');
    expect(dateOf(2026, 'easterSunday')).toBe('2026-04-05');
    expect(dateOf(2026, 'easterMonday')).toBe('2026-04-06');
  });

  it('places Hemelvaart at +39 and Pinksteren at +49/+50', () => {
    // Easter 2026 is 5 April: Hemelvaart 14 May, Pinksteren 24/25 May.
    expect(dateOf(2026, 'ascension')).toBe('2026-05-14');
    expect(dateOf(2026, 'whitSunday')).toBe('2026-05-24');
    expect(dateOf(2026, 'whitMonday')).toBe('2026-05-25');
  });

  it('keeps Hemelvaart on a Thursday and Pinksteren on a Sunday, every year for a century', () => {
    for (let year = 2000; year < 2100; year += 1) {
      const ascension = dateOf(year, 'ascension');
      const whitSunday = dateOf(year, 'whitSunday');

      expect(new Date(`${ascension}T00:00:00Z`).getUTCDay()).toBe(4);
      expect(new Date(`${whitSunday}T00:00:00Z`).getUTCDay()).toBe(0);
    }
  });
});

describe('Koningsdag', () => {
  it('falls on 27 April in an ordinary year', () => {
    // 27 April 2026 is a Monday.
    expect(dateOf(2026, 'kingsDay')).toBe('2026-04-27');
  });

  it.each([2025, 2031, 2036])('moves *back* to the 26th when the 27th is a Sunday (%i)', (year) => {
    expect(new Date(`${year}-04-27T00:00:00Z`).getUTCDay()).toBe(0);
    expect(dateOf(year, 'kingsDay')).toBe(`${year}-04-26`);
  });
});

describe('Moederdag and Vaderdag', () => {
  it('puts Moederdag on the second Sunday of May', () => {
    // 2026: 1 May is a Friday, so the Sundays are the 3rd, 10th, 17th…
    expect(dateOf(2026, 'mothersDay')).toBe('2026-05-10');
    expect(dateOf(2027, 'mothersDay')).toBe('2027-05-09');
  });

  it('puts Vaderdag on the third Sunday of June', () => {
    expect(dateOf(2026, 'fathersDay')).toBe('2026-06-21');
    expect(dateOf(2027, 'fathersDay')).toBe('2027-06-20');
  });

  it('handles a month that opens on a Sunday (the 1st is itself the first Sunday)', () => {
    // 1 June 2025 is a Sunday: the third Sunday is the 15th, not the 22nd.
    expect(new Date('2025-06-01T00:00:00Z').getUTCDay()).toBe(0);
    expect(dateOf(2025, 'fathersDay')).toBe('2025-06-15');
  });

  it('lands on a Sunday every year for a century', () => {
    for (let year = 2000; year < 2100; year += 1) {
      for (const slug of ['mothersDay', 'fathersDay']) {
        expect(new Date(`${dateOf(year, slug)}T00:00:00Z`).getUTCDay()).toBe(0);
      }
    }
  });
});

describe('the fixed days', () => {
  it.each([
    ['newYear', '2026-01-01'],
    ['liberationDay', '2026-05-05'],
    ['animalDay', '2026-10-04'],
    ['halloween', '2026-10-31'],
    ['sinterklaas', '2026-12-05'],
    ['christmasDay', '2026-12-25'],
    ['boxingDay', '2026-12-26'],
    ['newYearsEve', '2026-12-31'],
  ])('puts %s on %s', (slug, expected) => {
    expect(dateOf(2026, slug)).toBe(expected);
  });
});

describe('specialDays', () => {
  it('returns every slug exactly once, in calendar order', () => {
    const days = specialDays(2026);

    expect(days.map((day) => day.slug).sort()).toEqual([...SPECIAL_DAY_SLUGS].sort());
    expect(days.map((day) => day.date)).toEqual([...days.map((day) => day.date)].sort());
  });

  it('keeps every date inside its own year', () => {
    for (const day of specialDays(2031)) expect(day.date.startsWith('2031-')).toBe(true);
  });

  it('carries an emoji and an accent for every day (the visual half is the feature)', () => {
    for (const day of SPECIAL_DAYS_NL) {
      expect(day.emoji.length).toBeGreaterThan(0);
      expect(day.accent.length).toBeGreaterThan(0);
    }
  });
});

describe('specialDaysOn', () => {
  it('finds the day on its date', () => {
    expect(specialDaysOn('2026-12-05').map((day) => day.slug)).toEqual(['sinterklaas']);
    expect(specialDaysOn('2026-04-27').map((day) => day.slug)).toEqual(['kingsDay']);
  });

  it('is empty on an ordinary day', () => {
    expect(specialDaysOn('2026-03-17')).toEqual([]);
  });

  it('returns both when two days collide (Pinksteren on Moederdag, 2035)', () => {
    const slugs = specialDaysOn('2035-05-13').map((day) => day.slug);

    expect(slugs).toContain('whitSunday');
    expect(slugs).toContain('mothersDay');
  });

  it('rejects anything that is not a date key rather than guessing', () => {
    expect(specialDaysOn('2026-12-5')).toEqual([]);
    expect(specialDaysOn('tomorrow')).toEqual([]);
    expect(specialDaysOn('')).toEqual([]);
  });
});

describe('upcomingCountdown', () => {
  it('counts nights to Pakjesavond inside the window', () => {
    expect(upcomingCountdown('2026-11-25')).toMatchObject({ slug: 'sinterklaas', nights: 10 });
    expect(upcomingCountdown('2026-12-04')).toMatchObject({ slug: 'sinterklaas', nights: 1 });
  });

  it('counts nights to Eerste Kerstdag inside the window', () => {
    expect(upcomingCountdown('2026-12-15')).toMatchObject({ slug: 'christmasDay', nights: 10 });
    expect(upcomingCountdown('2026-12-24')).toMatchObject({ slug: 'christmasDay', nights: 1 });
  });

  it('is silent on the day itself — that day gets confetti, not a number', () => {
    expect(upcomingCountdown('2026-12-05')).toBeNull();
    expect(upcomingCountdown('2026-12-25')).toBeNull();
  });

  it(`is silent more than ${COUNTDOWN_NIGHTS} nights out`, () => {
    expect(upcomingCountdown('2026-11-24')).toBeNull();
    expect(upcomingCountdown('2026-12-14')).toBeNull();
    expect(upcomingCountdown('2026-06-01')).toBeNull();
  });

  it('crosses the year boundary: late December counts to *next* December', () => {
    // Nothing is within ten nights of 31 December, and the next Sinterklaas is
    // eleven months away — so the honest answer is nothing at all rather than
    // a number that fell off the end of the year's list.
    expect(upcomingCountdown('2026-12-31')).toBeNull();
    expect(upcomingCountdown('2026-12-26')).toBeNull();
  });

  it('never counts to anything outside the countdown list', () => {
    for (let offset = 0; offset < 366; offset += 1) {
      const day = new Date(Date.UTC(2026, 0, 1) + offset * 86_400_000).toISOString().slice(0, 10);
      const countdown = upcomingCountdown(day);
      if (!countdown) continue;

      expect(COUNTDOWN_SLUGS).toContain(countdown.slug);
      expect(countdown.nights).toBeGreaterThanOrEqual(1);
      expect(countdown.nights).toBeLessThanOrEqual(COUNTDOWN_NIGHTS);
    }
  });

  it('rejects a malformed date key', () => {
    expect(upcomingCountdown('not-a-date')).toBeNull();
  });
});

describe('the celebration lists', () => {
  it('names only slugs that exist', () => {
    for (const slug of [...COUNTDOWN_SLUGS, ...CONFETTI_SLUGS]) {
      expect(SPECIAL_DAY_SLUGS).toContain(slug);
    }
  });

  it('keeps the two countdown windows from overlapping', () => {
    // Both targets are in December; if they were ever within `COUNTDOWN_NIGHTS`
    // of each other, `upcomingCountdown` would have to return a list.
    const sinterklaas = dateOf(2026, 'sinterklaas');
    const christmas = dateOf(2026, 'christmasDay');
    const gap =
      (Date.parse(`${christmas}T00:00:00Z`) - Date.parse(`${sinterklaas}T00:00:00Z`)) / 86_400_000;

    expect(gap).toBeGreaterThan(COUNTDOWN_NIGHTS);
  });
});
