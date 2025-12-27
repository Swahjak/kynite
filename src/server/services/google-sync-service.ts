import { db } from "@/server/db";
import {
  googleCalendars,
  events,
  eventParticipants,
  familyMembers,
  users,
  accounts,
} from "@/server/schema";
import { eq, and, isNull, isNotNull, or, lt, inArray } from "drizzle-orm";
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

// Maximum pages to process per sync run to avoid cron timeouts
// Google returns up to 250 events per page, so 2 pages = ~500 events max per run
const DEFAULT_MAX_PAGES = 2;

interface SyncOptions {
  /** Maximum number of API pages to process per run (default: 2) */
  maxPages?: number;
}

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
  /** True if sync completed, false if more pages remain */
  complete: boolean;
  error?: string;
}

/**
 * Perform initial sync for a newly linked calendar.
 * Supports pagination limits to avoid cron timeouts - will resume from
 * stored paginationToken on subsequent runs until complete.
 */
export async function performInitialSync(
  calendarId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;

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
      complete: true,
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
      complete: true,
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
  // Resume from stored pagination token if available
  let pageToken: string | undefined = cal.paginationToken ?? undefined;
  let syncToken: string | undefined;
  let pagesProcessed = 0;

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

      pagesProcessed++;
      pageToken = response.nextPageToken;

      if (!pageToken) {
        // Sync complete - save the sync token
        syncToken = response.nextSyncToken;
      } else if (pagesProcessed >= maxPages) {
        // Hit page limit - save progress for next run
        console.log(
          `Initial sync paused after ${pagesProcessed} pages for calendar ${calendarId}`
        );
        await db
          .update(googleCalendars)
          .set({
            paginationToken: pageToken,
            updatedAt: new Date(),
          })
          .where(eq(googleCalendars.id, calendarId));

        return {
          calendarId,
          eventsCreated,
          eventsUpdated: 0,
          eventsDeleted: 0,
          complete: false,
        };
      }
    } while (pageToken);

    // Sync complete - save sync token and clear pagination token
    await db
      .update(googleCalendars)
      .set({
        syncCursor: syncToken,
        paginationToken: null,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(googleCalendars.id, calendarId));

    return {
      calendarId,
      eventsCreated,
      eventsUpdated: 0,
      eventsDeleted: 0,
      complete: true,
    };
  } catch (error) {
    console.error("Initial sync failed:", error);
    return {
      calendarId,
      eventsCreated,
      eventsUpdated: 0,
      eventsDeleted: 0,
      complete: true,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Perform incremental sync using stored sync token.
 * Supports pagination limits to avoid cron timeouts - will resume from
 * stored paginationToken on subsequent runs until complete.
 */
export async function performIncrementalSync(
  calendarId: string,
  options: SyncOptions = {}
): Promise<SyncResult> {
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES;

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
      complete: true,
      error: "Calendar not found",
    };
  }

  const cal = calendar[0];

  // Has pagination token = resuming mid-initial-sync
  if (cal.paginationToken && !cal.syncCursor) {
    return performInitialSync(calendarId, options);
  }

  // No sync token and no pagination token = need fresh initial sync
  if (!cal.syncCursor) {
    return performInitialSync(calendarId, options);
  }

  const accessToken = await getValidAccessToken(cal.accountId);
  if (!accessToken) {
    return {
      calendarId,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      complete: true,
      error: "Invalid token",
    };
  }

  const client = new GoogleCalendarClient(accessToken);
  let eventsCreated = 0;
  let eventsUpdated = 0;
  let eventsDeleted = 0;
  // Resume from stored pagination token if available (for incremental sync continuation)
  let pageToken: string | undefined = cal.paginationToken ?? undefined;
  let syncToken = cal.syncCursor;
  let pagesProcessed = 0;

  try {
    do {
      const response = await client.listEvents(cal.googleCalendarId, {
        syncToken: pageToken ? undefined : syncToken, // Only use syncToken on first request
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

      pagesProcessed++;
      pageToken = response.nextPageToken;

      if (!pageToken && response.nextSyncToken) {
        syncToken = response.nextSyncToken;
      } else if (pageToken && pagesProcessed >= maxPages) {
        // Hit page limit - save progress for next run
        console.log(
          `Incremental sync paused after ${pagesProcessed} pages for calendar ${calendarId}`
        );
        await db
          .update(googleCalendars)
          .set({
            paginationToken: pageToken,
            updatedAt: new Date(),
          })
          .where(eq(googleCalendars.id, calendarId));

        return {
          calendarId,
          eventsCreated,
          eventsUpdated,
          eventsDeleted,
          complete: false,
        };
      }
    } while (pageToken);

    // Sync complete - save new sync token and clear pagination token
    await db
      .update(googleCalendars)
      .set({
        syncCursor: syncToken,
        paginationToken: null,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(googleCalendars.id, calendarId));

    return {
      calendarId,
      eventsCreated,
      eventsUpdated,
      eventsDeleted,
      complete: true,
    };
  } catch (error) {
    if (error instanceof GoogleCalendarApiError && error.requiresFullSync) {
      // 410 Gone - need full sync
      await db
        .update(googleCalendars)
        .set({ syncCursor: null, paginationToken: null, updatedAt: new Date() })
        .where(eq(googleCalendars.id, calendarId));
      return performInitialSync(calendarId, options);
    }

    console.error("Incremental sync failed:", error);
    return {
      calendarId,
      eventsCreated,
      eventsUpdated,
      eventsDeleted,
      complete: true,
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
        eventType: googleEvent.eventType ?? null,
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
      eventType: googleEvent.eventType ?? null,
      googleCalendarId,
      googleEventId: googleEvent.id,
      remoteUpdatedAt: new Date(googleEvent.updated),
      syncStatus: "synced",
    });
    result = "created";
  }

  // Sync attendees to event participants (always includes calendar owner)
  await syncEventParticipants(
    eventId,
    familyId,
    googleCalendarId,
    googleEvent.attendees
  );

  return result;
}

/**
 * Match Google Calendar attendees to family members and sync participants.
 * Always includes the calendar owner as a participant.
 */
async function syncEventParticipants(
  eventId: string,
  familyId: string,
  googleCalendarId: string,
  attendees?: { email: string; organizer?: boolean }[]
): Promise<void> {
  // Delete existing participants for this event (we'll recreate from Google data)
  await db
    .delete(eventParticipants)
    .where(eq(eventParticipants.eventId, eventId));

  // Get family members with their user emails
  const members = await db
    .select({
      memberId: familyMembers.id,
      email: users.email,
    })
    .from(familyMembers)
    .innerJoin(users, eq(familyMembers.userId, users.id))
    .where(eq(familyMembers.familyId, familyId));

  // Look up the calendar owner's family member
  const calendarOwner = await db
    .select({ memberId: familyMembers.id })
    .from(googleCalendars)
    .innerJoin(accounts, eq(googleCalendars.accountId, accounts.id))
    .innerJoin(
      familyMembers,
      and(
        eq(familyMembers.userId, accounts.userId),
        eq(familyMembers.familyId, familyId)
      )
    )
    .where(eq(googleCalendars.id, googleCalendarId))
    .limit(1);

  const calendarOwnerMemberId = calendarOwner[0]?.memberId;

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

  if (attendees && attendees.length > 0) {
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
  }

  // Always include the calendar owner as a participant (if not already matched via email)
  if (calendarOwnerMemberId) {
    const alreadyIncluded = participantsToCreate.some(
      (p) => p.familyMemberId === calendarOwnerMemberId
    );
    if (!alreadyIncluded) {
      participantsToCreate.push({
        eventId,
        familyMemberId: calendarOwnerMemberId,
        isOwner: false,
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
 * Get calendars that need syncing:
 * - Calendars with incomplete syncs (paginationToken set) - highest priority
 * - Calendars never synced
 * - Calendars synced more than intervalMinutes ago
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
          // Incomplete syncs - resume these first
          isNotNull(googleCalendars.paginationToken),
          // Never synced
          isNull(googleCalendars.lastSyncedAt),
          // Stale syncs
          lt(googleCalendars.lastSyncedAt, threshold)
        )
      )
    );
}
