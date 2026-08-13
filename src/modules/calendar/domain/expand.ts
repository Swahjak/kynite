/**
 * Recurrence expansion on read (docs/architecture.md §3 "Recurrence decision").
 *
 * A stored `event` row is a *series*, not an instance: RRULE/RDATE/EXDATE are
 * kept byte-identical to what Google sent, and the instances a view needs are
 * generated per window here. Materialising instances into rows would round-trip
 * Google lossily and cannot express a custody week at all.
 *
 * Composition, in RFC-5545 order:
 *
 *   (every RRULE ∪ every RDATE) − every EXDATE
 *
 * Overrides are the one asymmetry. "Edit this one occurrence" in Kynite writes
 * a child row carrying `recurrenceParentId` *and* an EXDATE on the parent, so
 * the parent stops generating that instant and the child expands as the
 * single-instance series it now is. Google does the first half only: its
 * override is a separate instance resource and the master's recurrence is left
 * untouched. So an imported exception arrives as `excludeStarts` instead —
 * same subtraction, a slot the caller supplies rather than one the row carries.
 */

import { parseRule, parseDateTimeValue, occurrencesOf, type Rule } from './rrule';
import { MS_PER_DAY, toDateKey, toWall } from './zone';

/** The subset of an `event` row expansion actually reads. */
export type ExpandableSeries = {
  id: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  tz: string;
  rrule: string | null;
  rdates: string[];
  exdates: string[];
};

/**
 * One rendered occurrence. `key` is stable for a given series + start, which is
 * what a React list and a drag handler both need — and what distinguishes two
 * instances of the same series inside one view.
 */
export type Occurrence = {
  key: string;
  seriesId: string;
  startsAt: Date;
  endsAt: Date;
  /** False for the instance that sits on the series' own DTSTART. */
  isRecurringInstance: boolean;
};

export type ExpandOptions = {
  /** Window start, inclusive. */
  from: Date;
  /** Window end, exclusive. */
  to: Date;
  /** Ceiling on instances per series — a runaway rule cannot flood a view. */
  maxPerSeries?: number;
  /**
   * Extra instants this series must not generate, on top of its own EXDATEs.
   *
   * These are the original slots of *imported* override instances (Google's
   * `originalStartTime`). Google expresses "this occurrence moved" as a
   * separate instance resource and leaves the master's recurrence untouched,
   * so an imported series has no EXDATE for the slot its child replaces —
   * without this, the parent generates the occurrence and the child row
   * renders it again, which is the duplicate every recurring Google event
   * showed. A Kynite-authored occurrence edit needs nothing here: it writes
   * the EXDATE itself (`modules/calendar/actions.ts`).
   */
  excludeStarts?: Iterable<Date>;
};

const DEFAULT_MAX_PER_SERIES = 750;

/**
 * Strip an RFC-5545 property line down to its values, honouring `TZID`.
 *
 * `RDATE;TZID=Europe/Amsterdam:20260302T083000,20260309T083000` yields two
 * values read in Amsterdam; a `…:20260302T073000Z` value is UTC regardless of
 * any TZID, per RFC-5545. `VALUE=PERIOD` RDATEs (a start/duration pair) are
 * not something Google emits for the events we sync, and a period's `/` form
 * would parse as garbage — so those values are skipped rather than guessed at.
 */
export function parseDateLine(line: string, fallbackTimeZone: string): Date[] {
  const colon = line.indexOf(':');
  if (colon === -1) return [];

  const header = line.slice(0, colon);
  const body = line.slice(colon + 1);

  const tzid = /;TZID=([^;:]+)/i.exec(header)?.[1]?.trim();
  const timeZone = tzid && tzid !== '' ? tzid : fallbackTimeZone;

  const parsed: Date[] = [];
  for (const value of body.split(',')) {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed.includes('/')) continue;

    let instant: Date | null;
    try {
      instant = parseDateTimeValue(trimmed, timeZone);
    } catch {
      // An unknown TZID makes `Intl` throw; the family zone is a better answer
      // than dropping the exception date and resurrecting a deleted instance.
      instant = parseDateTimeValue(trimmed, fallbackTimeZone);
    }
    if (instant) parsed.push(instant);
  }

  return parsed;
}

/** Every rule on the series. Multiple RRULEs are `\n`-joined (M05). */
export function rulesOf(series: ExpandableSeries): Rule[] {
  if (!series.rrule) return [];

  return series.rrule
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => parseRule(line, series.tz))
    .filter((rule): rule is Rule => rule !== null);
}

/** True when the row generates more than the single occurrence it stores. */
export function isSeries(series: ExpandableSeries): boolean {
  return !!series.rrule || series.rdates.length > 0;
}

/**
 * Instances of one series inside `[from, to)`, ascending.
 *
 * A non-recurring row is its own single occurrence — the caller does not have
 * to branch, and "does this overlap the window" stays one predicate.
 */
