/**
 * RFC-5545 `RRULE` parsing and occurrence generation.
 *
 * Hand-rolled rather than pulled from a library, deliberately. The rule set a
 * family planner actually needs is small and closed — it is enumerated in
 * docs/architecture.md §3 as the custody patterns FR5 must express:
 *
 * - `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO`            alternating weeks
 * - `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TU,WE`      2-2-3 rotation (two rules)
 * - `FREQ=MONTHLY;BYDAY=FR;BYSETPOS=1,3`         1st and 3rd weekend
 *
 * plus daily/yearly, `COUNT`, `UNTIL`, `BYMONTHDAY`, `BYMONTH` and `WKST`. A
 * general RFC-5545 engine would carry `BYYEARDAY`/`BYWEEKNO`/`BYHOUR` and the
 * whole "expand vs limit" table for rules no calendar UI in this product can
 * even author. The narrower surface is the one we can hold correct and test
 * exhaustively — and `parseRule()` reports what it could not model instead of
 * silently dropping it, so an imported Google rule we do not understand is
 * visible rather than quietly wrong.
 *
 * Everything here runs on wall time in the series' own zone (see
 * `domain/zone.ts`); DST is therefore not this file's problem.
 */

import { addDays, addMonths, daysInMonth, fromWall, isoWeekday, toWall, type Wall } from './zone';

export const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** RFC-5545 weekday codes, indexed so `WEEKDAYS[n] === n + 1` in ISO terms. */
export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** A `BYDAY` entry: `FR` or `1FR` / `-1SU` in the ordinal forms. */
export type ByDay = { weekday: Weekday; ordinal: number | null };

export type Rule = {
  freq: Frequency;
  interval: number;
  count: number | null;
  /** Inclusive upper bound, as an instant. */
  until: Date | null;
  byDay: ByDay[];
  byMonthDay: number[];
  byMonth: number[];
  bySetPos: number[];
  /** Week start, ISO numbered (1 = Monday). RFC-5545 default is MO. */
  weekStart: number;
  /** Parameter names we recognised but cannot model. Never silently empty. */
  unsupported: string[];
};

/** Hard ceiling on generator work, so a malformed rule cannot hang a request. */
const MAX_ITERATIONS = 10_000;

const SUPPORTED_PARTS = new Set([
  'FREQ',
  'INTERVAL',
  'COUNT',
  'UNTIL',
  'BYDAY',
  'BYMONTHDAY',
  'BYMONTH',
  'BYSETPOS',
  'WKST',
]);

function isoIndexOf(weekday: Weekday): number {
  return WEEKDAYS.indexOf(weekday) + 1;
}

function parseIntegerList(value: string): number[] {
  return value
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((part) => Number.isFinite(part));
}

function parseByDay(value: string): ByDay[] {
  const entries: ByDay[] = [];

  for (const raw of value.split(',')) {
    const match = /^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/.exec(raw.trim().toUpperCase());
    if (!match) continue;
    entries.push({
      weekday: match[2] as Weekday,
      ordinal: match[1] ? Number.parseInt(match[1], 10) : null,
    });
  }

  return entries;
}

/**
 * `UNTIL` / a DATE-TIME value: `YYYYMMDD`, `YYYYMMDDTHHMMSS` or the `Z` form.
 * A floating (zone-less) value is read in `timeZone`; a `Z` value is UTC, as
 * RFC-5545 requires.
 */
export function parseDateTimeValue(value: string, timeZone: string): Date | null {
  const trimmed = value.trim();

  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    return fromWall(
      {
        year: Number(dateOnly[1]),
        month: Number(dateOnly[2]),
        day: Number(dateOnly[3]),
        hour: 0,
        minute: 0,
        second: 0,
      },
      timeZone
    );
  }

  const full = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(trimmed);
  if (!full) return null;

  const wall: Wall = {
    year: Number(full[1]),
    month: Number(full[2]),
    day: Number(full[3]),
    hour: Number(full[4]),
    minute: Number(full[5]),
    second: Number(full[6]),
  };

  if (full[7]) {
    return new Date(
      Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)
    );
  }
  return fromWall(wall, timeZone);
}

/**
 * One `RRULE` value (the property name already stripped — see
 * `modules/google/domain/recurrence.ts`, which stores it that way).
 *
 * Returns null only when there is no usable `FREQ`: a rule we cannot even
 * classify is not a rule, and rendering nothing beats rendering a guess.
 */
