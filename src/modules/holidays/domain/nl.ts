/**
 * The Dutch list of special days — **the one file a second country would be
 * copied from.**
 *
 * Everything here is a function of the year. Nothing is stored, synced or
 * fetched: a special day is arithmetic (four fixed dates, seven hanging off
 * Easter, two nth-Sundays), so putting rows in the database for it would buy a
 * migration, a sync problem and a staleness bug in exchange for the screenful
 * of code below.
 *
 * Pure and framework-free (architecture §2 rule 2): no instants, no zone, no
 * i18n. A special day is a **date**, not an instant — 25 December is the 25th
 * in Amsterdam and in Auckland — so this file speaks only `YYYY-MM-DD`. Turning
 * those into all-day calendar instances is the calendar slice's job
 * (`modules/calendar/domain/holidays.ts`), and naming them is the UI's
 * (`messages/*.json`, `holidays.days.<slug>`).
 *
 * ## Why there is no country abstraction
 *
 * The product ships in one country. A registry keyed by ISO code, a resolver
 * and a household setting would all be carried from today until the day a
 * second country actually arrives — and that day the change is: add
 * `domain/be.ts` beside this file, and give `specialDays()` a parameter. The
 * seam is the file boundary, which costs nothing to leave open; the
 * abstraction is not built until something needs it.
 */

/**
 * Every day this product knows about, in calendar order within a year.
 *
 * Each is a message key: `holidays.days.<slug>` in `messages/nl.json` and
 * `messages/en.json`. `tests/unit/i18n/message-parity.test.ts` keeps the two
 * files in step; the type here keeps the code in step with them.
 */
export const SPECIAL_DAY_SLUGS = [
  'newYear',
  'goodFriday',
  'easterSunday',
  'easterMonday',
  'kingsDay',
  'liberationDay',
  'mothersDay',
  'ascension',
  'whitSunday',
  'whitMonday',
  'fathersDay',
  'animalDay',
  'halloween',
  'sinterklaas',
  'christmasDay',
  'boxingDay',
  'newYearsEve',
] as const;

export type SpecialDaySlug = (typeof SPECIAL_DAY_SLUGS)[number];

/**
 * Official (a public holiday: shops shut, school shut) versus fun (a day a
 * family celebrates and the country works through).
 *
 * The distinction is the product's, not the state's: Sinterklaas is the
 * biggest day of a Dutch child's year and is not a public holiday, and the
 * screen has to be able to say which kind of day it is looking at without
 * implying anybody gets the day off.
 */
export type SpecialDayKind = 'official' | 'fun';

/**
 * The design system's eight category hues, by name.
 *
 * Deliberately a local union rather than an import of the calendar slice's
 * `EventCategory`: this module is pure and owns no database enum. The two are
 * structurally identical, so `CATEGORY_CLASSES[day.accent]` type-checks at the
 * UI seam — and the day the two lists diverge, that seam is where it is caught.
 */
export type SpecialDayAccent =
  'blue' | 'purple' | 'orange' | 'green' | 'red' | 'yellow' | 'pink' | 'teal';

/**
 * A day, before it is placed in a year.
 *
 * `emoji` rather than an icon name on purpose: the icon font is a 64KB subset
 * (`scripts/subset-icons.mjs`) with about a kilobyte of headroom, and a
 * seventeen-glyph festive set would not fit — nor would `beach_access` ever
 * have read as Sinterklaas. An emoji needs no asset, and it is the one
 * typographic register that is *already* celebratory.
 */
export type SpecialDayDefinition = {
  slug: SpecialDaySlug;
  kind: SpecialDayKind;
  emoji: string;
  accent: SpecialDayAccent;
  /** Where it falls in a given Gregorian year, as `YYYY-MM-DD`. */
  on: (year: number) => string;
};

/** A definition placed in a year: the same facts, plus the date it lands on. */
export type SpecialDay = Omit<SpecialDayDefinition, 'on'> & { date: string };

/**
 * The list. One entry per day, in calendar order within an ordinary year.
 *
 * Order matters in exactly one place: two days can land on the same date (Whit
 * Sunday and Moederdag are both Sundays in the same fortnight, and collide in
 * years with a very early Easter — 2035 is the next), and `specialDaysOn`
 * returns them in this order rather than picking a winner.
 */
