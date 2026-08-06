/**
 * IANA wall-clock ⇄ instant conversion.
 *
 * Recurrence expansion has to walk *wall* time, not elapsed time: "every
 * Monday at 08:30" stays 08:30 across a DST boundary, which it would not if we
 * added 7×24h to an instant. So every step in `domain/rrule.ts` happens on a
 * `Wall` value in the event's own `tz` (docs/architecture.md §3, the reason the
 * `event.tz` column exists at all), and only the final occurrence is converted
 * back to a UTC instant here.
 *
 * Pure and framework-free: `Intl.DateTimeFormat` is the only zone database we
 * need, and Node ships it.
 */

export type Wall = {
  year: number;
  /** 1-12, *not* the `Date` 0-11 convention — RFC-5545 counts from 1. */
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const MS_PER_MINUTE = 60_000;
export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    era: 'short',
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

/** True for a zone identifier this runtime can actually resolve. */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone).format(0);
    return true;
  } catch {
    return false;
  }
}

/** The instant, as it reads on a clock in `timeZone`. */
export function toWall(instant: Date, timeZone: string): Wall {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  // `hour12: false` still renders midnight as "24" in some ICU versions.
  const hour = get('hour') % 24;
  const era = parts.find((part) => part.type === 'era')?.value;
  const year = era === 'BC' ? 1 - get('year') : get('year');

  return {
    year,
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
    second: get('second'),
  };
}

/** The zone's offset from UTC at `instant`, in milliseconds (east positive). */
export function offsetAt(instant: Date, timeZone: string): number {
  const wall = toWall(instant, timeZone);
  return asUtc(wall) - instant.getTime();
}

/** A `Wall` read as if it were UTC — the pivot both conversions turn on. */
function asUtc(wall: Wall): number {
  const utc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  // Date.UTC maps years 0-99 into 1900-1999; recurrence never reaches there,
  // but the correction keeps the function total.
  if (wall.year >= 0 && wall.year < 100) {
    const corrected = new Date(utc);
    corrected.setUTCFullYear(wall.year);
    return corrected.getTime();
  }
  return utc;
}

/**
 * The instant at which clocks in `timeZone` read `wall`.
 *
 * DST makes this a partial function, so both irregular cases get a defined
 * answer rather than an accidental one:
 *
 * - **Spring-forward gap** (02:30 on a night that jumps 02:00 → 03:00): the
 *   wall time never happens. We return the instant the *post*-transition
 *   offset maps it to, which lands just after the jump — the same choice
 *   RFC-5545 readers and Google Calendar make.
 * - **Autumn-back overlap** (02:30 happens twice): we return the *first*,
 *   pre-transition occurrence — the earlier UTC instant, matching Google
 *   Calendar.
 */
export function fromWall(wall: Wall, timeZone: string): Date {
  const target = asUtc(wall);

  // First guess: offset at the naive instant. One correction pass is enough
  // for every real zone, because offsets shift by at most a couple of hours.
  const firstOffset = offsetAt(new Date(target), timeZone);
  const firstGuess = target - firstOffset;

  const secondOffset = offsetAt(new Date(firstGuess), timeZone);

  if (secondOffset === firstOffset) {
    // The naive read already round-trips, but that alone does not rule out
    // the autumn-back *overlap*: the offset the naive instant happens to fall
    // under is whichever regime is active at that literal UTC value, which for
    // an overlapping wall time is always the *later* (post-transition) one —
    // so this branch would otherwise silently return the second occurrence.
    // Probe a day back, far enough from the transition to read the outgoing
    // offset cleanly, and see if it produces a second genuine instant for the
    // same wall time.
    const altOffset = offsetAt(new Date(firstGuess - MS_PER_DAY), timeZone);
    if (altOffset !== firstOffset) {
      const altGuess = target - altOffset;
      if (offsetAt(new Date(altGuess), timeZone) === altOffset) {
        // Both candidates round-trip: this wall time is the overlap. Return
        // the earlier instant — the first, pre-transition occurrence.
        return new Date(Math.min(firstGuess, altGuess));
      }
    }
    return new Date(firstGuess);
  }

  const secondGuess = target - secondOffset;

  // Prefer whichever candidate actually round-trips. In the gap neither does;
  // the later candidate is the post-transition reading, which is what we want.
  if (offsetAt(new Date(secondGuess), timeZone) === secondOffset) return new Date(secondGuess);
  return new Date(Math.max(firstGuess, secondGuess));
}

/** Same calendar day in `timeZone`? */
export function isSameDay(a: Date, b: Date, timeZone: string): boolean {
  const left = toWall(a, timeZone);
  const right = toWall(b, timeZone);
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

/** Midnight starting the calendar day that contains `instant`. */
export function startOfDay(instant: Date, timeZone: string): Date {
  const wall = toWall(instant, timeZone);
  return fromWall({ ...wall, hour: 0, minute: 0, second: 0 }, timeZone);
}

/** ISO weekday of a wall date: 1 = Monday … 7 = Sunday. */
export function isoWeekday(wall: Pick<Wall, 'year' | 'month' | 'day'>): number {
  const day = new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Days in a wall month — the only calendar arithmetic RRULE needs. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** `wall` moved by whole days, staying on the same wall clock time. */
export function addDays(wall: Wall, days: number): Wall {
  const shifted = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + days));
  return {
    ...wall,
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/**
 * `wall` moved by whole months, clamped to the last day of the target month.
 * Clamping matters for `FREQ=MONTHLY` off a 31st: RFC-5545 says such a month
 * simply yields no occurrence, so callers that must honour that filter the
 * result — `domain/rrule.ts` does exactly that.
 */
export function addMonths(wall: Wall, months: number): Wall {
  const total = (wall.year * 12 + (wall.month - 1) + months) | 0;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return { ...wall, year, month, day: Math.min(wall.day, daysInMonth(year, month)) };
}

/** Wall date → `YYYY-MM-DD`, the key every per-day bucket in the UI uses. */
export function toDateKey(wall: Pick<Wall, 'year' | 'month' | 'day'>): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(wall.year).padStart(4, '0')}-${pad(wall.month)}-${pad(wall.day)}`;
}

/** `YYYY-MM-DD` → the wall midnight it names. Returns null for anything else. */
export function parseDateKey(key: string): Wall | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;

  return { year, month, day, hour: 0, minute: 0, second: 0 };
}

/** Minutes from wall midnight — the y-offset of a time-grid block. */
export function minutesIntoDay(instant: Date, timeZone: string): number {
  const wall = toWall(instant, timeZone);
  return wall.hour * 60 + wall.minute + wall.second / 60;
}

export { MS_PER_MINUTE };
