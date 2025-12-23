/**
 * Google Calendar API response types
 */

export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole: "owner" | "writer" | "reader" | "freeBusyReader";
  primary?: boolean;
  selected?: boolean;
}

export interface GoogleCalendarListResponse {
  kind: "calendar#calendarList";
  items: GoogleCalendarListItem[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export interface GoogleEventDateTime {
  dateTime?: string; // ISO 8601 for timed events
  date?: string; // YYYY-MM-DD for all-day events
  timeZone?: string;
}

export interface GoogleCalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: "needsAction" | "declined" | "tentative" | "accepted";
  self?: boolean;
  organizer?: boolean;
}

export type GoogleEventType =
  | "default"
  | "workingLocation"
  | "focusTime"
  | "outOfOffice"
  | "fromGmail"
  | "birthday";

export interface GoogleCalendarEvent {
  id: string;
  status: "confirmed" | "tentative" | "cancelled";
  eventType?: GoogleEventType;
  summary?: string;
  description?: string;
  location?: string;
  start: GoogleEventDateTime;
  end: GoogleEventDateTime;
  created: string;
  updated: string;
  colorId?: string;
  recurringEventId?: string;
  attendees?: GoogleCalendarAttendee[];
}

export interface GoogleEventsListResponse {
  kind: "calendar#events";
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export interface GoogleApiError {
  error: {
    code: number;
    message: string;
    errors: Array<{
      domain: string;
      reason: string;
      message: string;
    }>;
  };
}

export type SyncStatus = "synced" | "pending" | "conflict" | "error";
