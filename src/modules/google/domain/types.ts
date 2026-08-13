/**
 * The shapes the sync engine works with.
 *
 * Deliberately framework-free and database-free: the engine talks to a
 * `GoogleCalendarApi` port and a `SyncStore` port, so the whole of
 * docs/architecture.md §5 ("Incremental sync", "Write path") is exercised by
 * the fixture suite with no live API and no Postgres.
 */

/** The subset of Google's `events` resource we read. */
export type GoogleEventResource = {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  etag?: string;
  summary?: string;
  description?: string;
  location?: string;
  updated?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
  /** RFC-5545 content lines: `RRULE:…`, `EXDATE;TZID=…:…`, `RDATE:…`. */
  recurrence?: string[];
  /** Set on an override instance; points at the series master's event id. */
  recurringEventId?: string;
  originalStartTime?: GoogleEventDateTime;
  /**
   * Google's own classification. `default` and `birthday` are real events;
   * `workingLocation`, `focusTime` and `outOfOffice` are *status* entries a
   * parent's work calendar emits constantly, and they must never reach the wall
   * board (see `isStatusOnly`). Typed as a union plus `(string & {})` because
   * Google adds values to this enum without notice and an unknown one has to
   * stay an ordinary event rather than crash the mapper.
   */
  eventType?: GoogleEventType;
  /** Who Google says owns the event. Matched against linked accounts (§5). */
  organizer?: GoogleEventPerson;
  creator?: GoogleEventPerson;
  attendees?: GoogleEventPerson[];
};

export type GoogleEventType =
  | 'default'
  | 'birthday'
  | 'focusTime'
  | 'fromGmail'
  | 'outOfOffice'
  | 'workingLocation'
  | (string & NonNullable<unknown>);

/** The subset of Google's attendee/organizer shape attribution needs. */
export type GoogleEventPerson = {
  email?: string;
  displayName?: string;
  self?: boolean;
  /** Google emits placeholder rows for rooms and equipment; never a person. */
  resource?: boolean;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
};

export type GoogleEventDateTime = {
  /** All-day: `YYYY-MM-DD`. Google's `end.date` is exclusive. */
  date?: string;
  /** Timed: RFC-3339. */
  dateTime?: string;
  timeZone?: string;
};

export type GoogleCalendarResource = {
  id: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  /** IANA zone of the calendar itself — the per-event zone fallback (§5). */
  timeZone?: string;
  accessRole?: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
  primary?: boolean;
  deleted?: boolean;
  selected?: boolean;
};

export type GoogleEventsPage = {
  items: GoogleEventResource[];
  nextPageToken?: string;
  nextSyncToken?: string;
};

export type GoogleCalendarListPage = {
  items: GoogleCalendarResource[];
  nextPageToken?: string;
};

export type GoogleChannel = {
  id: string;
  resourceId: string;
  /** Milliseconds since epoch, as a string — Google sends it that way. */
  expiration?: string;
};

export type ListEventsParams = {
  calendarId: string;
  syncToken?: string | null;
  pageToken?: string | null;
};

export type WatchParams = {
  calendarId: string;
  channelId: string;
  address: string;
  token: string;
};

/**
 * The Google Calendar boundary — the only thing the fixture suite mocks
 * (docs/architecture.md §9: "Google API is the only mocked boundary").
 */
export interface GoogleCalendarApi {
  listCalendars(pageToken?: string | null): Promise<GoogleCalendarListPage>;
  /** `singleEvents=false` + `showDeleted=true` are the engine's contract, not the caller's. */
  listEvents(params: ListEventsParams): Promise<GoogleEventsPage>;
  getEvent(calendarId: string, eventId: string): Promise<GoogleEventResource>;
  insertEvent(calendarId: string, body: GoogleEventWrite): Promise<GoogleEventResource>;
  patchEvent(
    calendarId: string,
    eventId: string,
    body: GoogleEventWrite,
    etag?: string | null
  ): Promise<GoogleEventResource>;
  deleteEvent(calendarId: string, eventId: string, etag?: string | null): Promise<void>;
  watch(params: WatchParams): Promise<GoogleChannel>;
  stopChannel(channelId: string, resourceId: string): Promise<void>;
}

