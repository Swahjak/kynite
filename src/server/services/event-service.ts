import { db } from "@/server/db";
import {
  events,
  eventParticipants,
  familyMembers,
  users,
  googleCalendars,
  accounts,
} from "@/server/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type {
  CreateEventInput,
  UpdateEventInput,
  EventQueryInput,
} from "@/lib/validations/event";

// Privacy utility functions
interface EventWithCalendar {
  calendar: {
    isPrivate: boolean;
    accountUserId: string;
  } | null;
}

export function shouldRedactEvent(
  event: EventWithCalendar,
  viewerUserId?: string
): boolean {
  if (!event.calendar) return false;
  if (!event.calendar.isPrivate) return false;
  if (!viewerUserId) return true;
  return event.calendar.accountUserId !== viewerUserId;
}

export function redactEventDetails<
  T extends {
    title: string;
    description: string | null;
    location: string | null;
    isHidden: boolean;
  },
>(event: T): T {
  return {
    ...event,
    title: "Hidden",
    description: null,
    location: null,
    isHidden: true,
  };
}

export interface EventWithParticipants {
  id: string;
  familyId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  color: string | null;
  googleCalendarId: string | null;
  googleEventId: string | null;
  syncStatus: string | null;
  eventType: string | null;
  calendarName: string | null;
  calendarColor: string | null;
  accessRole: string | null;
  isHidden: boolean; // true when event is from a private calendar and viewer is not owner
  participants: {
    id: string;
    familyMemberId: string;
    displayName: string | null;
    avatarColor: string | null;
    avatarSvg: string | null;
    userName: string;
    userImage: string | null;
    isOwner: boolean;
  }[];
}

export async function getEventsForFamily(
  familyId: string,
  query?: EventQueryInput,
  viewerUserId?: string // NEW: for privacy filtering
): Promise<EventWithParticipants[]> {
  const conditions = [eq(events.familyId, familyId)];

  if (query?.startDate) {
    conditions.push(gte(events.startTime, query.startDate));
  }
  if (query?.endDate) {
    conditions.push(lte(events.endTime, query.endDate));
  }
  if (query?.colors && query.colors.length > 0) {
    conditions.push(inArray(events.color, query.colors));
  }

  const eventRows = await db
    .select({
      event: events,
      calendar: googleCalendars,
      calendarIsPrivate: googleCalendars.isPrivate,
      calendarAccountUserId: accounts.userId,
    })
    .from(events)
    .leftJoin(googleCalendars, eq(events.googleCalendarId, googleCalendars.id))
    .leftJoin(accounts, eq(googleCalendars.accountId, accounts.id))
    .where(and(...conditions))
    .orderBy(events.startTime);

  const eventIds = eventRows.map((r) => r.event.id);
  if (eventIds.length === 0) return [];

  const participantRows = await db
    .select({
      eventParticipant: eventParticipants,
      familyMember: familyMembers,
      user: users,
    })
    .from(eventParticipants)
    .innerJoin(
      familyMembers,
      eq(eventParticipants.familyMemberId, familyMembers.id)
    )
    .innerJoin(users, eq(familyMembers.userId, users.id))
    .where(inArray(eventParticipants.eventId, eventIds));

  const participantsByEvent = new Map<
    string,
    EventWithParticipants["participants"]
  >();
  for (const row of participantRows) {
    const eventId = row.eventParticipant.eventId;
    if (!participantsByEvent.has(eventId)) {
      participantsByEvent.set(eventId, []);
    }
    participantsByEvent.get(eventId)!.push({
      id: row.eventParticipant.id,
      familyMemberId: row.familyMember.id,
      displayName: row.familyMember.displayName,
      avatarColor: row.familyMember.avatarColor,
      avatarSvg: row.familyMember.avatarSvg,
      userName: row.user.name,
      userImage: row.user.image,
      isOwner: row.eventParticipant.isOwner,
    });
  }

  let result = eventRows.map((row) => ({
    id: row.event.id,
    familyId: row.event.familyId,
    title: row.event.title,
    description: row.event.description,
    location: row.event.location,
    startTime: row.event.startTime,
    endTime: row.event.endTime,
    allDay: row.event.allDay,
    color: row.event.color,
    eventType: row.event.eventType,
    googleCalendarId: row.event.googleCalendarId,
    googleEventId: row.event.googleEventId,
    syncStatus: row.event.syncStatus,
    calendarName: row.calendar?.name ?? null,
    calendarColor: row.calendar?.color ?? null,
    accessRole: row.calendar?.accessRole ?? null,
    isHidden: false,
    participants: participantsByEvent.get(row.event.id) ?? [],
  }));

  // Filter by participant if requested
  if (query?.participantIds && query.participantIds.length > 0) {
    result = result.filter((event) =>
      event.participants.some((p) =>
        query.participantIds!.includes(p.familyMemberId)
      )
    );
  }

  // Apply privacy filtering
  return result.map((event) => {
    const eventRow = eventRows.find((r) => r.event.id === event.id);
    const calendarInfo =
      eventRow?.calendarIsPrivate !== undefined
        ? {
            isPrivate: eventRow.calendarIsPrivate ?? false,
            accountUserId: eventRow.calendarAccountUserId ?? "",
          }
        : null;

    if (shouldRedactEvent({ calendar: calendarInfo }, viewerUserId)) {
      return redactEventDetails({ ...event, isHidden: true });
    }
    return { ...event, isHidden: false };
  });
}