export function parseRule(value: string, timeZone: string): Rule | null {
  const rule: Rule = {
    freq: 'DAILY',
    interval: 1,
    count: null,
    until: null,
    byDay: [],
    byMonthDay: [],
    byMonth: [],
    bySetPos: [],
    weekStart: 1,
    unsupported: [],
  };

  let sawFreq = false;

  for (const part of value.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;

    const name = part.slice(0, separator).trim().toUpperCase();
    const raw = part.slice(separator + 1).trim();
    if (raw === '') continue;

    if (!SUPPORTED_PARTS.has(name)) {
      // Recorded, not dropped: an unmodelled part means the expansion is an
      // approximation, and callers get to see that rather than infer it.
      rule.unsupported.push(name);
      continue;
    }

    switch (name) {
      case 'FREQ': {
        const freq = raw.toUpperCase() as Frequency;
        if (!FREQUENCIES.includes(freq)) {
          rule.unsupported.push(`FREQ=${raw}`);
          continue;
        }
        rule.freq = freq;
        sawFreq = true;
        break;
      }
      case 'INTERVAL': {
        const interval = Number.parseInt(raw, 10);
        if (Number.isFinite(interval) && interval > 0) rule.interval = interval;
        break;
      }
      case 'COUNT': {
        const count = Number.parseInt(raw, 10);
        if (Number.isFinite(count) && count > 0) rule.count = count;
        break;
      }
      case 'UNTIL':
        rule.until = parseDateTimeValue(raw, timeZone);
        break;
      case 'BYDAY':
        rule.byDay = parseByDay(raw);
        break;
      case 'BYMONTHDAY':
        rule.byMonthDay = parseIntegerList(raw).filter(
          (day) => day !== 0 && day >= -31 && day <= 31
        );
        break;
      case 'BYMONTH':
        rule.byMonth = parseIntegerList(raw).filter((month) => month >= 1 && month <= 12);
        break;
      case 'BYSETPOS':
        rule.bySetPos = parseIntegerList(raw).filter((position) => position !== 0);
        break;
      case 'WKST': {
        const weekday = raw.toUpperCase() as Weekday;
        if (WEEKDAYS.includes(weekday)) rule.weekStart = isoIndexOf(weekday);
        break;
      }
    }
  }

  return sawFreq ? rule : null;
}

/** `-1` on a 30-day month means day 30. Out-of-range entries are dropped. */
function resolveMonthDay(day: number, year: number, month: number): number | null {
  const length = daysInMonth(year, month);
  const resolved = day > 0 ? day : length + day + 1;
  return resolved >= 1 && resolved <= length ? resolved : null;
}

/** RFC-5545 `BYSETPOS`: 1-based from the front, -1 from the back. */
function applySetPos<T>(candidates: T[], positions: number[]): T[] {
  if (positions.length === 0) return candidates;

  const picked = new Set<number>();
  for (const position of positions) {
    const index = position > 0 ? position - 1 : candidates.length + position;
    if (index >= 0 && index < candidates.length) picked.add(index);
  }

  return [...picked].sort((a, b) => a - b).map((index) => candidates[index]);
}

function sortWalls(walls: Wall[]): Wall[] {
  return walls.sort(
    (a, b) =>
      a.year - b.year ||
      a.month - b.month ||
      a.day - b.day ||
      a.hour - b.hour ||
      a.minute - b.minute ||
      a.second - b.second
  );
}

/** Move `wall` back to the start of its week under `weekStart`. */
function startOfWeek(wall: Wall, weekStart: number): Wall {
  const offset = (isoWeekday(wall) - weekStart + 7) % 7;
  return addDays(wall, -offset);
}

/**
 * The candidate wall times a single period of the rule produces, in order.
 * "Period" means one `FREQ` unit: a day, a week, a month, a year.
 */
function periodCandidates(rule: Rule, periodStart: Wall, seed: Wall): Wall[] {
  const time = { hour: seed.hour, minute: seed.minute, second: seed.second };
  const byMonthOk = (month: number) => rule.byMonth.length === 0 || rule.byMonth.includes(month);

  switch (rule.freq) {
    case 'DAILY': {
      if (!byMonthOk(periodStart.month)) return [];
      // BYDAY on a daily rule is a *filter*, never an expansion.
      if (
        rule.byDay.length > 0 &&
        !rule.byDay.some(({ weekday }) => isoIndexOf(weekday) === isoWeekday(periodStart))
      ) {
        return [];
      }
      if (
        rule.byMonthDay.length > 0 &&
        !rule.byMonthDay.some(
          (day) => resolveMonthDay(day, periodStart.year, periodStart.month) === periodStart.day
        )
      ) {
        return [];
      }
      return [{ ...periodStart, ...time }];
    }

    case 'WEEKLY': {
      // No BYDAY: the series keeps the weekday its DTSTART fell on.
      const weekdays =
        rule.byDay.length > 0
          ? rule.byDay.map(({ weekday }) => isoIndexOf(weekday))
          : [isoWeekday(seed)];

      const candidates: Wall[] = [];
      for (let offset = 0; offset < 7; offset += 1) {
        const day = addDays(periodStart, offset);
        if (!weekdays.includes(isoWeekday(day))) continue;
        if (!byMonthOk(day.month)) continue;
        candidates.push({ ...day, ...time });
      }
      return applySetPos(sortWalls(candidates), rule.bySetPos);
    }

    case 'MONTHLY':
    case 'YEARLY': {
      const months =
        rule.freq === 'YEARLY'
          ? rule.byMonth.length > 0
            ? rule.byMonth
            : [seed.month]
          : [periodStart.month];

      const candidates: Wall[] = [];

      for (const month of months) {
        if (rule.freq === 'MONTHLY' && !byMonthOk(month)) continue;

        const year = periodStart.year;
        const length = daysInMonth(year, month);

        if (rule.byDay.length > 0) {
          // BYDAY expands within the month; ordinals select the nth weekday.
          for (const { weekday, ordinal } of rule.byDay) {
            const target = isoIndexOf(weekday);
            const matches: number[] = [];
            for (let day = 1; day <= length; day += 1) {
              if (isoWeekday({ year, month, day }) === target) matches.push(day);
            }
            const days =
              ordinal === null
                ? matches
                : [ordinal > 0 ? matches[ordinal - 1] : matches[matches.length + ordinal]];

            for (const day of days) {
              if (day === undefined) continue;
              if (
                rule.byMonthDay.length > 0 &&
                !rule.byMonthDay.some((entry) => resolveMonthDay(entry, year, month) === day)
              ) {
                continue;
              }
              candidates.push({ year, month, day, ...time });
            }
          }
        } else {
          const days =
            rule.byMonthDay.length > 0
              ? rule.byMonthDay
                  .map((entry) => resolveMonthDay(entry, year, month))
                  .filter((day): day is number => day !== null)
              : // RFC-5545: a monthly rule off the 31st simply skips short
                // months rather than clamping to the 30th.
                seed.day <= length
                ? [seed.day]
                : [];

          for (const day of days) candidates.push({ year, month, day, ...time });
        }
      }

      return applySetPos(sortWalls(candidates), rule.bySetPos);
    }
  }
}