/** What we send to Google on a write. `id` is only ever set on insert. */
export type GoogleEventWrite = {
  id?: string;
  summary?: string;
  description?: string | null;
  location?: string | null;
  start: GoogleEventDateTime;
  end: GoogleEventDateTime;
  recurrence?: string[];
};

/** A Google event mapped onto our `event` row shape (docs/architecture.md §3). */
export type MappedEvent = {
  googleEventId: string;
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
  /** Google id of the series master, when this row is an override instance. */
  recurringEventId: string | null;
  /**
   * The instant on the master this override replaces (`originalStartTime`).
   * The expander subtracts it, because Google — unlike our own occurrence edit
   * — does not put an EXDATE on the master (see `event.recurrenceOriginalStart`).
   */
  recurrenceOriginalStart: Date | null;
  etag: string | null;
  updatedAtRemote: Date | null;
  /**
   * Attribution (M18). Both are *resolved member ids*, not emails: the mapper
   * produces them from `attributeEvent()`, and a pass with no directory (the
   * push echo path) leaves them `null`/`[]`, which the store reads as "keep
   * whatever is already there" rather than as "nobody".
   */
  ownerMemberId: string | null;
  attendeeMemberIds: string[];
};

/** The local row shape the engine needs — a narrow read of `event`. */
export type StoredEvent = {
  id: string;
  googleEventId: string | null;
  etag: string | null;
  /**
   * What we recorded as the slot this override replaces — read back so the
   * engine can tell "unchanged" from "never recorded" (`needsExceptionBackfill`).
   */
  recurrenceOriginalStart: Date | null;
  updatedAtRemote: Date | null;
  updatedAt: Date;
  version: number;
  deletedAt: Date | null;
};

/** The `calendar` columns the engine needs (docs/architecture.md §3). */
export type CalendarSyncState = {
  id: string;
  familyId: string;
  googleCalendarId: string;
  syncToken: string | null;
  /**
   * The calendar's own zone, passed to `fromGoogleEvent()` for events that
   * carry none. Null falls back to `DEFAULT_TIMEZONE` inside the mapper.
   */
  timeZone?: string | null;
  /**
   * The member this calendar *belongs to* (`calendar.owner_member_id`, M23).
   * Legacy parity: they are a participant of everything on their own calendar,
   * matched attendee list or not — which is what puts an imported work meeting
   * in that parent's column rather than in nobody's.
   *
   * Null for the subscriptions and colleagues' diaries that hang off the same
   * account, where the fallback would be the wrong person entirely.
   */
  ownerMemberId?: string | null;
};

/**
 * Email → member id, for attendee attribution (M18).
 *
 * A port rather than a query, for the same reason `SyncStore` is one: the
 * matching rule (case-insensitive, unmatched addresses ignored) is policy and
 * belongs in the pure layer, while "which addresses does this household own" is
 * a database read. The production implementation is built by
 * `modules/google/sync.ts`; the fixture suite passes a `Map`.
 */
export interface MemberDirectory {
  /** `null` when the address belongs to nobody in this family. */
  memberIdFor(email: string): string | null;
}

/**
 * Persistence port. The production implementation is `modules/google/store.ts`
 * (drizzle); the suite uses an in-memory double.
 */
export interface SyncStore {
  /** Local rows for these Google ids, keyed by Google id. */
  findByGoogleIds(calendarId: string, googleEventIds: string[]): Promise<Map<string, StoredEvent>>;
  /** Insert-or-update by `(calendarId, googleEventId)`; returns the row identity. */
  upsertEvent(
    calendar: CalendarSyncState,
    input: MappedEvent,
    recurrenceParentId: string | null
  ): Promise<{ id: string; version: number }>;
  /** Google tombstone → soft delete. `null` when we never had the event. */
  tombstone(
    calendar: CalendarSyncState,
    googleEventId: string,
    at: Date
  ): Promise<{ id: string; version: number } | null>;
  setSyncToken(calendarId: string, token: string | null, syncedAt: Date | null): Promise<void>;
}

/** Realtime emission port (§4). Keeps the engine free of the realtime slice. */
export type SyncEmission =
  | { type: 'event.upserted'; familyId: string; entityId: string; version: number }
  | { type: 'event.deleted'; familyId: string; entityId: string; version: number }
  | {
      type: 'sync.status';
      familyId: string;
      entityId: string;
      patch: Record<string, unknown>;
    };

export type Emitter = (emission: SyncEmission) => Promise<void> | void;
