/**
 * The few RFC-5545 values we *write*.
 *
 * Reading is deliberately liberal (`domain/expand.ts` copes with whatever
 * Google sends); writing is deliberately narrow, because anything we emit has
 * to round-trip through Google unchanged. Both EXDATE forms below are exactly
 * what Google Calendar itself produces for the same situation, which is what
 * makes an override a passthrough rather than a translation.
 */

import { toWall, type Wall } from './zone';

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

/** `20260302T083000` — an RFC-5545 local DATE-TIME. */
export function formatDateTime(wall: Wall): string {
  return (
    `${pad(wall.year, 4)}${pad(wall.month)}${pad(wall.day)}` +
    `T${pad(wall.hour)}${pad(wall.minute)}${pad(Math.floor(wall.second))}`
  );
}

/** `20260302` — an RFC-5545 DATE. */
export function formatDate(wall: Wall): string {
  return `${pad(wall.year, 4)}${pad(wall.month)}${pad(wall.day)}`;
}

/**
 * The EXDATE line that suppresses one occurrence of a series.
 *
 * All-day series get the `VALUE=DATE` form read in UTC, matching how M05's
 * mapper stores all-day bounds (UTC midnights, so they carry no zone). Timed
 * series get the `TZID=` form in the series' own zone, so the exception
 * survives a DST boundary the same way its occurrences do.
 */
export function exdateLine(instant: Date, timeZone: string, allDay: boolean): string {
  if (allDay) return `EXDATE;VALUE=DATE:${formatDate(toWall(instant, 'UTC'))}`;
  return `EXDATE;TZID=${timeZone}:${formatDateTime(toWall(instant, timeZone))}`;
}

/**
 * Append an EXDATE, skipping one that is already there.
 *
 * Exact string comparison is the right test precisely because we only ever
 * append lines we generated ourselves in this one format — two of our EXDATEs
 * for the same instant are byte-identical.
 */
export function addExdate(exdates: string[], line: string): string[] {
  return exdates.includes(line) ? exdates : [...exdates, line];
}
