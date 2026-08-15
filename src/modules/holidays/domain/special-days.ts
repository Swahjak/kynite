/**
 * Queries over the special-day list — the slice's actual public behaviour.
 *
 * Split from `nl.ts` so the *data* stays one readable file (the seam a second
 * country is copied from) and the *questions* stay one readable file. Pure and
 * framework-free: dates in, dates out, `YYYY-MM-DD` throughout.
 *
 * Three questions, one per surface:
 *
 * - `specialDays(year)` — the year, for the calendar loader to synthesise
 *   all-day instances from.
 * - `specialDaysOn(dateKey)` — is *this* day special? The month cell's emoji
 *   and the vandaag header's festive line.
 * - `upcomingCountdown(dateKey)` — "nog 3 nachtjes slapen". Deliberately not
 *   "the next special day": a countdown to Bevrijdingsdag is not a thing a
 *   child asks for, and a screen that counted down to all seventeen would
 *   never once be quiet.
 */

import { SPECIAL_DAYS_NL, type SpecialDay, type SpecialDaySlug } from './nl';

/**
 * The days a child actually counts, and nothing else.
 *
 * Both are in December and 20 days apart, so the ten-night windows below can
 * never overlap — which is why `upcomingCountdown` can return one line rather
 * than a list.
 */
export const COUNTDOWN_SLUGS: readonly SpecialDaySlug[] = ['sinterklaas', 'christmasDay'];

/**
 * How early the counting starts.
 *
 * Ten nights is about where anticipation turns into a number worth showing: far
 * enough out that the first "nog 10 nachtjes" lands as news, close enough that
 * the number never reads as a countdown to something abstract.
 */
export const COUNTDOWN_NIGHTS = 10;

/**
 * The days that get confetti when the screen is opened on them.
 *
 * The two a child counts, plus Koningsdag — the one day of the year the whole
 * country is visibly celebrating something, and the only *official* holiday
 * that reads as a party rather than as a day off. Kerst and Pakjesavond earn it
 * for the obvious reason. Everything else stays quiet on purpose: confetti that
 * fires seventeen times a year is decoration, and decoration is what a family
 * stops seeing.
 */
export const CONFETTI_SLUGS: readonly SpecialDaySlug[] = [
  'sinterklaas',
  'christmasDay',
  'kingsDay',
];

/** Every special day of `year`, in calendar order. */
export function specialDays(year: number): SpecialDay[] {
  return SPECIAL_DAYS_NL.map((definition) => ({
    slug: definition.slug,
    kind: definition.kind,
    emoji: definition.emoji,
    accent: definition.accent,
    date: definition.on(year),
  })).sort((left, right) => left.date.localeCompare(right.date));
}

/**
 * The special days falling on `dateKey` (`YYYY-MM-DD`) — usually none, often
 * one, occasionally two.
 *
 * A list rather than a single day because two of them genuinely collide:
 * Eerste Pinksterdag and Moederdag are both Sundays in the same fortnight and
 * land together in years with a very early Easter (2035 is the next). Returning
 * both and letting the surface decide how many it has room for is honest;
 * picking a winner here would hide Moederdag from a household on the one
 * morning it matters most.
 */
export function specialDaysOn(dateKey: string): SpecialDay[] {
  const year = yearOf(dateKey);
  if (year === null) return [];

  return specialDays(year).filter((day) => day.date === dateKey);
}

/** How many nights of sleep away a special day is, and which one. */
export type SpecialDayCountdown = {
  slug: SpecialDaySlug;
  emoji: string;
  /** `YYYY-MM-DD` of the day being counted to. */
  date: string;
  /** 1…`COUNTDOWN_NIGHTS`. Never 0 — the day itself gets confetti, not a count. */
  nights: number;
};

/**
 * The countdown to show on `dateKey`, or null on the ~355 days there isn't one.
 *
 * Counted in *nights*, which is the unit the Dutch phrase uses and also the
 * only one that survives being asked at 21:00: "nog 3 nachtjes slapen" is true
 * all day on the 2nd, where "over 3 dagen" quietly stops being true after
 * lunch. It is therefore a difference between two calendar dates and never a
 * difference between two instants — the caller resolves "today" in the
 * household's timezone and hands the date key down.
 *
 * Both December targets are checked in `dateKey`'s own year *and* the next, so
 * the last days of December count towards the Sinterklaas of the year after
 * rather than falling off the end of the list.
 */
export function upcomingCountdown(dateKey: string): SpecialDayCountdown | null {
  const year = yearOf(dateKey);
  if (year === null) return null;

  let best: SpecialDayCountdown | null = null;

  for (const candidateYear of [year, year + 1]) {
    for (const day of specialDays(candidateYear)) {
      if (!COUNTDOWN_SLUGS.includes(day.slug)) continue;

      const nights = nightsBetween(dateKey, day.date);
      if (!Number.isFinite(nights) || nights < 1 || nights > COUNTDOWN_NIGHTS) continue;
      if (best && best.nights <= nights) continue;

      best = { slug: day.slug, emoji: day.emoji, date: day.date, nights };
    }
  }

  return best;
}

/** Whole days from `from` to `to`, both `YYYY-MM-DD`. Negative when `to` is past. */
function nightsBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return Number.NaN;

  return Math.round((end - start) / 86_400_000);
}

/** The year of a `YYYY-MM-DD` key, or null when it is not one. */
function yearOf(dateKey: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  return Number(dateKey.slice(0, 4));
}
