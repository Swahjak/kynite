import { db } from "@/server/db";
import {
  googleCalendars,
  events,
  eventParticipants,
  familyMembers,
  users,
} from "@/server/schema";
import { eq, and, isNull, or, lt, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { getValidAccessToken } from "./google-token-service";
import {
  GoogleCalendarClient,
  GoogleCalendarApiError,
} from "./google-calendar-client";
import type {
  GoogleCalendarEvent,
  GoogleEventType,
} from "@/types/google-calendar";

const SYNC_RANGE = {
  pastMonths: 3,
  futureMonths: 12,
};

// Event types that represent status/availability rather than actual events
const STATUS_EVENT_TYPES: GoogleEventType[] = [
  "workingLocation",
  "focusTime",
  "outOfOffice",
];

/**
 * Check if event type is a status event (working location, focus time, etc.)
 * These should be filtered out as they're not actual calendar events
 */
function isStatusEvent(eventType?: GoogleEventType): boolean {
  return eventType !== undefined && STATUS_EVENT_TYPES.includes(eventType);
}

interface SyncResult {
  calendarId: string;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  error?: string;
}

/**
 * Perform initial sync for a newly linked calendar
 */
export async function performInitialSync(
  calendarId: string
): Promise<SyncResult> {
  const calendar = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.id, calendarId))
    .limit(1);

  if (calendar.length === 0) {
    return {
      calendarId,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      error: "Calendar not found",
    };
  }

  const cal = calendar[0];
  const accessToken = await getValidAccessToken(cal.accountId);

  if (!accessToken) {
    return {
      calendarId,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      error: "Invalid token",
    };
  }

  const client = new GoogleCalendarClient(accessToken);
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setMonth(timeMin.getMonth() - SYNC_RANGE.pastMonths);
  const timeMax = new Date(now);
  timeMax.setMonth(timeMax.getMonth() + SYNC_RANGE.futureMonths);

  let eventsCreated = 0;
  let pageToken: string | undefined;
  let syncToken: string | undefined;

  try {
    do {
      const response = await client.listEvents(cal.googleCalendarId, {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: 250,
        pageToken,
      });

      for (const googleEvent of response.items) {
        if (googleEvent.status === "cancelled") continue;
        // Skip status events (working location, focus time, out of office)
        if (isStatusEvent(googleEvent.eventType)) continue;

        await upsertEventFromGoogle(cal.familyId, calendarId, googleEvent);
        eventsCreated++;
      }

      pageToken = response.nextPageToken;
      if (!pageToken) {
        syncToken = response.nextSyncToken;
      }
    } while (pageToken);

    // Save sync token for incremental sync
    await db
      .update(googleCalendars)
      .set({
        syncCursor: syncToken,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(googleCalendars.id, calendarId));

    return { calendarId, eventsCreated, eventsUpdated: 0, eventsDeleted: 0 };
  } catch (error) {
    console.error("Initial sync failed:", error);
    return {
      calendarId,
      eventsCreated,
      eventsUpdated: 0,
      eventsDeleted: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Perform incremental sync using stored sync token
 */
export async function performIncrementalSync(
  calendarId: string
): Promise<SyncResult> {
  const calendar = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.id, calendarId))
    .limit(1);

  if (calendar.length === 0) {
    return {
      calendarId,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      error: "Calendar not found",
    };
  }

  const cal = calendar[0];

  // No sync token = need initial sync
  if (!cal.syncCursor) {
    return performInitialSync(calendarId);
  }

  const accessToken = await getValidAccessToken(cal.accountId);
  if (!accessToken) {
    return {
      calendarId,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      error: "Invalid token",
    };
  }

  const client = new GoogleCalendarClient(accessToken);
  let eventsCreated = 0;
  let eventsUpdated = 0;
  let eventsDeleted = 0;
  let pageToken: string | undefined;
  let syncToken = cal.syncCursor;

  try {
    do {
      const response = await client.listEvents(cal.googleCalendarId, {
        syncToken,
        pageToken,
      });

      for (const googleEvent of response.items) {
        if (googleEvent.status === "cancelled") {
          await deleteEventByGoogleId(calendarId, googleEvent.id);
          eventsDeleted++;
        } else if (isStatusEvent(googleEvent.eventType)) {
          // Skip status events (working location, focus time, out of office)
          continue;
        } else {
          const result = await upsertEventFromGoogle(
            cal.familyId,
            calendarId,
            googleEvent
          );
          if (result === "created") eventsCreated++;
          else eventsUpdated++;
        }
      }

      pageToken = response.nextPageToken;
      if (!pageToken && response.nextSyncToken) {
        syncToken = response.nextSyncToken;
      }
    } while (pageToken);

    await db
      .update(googleCalendars)
      .set({
        syncCursor: syncToken,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(googleCalendars.id, calendarId));

    return { calendarId, eventsCreated, eventsUpdated, eventsDeleted };
  } catch (error) {
    if (error instanceof GoogleCalendarApiError && error.requiresFullSync) {
      // 410 Gone - need full sync
      await db
        .update(googleCalendars)
        .set({ syncCursor: null, updatedAt: new Date() })
        .where(eq(googleCalendars.id, calendarId));
      return performInitialSync(calendarId);
    }

    console.error("Incremental sync failed:", error);
    return {
      calendarId,
      eventsCreated,
      eventsUpdated,
      eventsDeleted,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Convert Google event to local event and upsert
 */
async function upsertEventFromGoogle(
  familyId: string,
  googleCalendarId: string,
  googleEvent: GoogleCalendarEvent
): Promise<"created" | "updated"> {
  const startTime = googleEvent.start.dateTime
    ? new Date(googleEvent.start.dateTime)
    : new Date(googleEvent.start.date + "T00:00:00");

  const endTime = googleEvent.end.dateTime
    ? new Date(googleEvent.end.dateTime)
    : new Date(googleEvent.end.date + "T00:00:00");

  const allDay = !googleEvent.start.dateTime;

  // Check if event exists
  const existing = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.googleCalendarId, googleCalendarId),
        eq(events.googleEventId, googleEvent.id)
      )
    )
    .limit(1);

  let eventId: string;
  let result: "created" | "updated";

  if (existing.length > 0) {
    eventId = existing[0].id;
    await db
      .update(events)
      .set({
        title: googleEvent.summary || "(No title)",
        description: googleEvent.description,
        location: googleEvent.location,
        startTime,
        endTime,
        allDay,
        remoteUpdatedAt: new Date(googleEvent.updated),
        syncStatus: "synced",
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));
    result = "updated";
  } else {
    eventId = createId();
    await db.insert(events).values({
      id: eventId,
      familyId,
      title: googleEvent.summary || "(No title)",
      description: googleEvent.description,
      location: googleEvent.location,
      startTime,
      endTime,
      allDay,
      googleCalendarId,
      googleEventId: googleEvent.id,
      remoteUpdatedAt: new Date(googleEvent.updated),
      syncStatus: "synced",
    });
    result = "created";
  }

  // Sync attendees to event participants
  await syncEventParticipants(eventId, familyId, googleEvent.attendees);

  return result;
}

/**
 * Match Google Calendar attendees to family members and sync participants
 */
async function syncEventParticipants(
  eventId: string,
  familyId: string,
  attendees?: { email: string; organizer?: boolean }[]
): Promise<void> {
  // Delete existing participants for this event (we'll recreate from Google data)
  await db
    .delete(eventParticipants)
    .where(eq(eventParticipants.eventId, eventId));

  if (!attendees || attendees.length === 0) {
    return;
  }

  // Get family members with their user emails
  const members = await db
    .select({
      memberId: familyMembers.id,
      email: users.email,
    })
    .from(familyMembers)
    .innerJoin(users, eq(familyMembers.userId, users.id))
    .where(eq(familyMembers.familyId, familyId));

  if (members.length === 0) {
    return;
  }

  // Create email to member ID map (case-insensitive)
  const emailToMember = new Map(
    members.map((m) => [m.email.toLowerCase(), m.memberId])
  );

  // Match attendees to family members
  const participantsToCreate: {
    eventId: string;
    familyMemberId: string;
    isOwner: boolean;
  }[] = [];

  for (const attendee of attendees) {
    const memberId = emailToMember.get(attendee.email.toLowerCase());
    if (memberId) {
      participantsToCreate.push({
        eventId,
        familyMemberId: memberId,
        isOwner: attendee.organizer ?? false,
      });
    }
  }

  // Insert matched participants
  if (participantsToCreate.length > 0) {
    await db.insert(eventParticipants).values(
      participantsToCreate.map((p) => ({
        id: createId(),
        ...p,
      }))
    );
  }
}

/**
 * Delete event by Google ID
 */
async function deleteEventByGoogleId(
  googleCalendarId: string,
  googleEventId: string
): Promise<void> {
  await db
    .delete(events)
    .where(
      and(
        eq(events.googleCalendarId, googleCalendarId),
        eq(events.googleEventId, googleEventId)
      )
    );
}

/**
 * Get calendars that need syncing (older than interval or never synced)
 */
export async function getCalendarsNeedingSync(intervalMinutes: number = 15) {
  const threshold = new Date(Date.now() - intervalMinutes * 60 * 1000);

  return db
    .select()
    .from(googleCalendars)
    .where(
      and(
        eq(googleCalendars.syncEnabled, true),
        or(
          isNull(googleCalendars.lastSyncedAt),
          lt(googleCalendars.lastSyncedAt, threshold)
        )
      )
    );
}