export const SPECIAL_DAYS_NL: readonly SpecialDayDefinition[] = [
  { slug: 'newYear', kind: 'official', emoji: '🎆', accent: 'purple', on: (y) => date(y, 1, 1) },
  {
    slug: 'goodFriday',
    kind: 'official',
    emoji: '🕯️',
    accent: 'teal',
    on: (y) => shift(easterSunday(y), -2),
  },
  {
    slug: 'easterSunday',
    kind: 'official',
    emoji: '🐣',
    accent: 'yellow',
    on: (y) => easterSunday(y),
  },
  {
    slug: 'easterMonday',
    kind: 'official',
    emoji: '🐣',
    accent: 'yellow',
    on: (y) => shift(easterSunday(y), 1),
  },
  { slug: 'kingsDay', kind: 'official', emoji: '👑', accent: 'orange', on: kingsDay },
  {
    slug: 'liberationDay',
    kind: 'official',
    emoji: '🕊️',
    accent: 'blue',
    on: (y) => date(y, 5, 5),
  },
  {
    slug: 'mothersDay',
    kind: 'fun',
    emoji: '💐',
    accent: 'pink',
    on: (y) => nthSunday(y, 5, 2),
  },
  {
    slug: 'ascension',
    kind: 'official',
    emoji: '☁️',
    accent: 'blue',
    on: (y) => shift(easterSunday(y), 39),
  },
  {
    slug: 'whitSunday',
    kind: 'official',
    emoji: '🕊️',
    accent: 'teal',
    on: (y) => shift(easterSunday(y), 49),
  },
  {
    slug: 'whitMonday',
    kind: 'official',
    emoji: '🕊️',
    accent: 'teal',
    on: (y) => shift(easterSunday(y), 50),
  },
  {
    slug: 'fathersDay',
    kind: 'fun',
    emoji: '🧢',
    accent: 'green',
    on: (y) => nthSunday(y, 6, 3),
  },
  { slug: 'animalDay', kind: 'fun', emoji: '🐾', accent: 'green', on: (y) => date(y, 10, 4) },
  { slug: 'halloween', kind: 'fun', emoji: '🎃', accent: 'orange', on: (y) => date(y, 10, 31) },
  { slug: 'sinterklaas', kind: 'fun', emoji: '🎁', accent: 'red', on: (y) => date(y, 12, 5) },
  {
    slug: 'christmasDay',
    kind: 'official',
    emoji: '🎄',
    accent: 'green',
    on: (y) => date(y, 12, 25),
  },
  {
    slug: 'boxingDay',
    kind: 'official',
    emoji: '🎄',
    accent: 'green',
    on: (y) => date(y, 12, 26),
  },
  { slug: 'newYearsEve', kind: 'fun', emoji: '🎉', accent: 'purple', on: (y) => date(y, 12, 31) },
];

/**
 * Easter Sunday, by the Anonymous Gregorian computus (Meeus/Jones/Butcher).
 *
 * Exact for every Gregorian year, and the anchor for seven of the days above.
 * Returned as a `YYYY-MM-DD` date, for the same reason everything else here is.
 */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return date(year, month, day);
}

/**
 * Koningsdag: 27 April, moved *back* to the 26th when the 27th is a Sunday.
 *
 * Back, not forward — the Dutch rule brings the celebration to the Saturday
 * before rather than pushing it into the working week (Koninginnedag on 30
 * April worked the same way). It bites more often than it looks: 2025, 2031 and
 * 2036 all put 27 April on a Sunday.
 */
function kingsDay(year: number): string {
  const day = date(year, 4, 27);
  return weekday(day) === 0 ? shift(day, -1) : day;
}

/** The `n`th Sunday of a month — Moederdag (2nd of May), Vaderdag (3rd of June). */
function nthSunday(year: number, month: number, n: number): string {
  const first = date(year, month, 1);
  // Days from the 1st to the first Sunday: 0 when the 1st *is* a Sunday.
  const offset = (7 - weekday(first)) % 7;
  return shift(first, offset + (n - 1) * 7);
}

/** `YYYY-MM-DD` from a Gregorian y/m/d, month counted from 1. */
function date(year: number, month: number, day: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`;
}

/** `date` moved by whole days. Dates only, so UTC arithmetic is exact. */
function shift(day: string, days: number): string {
  const moved = new Date(`${day}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

/** Day of the week for a date: 0 = Sunday … 6 = Saturday. */
function weekday(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}
