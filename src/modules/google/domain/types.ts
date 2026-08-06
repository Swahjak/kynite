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
  etag: string | null;
  updatedAtRemote: Date | null;
};

/** The local row shape the engine needs — a narrow read of `event`. */
export type StoredEvent = {
  id: string;
  googleEventId: string | null;
  etag: string | null;
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
};

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