export async function getEventById(
  eventId: string,
  familyId: string,
  viewerUserId?: string
): Promise<EventWithParticipants | null> {
  const eventRows = await db
    .select({
      event: events,
      calendar: googleCalendars,
      calendarIsPrivate: googleCalendars.isPrivate,
      calendarAccountUserId: accounts.userId,
    })
    .from(events)
    .leftJoin(googleCalendars, eq(events.googleCalendarId, googleCalendars.id))
    .leftJoin(accounts, eq(googleCalendars.accountId, accounts.id))
    .where(and(eq(events.id, eventId), eq(events.familyId, familyId)))
    .limit(1);

  if (eventRows.length === 0) return null;

  const row = eventRows[0];

  const participantRows = await db
    .select({
      eventParticipant: eventParticipants,
      familyMember: familyMembers,
      user: users,
    })
    .from(eventParticipants)
    .innerJoin(
      familyMembers,
      eq(eventParticipants.familyMemberId, familyMembers.id)
    )
    .innerJoin(users, eq(familyMembers.userId, users.id))
    .where(eq(eventParticipants.eventId, eventId));

  const result = {
    id: row.event.id,
    familyId: row.event.familyId,
    title: row.event.title,
    description: row.event.description,
    location: row.event.location,
    startTime: row.event.startTime,
    endTime: row.event.endTime,
    allDay: row.event.allDay,
    color: row.event.color,
    eventType: row.event.eventType,
    googleCalendarId: row.event.googleCalendarId,
    googleEventId: row.event.googleEventId,
    syncStatus: row.event.syncStatus,
    calendarName: row.calendar?.name ?? null,
    calendarColor: row.calendar?.color ?? null,
    accessRole: row.calendar?.accessRole ?? null,
    isHidden: false,
    participants: participantRows.map((p) => ({
      id: p.eventParticipant.id,
      familyMemberId: p.familyMember.id,
      displayName: p.familyMember.displayName,
      avatarColor: p.familyMember.avatarColor,
      avatarSvg: p.familyMember.avatarSvg,
      userName: p.user.name,
      userImage: p.user.image,
      isOwner: p.eventParticipant.isOwner,
    })),
  };

  // Apply privacy filtering
  const calendarInfo =
    row.calendarIsPrivate !== undefined
      ? {
          isPrivate: row.calendarIsPrivate ?? false,
          accountUserId: row.calendarAccountUserId ?? "",
        }
      : null;

  if (shouldRedactEvent({ calendar: calendarInfo }, viewerUserId)) {
    return redactEventDetails({ ...result, isHidden: true });
  }

  return { ...result, isHidden: false };
}

export async function createEvent(
  familyId: string,
  input: CreateEventInput,
  creatorMemberId: string
): Promise<EventWithParticipants> {
  const eventId = createId();

  await db.insert(events).values({
    id: eventId,
    familyId,
    title: input.title,
    description: input.description ?? null,
    location: input.location ?? null,
    startTime: input.startTime,
    endTime: input.endTime,
    allDay: input.allDay,
    color: input.color ?? null,
    googleCalendarId: input.googleCalendarId ?? null,
    syncStatus: input.googleCalendarId ? "pending" : "synced",
    localUpdatedAt: new Date(),
  });

  // Add participants
  const participantValues = input.participantIds.map((memberId) => ({
    id: createId(),
    eventId,
    familyMemberId: memberId,
    isOwner: memberId === creatorMemberId,
  }));

  await db.insert(eventParticipants).values(participantValues);

  const created = await getEventById(eventId, familyId);
  if (!created) throw new Error("Failed to create event");

  return created;
}

export async function updateEvent(
  eventId: string,
  familyId: string,
  input: Partial<CreateEventInput>
): Promise<EventWithParticipants> {
  const existing = await getEventById(eventId, familyId);
  if (!existing) throw new Error("Event not found");

  // Check if event is read-only (from read-only Google Calendar)
  if (existing.accessRole === "reader") {
    throw new Error("Cannot edit events from read-only calendars");
  }

  await db
    .update(events)
    .set({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.startTime !== undefined && { startTime: input.startTime }),
      ...(input.endTime !== undefined && { endTime: input.endTime }),
      ...(input.allDay !== undefined && { allDay: input.allDay }),
      ...(input.color !== undefined && { color: input.color }),
      syncStatus: existing.googleCalendarId ? "pending" : "synced",
      localUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId));

  // Update participants if provided
  if (input.participantIds) {
    await db
      .delete(eventParticipants)
      .where(eq(eventParticipants.eventId, eventId));

    const participantValues = input.participantIds.map((memberId) => ({
      id: createId(),
      eventId,
      familyMemberId: memberId,
      isOwner:
        existing.participants.find((p) => p.isOwner)?.familyMemberId ===
        memberId,
    }));

    await db.insert(eventParticipants).values(participantValues);
  }

  const updated = await getEventById(eventId, familyId);
  if (!updated) throw new Error("Failed to update event");

  return updated;
}

export async function deleteEvent(
  eventId: string,
  familyId: string
): Promise<void> {
  const existing = await getEventById(eventId, familyId);
  if (!existing) throw new Error("Event not found");

  // Check if event is read-only
  if (existing.accessRole === "reader") {
    throw new Error("Cannot delete events from read-only calendars");
  }

  // Cascade will handle eventParticipants
  await db.delete(events).where(eq(events.id, eventId));
}

export async function isEventEditable(
  eventId: string,
  familyId: string
): Promise<boolean> {
  const event = await getEventById(eventId, familyId);
  if (!event) return false;
  return event.accessRole !== "reader";
}