/** Advance one period. Weekly steps whole weeks; yearly steps whole years. */
function advance(rule: Rule, periodStart: Wall): Wall {
  switch (rule.freq) {
    case 'DAILY':
      return addDays(periodStart, rule.interval);
    case 'WEEKLY':
      return addDays(periodStart, 7 * rule.interval);
    case 'MONTHLY':
      return addMonths({ ...periodStart, day: 1 }, rule.interval);
    case 'YEARLY':
      return { ...periodStart, day: 1, month: 1, year: periodStart.year + rule.interval };
  }
}

/** The period containing DTSTART — where iteration begins. */
function firstPeriod(rule: Rule, seed: Wall): Wall {
  switch (rule.freq) {
    case 'DAILY':
      return { ...seed };
    case 'WEEKLY':
      return startOfWeek(seed, rule.weekStart);
    case 'MONTHLY':
      return { ...seed, day: 1 };
    case 'YEARLY':
      return { ...seed, day: 1, month: 1 };
  }
}

export type OccurrenceOptions = {
  /** DTSTART, as an instant. */
  start: Date;
  timeZone: string;
  /** Window start, inclusive. Occurrences before it are counted, not yielded. */
  from: Date;
  /** Window end, exclusive. */
  to: Date;
  /** Safety valve for a pathological rule; also bounds `COUNT` walking. */
  limit?: number;
};

/**
 * Occurrence *starts* of one rule that fall in `[from, to)`, ascending.
 *
 * `COUNT` is counted from DTSTART, not from the window — that is what makes it
 * correct to ask for "March" of a series that began in January. The iteration
 * cap bounds that walk, so a `COUNT=100000` rule degrades to a truncated view
 * instead of an unbounded loop.
 */
export function occurrencesOf(rule: Rule, options: OccurrenceOptions): Date[] {
  const { start, timeZone, from, to } = options;
  const limit = options.limit ?? MAX_ITERATIONS;

  const seed = toWall(start, timeZone);
  const results: Date[] = [];

  let period = firstPeriod(rule, seed);
  let emitted = 0;
  let iterations = 0;

  while (iterations < limit) {
    iterations += 1;

    const candidates = periodCandidates(rule, period, seed);

    for (const candidate of candidates) {
      const instant = fromWall(candidate, timeZone);

      // RFC-5545: DTSTART bounds the series from below regardless of BY* parts.
      if (instant.getTime() < start.getTime()) continue;
      if (rule.until && instant.getTime() > rule.until.getTime()) return results;

      emitted += 1;
      if (rule.count !== null && emitted > rule.count) return results;

      if (instant.getTime() >= to.getTime()) {
        // Candidates are ascending within a period, and periods ascend too, so
        // nothing after this can land inside the window — unless COUNT still
        // needs walking, which it does not once we are past the window.
        return results;
      }
      if (instant.getTime() >= from.getTime()) results.push(instant);
    }

    const next = advance(rule, period);
    // Defensive: a rule that fails to advance would spin forever.
    if (next.year === period.year && next.month === period.month && next.day === period.day) {
      break;
    }
    period = next;

    // Past the window with no COUNT left to satisfy: stop.
    const periodInstant = fromWall(period, timeZone);
    if (periodInstant.getTime() >= to.getTime()) break;
  }

  return results;
}

export { MAX_ITERATIONS };
