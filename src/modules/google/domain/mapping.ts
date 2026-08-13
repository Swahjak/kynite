import { parseRecurrence, serializeRecurrence } from './recurrence';
import type {
  CalendarSyncState,
  GoogleEventDateTime,
  GoogleEventPerson,
  GoogleEventResource,
  GoogleEventWrite,
  MappedEvent,
  MemberDirectory,
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
 * Google `eventType` values that are a person's *status*, not an appointment
 * (M18): "working from home this week", "focus time 09:00–11:00", "out of
 * office". Google emits them into the ordinary events feed, so without this
 * filter a parent with a corporate calendar puts a full-width "Working
 * location: Home" block on the family's wall board every single day.
 *
 * The set is closed and named from Google's documented enum rather than
 * inferred from a shape, because the alternative — guessing from a missing
 * `summary` or a transparent event — would also drop real all-day events.
 *
 * The two sibling types Google emits are deliberately *not* in it:
 *
 * - `birthday` is an appointment in every sense a family cares about — it is
 *   the one imported event a child looks for, and the app has a first-class
 *   `birthday` event type of its own.
 * - `fromGmail` is a flight, a hotel or a restaurant booking Google parsed out
 *   of a mail. It has a real time and a real place, and a parent who lands at
 *   17:40 wants that on the board.
 */
export const STATUS_ONLY_EVENT_TYPES: ReadonlySet<string> = new Set([
  'workingLocation',
  'focusTime',
  'outOfOffice',
]);

/** True for an entry that must never become a wall-board event. */
export function isStatusOnly(resource: GoogleEventResource): boolean {
  return !!resource.eventType && STATUS_ONLY_EVENT_TYPES.has(resource.eventType);
}

/**
 * The slot an override instance replaces — Google's `originalStartTime`.
 *
 * Google expresses "this occurrence was moved/edited" as a separate instance
 * resource and leaves the master's `recurrence` alone, so this value is the
 * *only* thing that tells the expander which generated instant the child row
 * supersedes. Dropping it is what made every imported override render twice.
 *
 * Tolerant by design: a value we cannot parse costs one series one suppressed
 * instant, which is not worth failing an entire sync pass over.
 */
function parseOriginalStart(resource: GoogleEventResource): Date | null {
  if (!resource.recurringEventId || !resource.originalStartTime) return null;
  try {
    return parseInstant(resource.originalStartTime, 'originalStartTime');
  } catch {
    return null;
  }
}

/** The two attribution columns, as `fromGoogleEvent` receives them. */
export type EventAttribution = {
  ownerMemberId: string | null;
  attendeeMemberIds: string[];
};

/**
 * What an unattributed pass produces — the push echo path, which re-maps our
 * *own* write and must not be allowed to overwrite the attribution the parent
 * chose in the event form. `modules/google/store.ts` reads the empty shape as
 * "leave the existing columns alone".
 */
export const NO_ATTRIBUTION: EventAttribution = { ownerMemberId: null, attendeeMemberIds: [] };

function personEmail(person: GoogleEventPerson | undefined): string | null {
  if (!person || person.resource) return null;
  const email = person.email?.trim().toLowerCase();
  return email && email.length > 0 ? email : null;
}

/**
 * Google attendees → this household's members (M18, legacy parity).
 *
 * Three rules, and each of them is a decision:
 *
 * - **Case-insensitive match, unmatched addresses ignored.** A Google event
 *   routinely carries colleagues, a dentist and a room; none of them is a
 *   family member and none of them should invent one.
 * - **The organizer, if we know them, owns the row.** `ownerMemberId` is what
 *   routes reminders (§6 step 4) and what the person columns key off, so it has
 *   to be the person whose event it is rather than whoever happens to be listed
 *   first.
 * - **The owner of the account's *primary* calendar is always a participant.**
 *   This is the rule that makes the feature visible at all: most events on a
 *   parent's personal calendar list no attendees whatsoever, and without it
 *   every one of them would still land unattributed, in nobody's column —
 *   which is exactly the gap this closes.
 *
 *   It applies to the primary calendar and to nothing else. A Google account
 *   also carries subscriptions ("Nederlandse feestdagen") and colleagues'
 *   shared diaries, and the account holder is not a participant of those: the
 *   fallback there would put every national holiday and every colleague's
 *   dentist appointment in one parent's person column. Non-primary calendars
 *   attribute from matched organizer/attendees only, and land unattributed
 *   when nobody matches — which is the honest answer.
 * - **A declined attendee is not a participant.** Somebody who said no to the
 *   invitation is not going, so they do not belong in that day's column.
 */
export function attributeEvent(
  resource: GoogleEventResource,
  calendar: Pick<CalendarSyncState, 'ownerMemberId' | 'isPrimary'>,
  directory: MemberDirectory
): EventAttribution {
  const calendarOwnerId = calendar.isPrimary ? (calendar.ownerMemberId ?? null) : null;

  const attendeeIds = new Set<string>();
  for (const attendee of resource.attendees ?? []) {
    if (attendee.responseStatus === 'declined') continue;
    const email = personEmail(attendee);
    if (!email) continue;
    const memberId = directory.memberIdFor(email);
    if (memberId) attendeeIds.add(memberId);
  }
  if (calendarOwnerId) attendeeIds.add(calendarOwnerId);

  const organizerEmail = personEmail(resource.organizer) ?? personEmail(resource.creator);
  const organizerId = organizerEmail ? directory.memberIdFor(organizerEmail) : null;

  // A resolved owner is a participant of their own event even when Google's
  // attendee list omits them — which it routinely does for an event somebody
  // created on their own calendar without inviting anybody.
  const ownerMemberId = organizerId ?? calendarOwnerId;
  if (ownerMemberId) attendeeIds.add(ownerMemberId);

  return { ownerMemberId, attendeeMemberIds: [...attendeeIds] };
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
  fallbackTimeZone: string = DEFAULT_TIMEZONE,
  attribution: EventAttribution = NO_ATTRIBUTION
): MappedEvent {
  const allDay = !!resource.start?.date && !resource.start?.dateTime;
  const recurrence = parseRecurrence(resource.recurrence);
  const updated = resource.updated ? new Date(resource.updated) : null;

  return {
    ...attribution,
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
    recurrenceOriginalStart: parseOriginalStart(resource),
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