export function expandSeries(series: ExpandableSeries, options: ExpandOptions): Occurrence[] {
  const { from, to } = options;
  const maxPerSeries = options.maxPerSeries ?? DEFAULT_MAX_PER_SERIES;
  const duration = Math.max(0, series.endsAt.getTime() - series.startsAt.getTime());

  const rules = rulesOf(series);
  const rdates = series.rdates.flatMap((line) => parseDateLine(line, series.tz));

  if (rules.length === 0 && rdates.length === 0) {
    // Not recurring: one occurrence, included when it overlaps the window at
    // all — an event that started yesterday and ends today belongs to today.
    return overlaps(series.startsAt, series.endsAt, from, to)
      ? [
          {
            key: series.id,
            seriesId: series.id,
            startsAt: series.startsAt,
            endsAt: series.endsAt,
            isRecurringInstance: false,
          },
        ]
      : [];
  }

  // Widen the generator window by the event's own duration, so a long instance
  // that *started* before the window still shows up inside it.
  const generateFrom = new Date(from.getTime() - duration);

  const starts = new Set<number>();
  for (const rule of rules) {
    for (const instant of occurrencesOf(rule, {
      start: series.startsAt,
      timeZone: series.tz,
      from: generateFrom,
      to,
    })) {
      starts.add(instant.getTime());
    }
  }
  for (const instant of rdates) {
    if (instant.getTime() >= generateFrom.getTime() && instant.getTime() < to.getTime()) {
      starts.add(instant.getTime());
    }
  }

  for (const line of series.exdates) {
    for (const instant of parseDateLine(line, series.tz)) starts.delete(instant.getTime());
  }
  // Imported overrides, which carry their exception on the child rather than as
  // an EXDATE on this row (see `excludeStarts`).
  subtractExcluded(starts, options.excludeStarts, series);

  return [...starts]
    .sort((a, b) => a - b)
    .slice(0, maxPerSeries)
    .map((startTime): Occurrence => {
      const startsAt = new Date(startTime);
      const endsAt = new Date(startTime + duration);
      return {
        key: `${series.id}:${startsAt.toISOString()}`,
        seriesId: series.id,
        startsAt,
        endsAt,
        isRecurringInstance: startTime !== series.startsAt.getTime(),
      };
    })
    .filter((occurrence) => overlaps(occurrence.startsAt, occurrence.endsAt, from, to));
}

/**
 * Remove the excluded slots from a generated set — by instant for a timed
 * series, by *day* for an all-day one.
 *
 * The two halves of an all-day series do not meet on the instant. A stored
 * all-day date is an exact UTC midnight (M05's `parseAllDay`, so the date
 * carries no zone), and that is what an override's `originalStartTime` maps to
 * as well — but expansion is wall-clock in the series zone, so a rule anchored
 * at 00:00Z generates 01:00 Amsterdam in winter and, once the clocks go
 * forward, an instant an hour off the midnight it means. Comparing instants
 * would therefore stop matching at the DST boundary, and silently: birthdays
 * and holiday feeds are all-day series, which is most of what a family
 * imports. The calendar day is the thing both sides actually agree on — read
 * in the series zone for the generated instant (where the wall clock is intact)
 * and in UTC for the stored date (where the date means what it says), exactly
 * as `dayKeysOf` splits it.
 */
function subtractExcluded(
  starts: Set<number>,
  excludeStarts: Iterable<Date> | undefined,
  series: ExpandableSeries
): void {
  if (!excludeStarts) return;

  if (!series.allDay) {
    for (const instant of excludeStarts) starts.delete(instant.getTime());
    return;
  }

  const excludedDays = new Set<string>();
  for (const instant of excludeStarts) excludedDays.add(toDateKey(toWall(instant, 'UTC')));
  if (excludedDays.size === 0) return;

  for (const start of [...starts]) {
    if (excludedDays.has(toDateKey(toWall(new Date(start), series.tz)))) starts.delete(start);
  }
}

/** Half-open overlap, with zero-length events counted at their own instant. */
function overlaps(startsAt: Date, endsAt: Date, from: Date, to: Date): boolean {
  const start = startsAt.getTime();
  const end = Math.max(endsAt.getTime(), start + 1);
  return start < to.getTime() && end > from.getTime();
}

/**
 * The calendar days an occurrence touches, as `YYYY-MM-DD` keys.
 *
 * The zone an occurrence is bucketed in depends on how it stores its bounds:
 *
 * - **Timed** events are instants, so they bucket in the viewer's `timeZone`.
 * - **All-day** events are *dates*, which M05's mapper stores as UTC midnights
 *   (`parseAllDay`) precisely so they carry no zone. Reading those in a local
 *   zone would shift them: 2026-03-02T00:00Z read in Europe/Amsterdam is
 *   01:00 on the 2nd, and its exclusive end 2026-03-03T00:00Z reads as 00:59
 *   on the *3rd* — turning a one-day event into a two-day one. So all-day
 *   bucketing stays in UTC, where the stored dates mean what they say.
 *
 * Google's all-day end date is exclusive and M05 keeps it that way, which the
 * shared `- 1ms` below already handles: 2026-03-02 → 2026-03-03 yields the 2nd
 * alone.
 */
export function dayKeysOf(
  occurrence: Pick<Occurrence, 'startsAt' | 'endsAt'>,
  timeZone: string,
  allDay: boolean
): string[] {
  const zone = allDay ? 'UTC' : timeZone;
  const startWall = toWall(occurrence.startsAt, zone);

  // Both flavours of end are exclusive at the boundary, for different reasons:
  // an all-day end date is exclusive by Google's convention, and a timed event
  // ending exactly at midnight belongs to the day before, not to the next one.
  const endInstant = Math.max(occurrence.startsAt.getTime(), occurrence.endsAt.getTime() - 1);
  const endWall = toWall(new Date(endInstant), zone);

  const keys: string[] = [];
  const endUtc = Date.UTC(endWall.year, endWall.month - 1, endWall.day);
  let cursorUtc = Date.UTC(startWall.year, startWall.month - 1, startWall.day);

  // The cap is a guard, not a policy: nothing in the product spans a year.
  while (cursorUtc <= endUtc && keys.length < 400) {
    const cursor = new Date(cursorUtc);
    keys.push(
      toDateKey({
        year: cursor.getUTCFullYear(),
        month: cursor.getUTCMonth() + 1,
        day: cursor.getUTCDate(),
      })
    );
    cursorUtc += MS_PER_DAY;
  }

  return keys;
}
