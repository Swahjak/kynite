import { parseRecurrence, serializeRecurrence } from './recurrence';
import type {
  GoogleEventDateTime,
  GoogleEventResource,
  GoogleEventWrite,
  MappedEvent,
} from './types';

/**
 * Google `events` resource ⇄ our `event` row (docs/architecture.md §3).
 *
 * Pure: no clock, no database, no network. Every asymmetry Google imposes is
 * handled here and nowhere else — all-day dates being exclusive at the end,
 * recurrence living in an array of RFC-5545 lines, an override instance
 * pointing at its master by *Google* id.
 */

export const DEFAULT_TIMEZONE = 'Europe/Amsterdam';

/** An untitled Google event is legal; the column is NOT NULL, so name it. */
export const UNTITLED = '(no title)';

export class EventMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EventMappingError';
  }
}

/** `YYYY-MM-DD` → that calendar day's UTC midnight. */
function parseAllDay(date: string): Date {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new EventMappingError(`invalid all-day date "${date}"`);
  return parsed;
}

/** UTC instant → `YYYY-MM-DD`, the inverse of `parseAllDay`. */
export function toAllDayDate(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

function parseInstant(value: GoogleEventDateTime | undefined, label: string): Date {
  if (value?.dateTime) {
    const parsed = new Date(value.dateTime);
    if (Number.isNaN(parsed.getTime())) {
      throw new EventMappingError(`invalid ${label} dateTime "${value.dateTime}"`);
    }
    return parsed;
  }
  if (value?.date) return parseAllDay(value.date);
  throw new EventMappingError(`event ${label} has neither date nor dateTime`);
}

/**
 * Google → row. `fallbackTimeZone` is the calendar's own zone, used when the
 * event carries none (all-day events usually do not).
 *
 * All-day end dates stay **exclusive**, exactly as Google sends them: the
 * alternative is a lossy ±1 day fixup that has to be undone on every write.
 * Readers treat `allDay` as the signal.
 */
export function fromGoogleEvent(
  resource: GoogleEventResource,
  fallbackTimeZone: string = DEFAULT_TIMEZONE
): MappedEvent {
  const allDay = !!resource.start?.date && !resource.start?.dateTime;
  const recurrence = parseRecurrence(resource.recurrence);
  const updated = resource.updated ? new Date(resource.updated) : null;

  return {
    googleEventId: resource.id,
    title: resource.summary?.trim() ? resource.summary : UNTITLED,
    description: resource.description ?? null,
    location: resource.location ?? null,
    startsAt: parseInstant(resource.start, 'start'),
    endsAt: parseInstant(resource.end, 'end'),
    allDay,
    tz: resource.start?.timeZone ?? resource.end?.timeZone ?? fallbackTimeZone,
    rrule: recurrence.rrule,
    rdates: recurrence.rdates,
    exdates: recurrence.exdates,
    recurringEventId: resource.recurringEventId ?? null,
    etag: resource.etag ?? null,
    updatedAtRemote: updated && !Number.isNaN(updated.getTime()) ? updated : null,
  };
}

/** The row fields a write needs — a structural subset of `event`. */
export type WritableEvent = {
  title: string;
  description: string | null;
  location: string | null;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  tz: string;
  rrule: string | null;
  rdates: string[];
  exdates: string[];
};

/** Row → Google. `googleEventId` is passed only on insert (see `push-engine`). */
export function toGoogleEvent(row: WritableEvent, googleEventId?: string): GoogleEventWrite {
  const start: GoogleEventDateTime = row.allDay
    ? { date: toAllDayDate(row.startsAt) }
    : { dateTime: row.startsAt.toISOString(), timeZone: row.tz };
  const end: GoogleEventDateTime = row.allDay
    ? { date: toAllDayDate(row.endsAt) }
    : { dateTime: row.endsAt.toISOString(), timeZone: row.tz };

  const recurrence = serializeRecurrence({
    rrule: row.rrule,
    rdates: row.rdates,
    exdates: row.exdates,
  });

  return {
    ...(googleEventId ? { id: googleEventId } : {}),
    summary: row.title,
    description: row.description,
    location: row.location,
    start,
    end,
    ...(recurrence.length > 0 ? { recurrence } : {}),
  };
}

/** A Google tombstone — the only thing a cancelled resource reliably carries. */
export function isTombstone(resource: GoogleEventResource): boolean {
  return resource.status === 'cancelled';
}
