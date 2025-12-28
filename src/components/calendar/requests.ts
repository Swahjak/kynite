import type { IEvent, IUser } from "@/components/calendar/interfaces";
import type { EventWithParticipants } from "@/server/services/event-service";
import { CALENDAR_ITEMS_MOCK, USERS_MOCK } from "@/components/calendar/mocks";
import type { TEventCategory, TEventType } from "@/components/calendar/types";

// Map string eventType from database to TEventType
function normalizeEventType(eventType: string | null): TEventType {
  const validTypes: TEventType[] = [
    "event",
    "birthday",
    "appointment",
    "task",
    "reminder",
  ];
  if (eventType && validTypes.includes(eventType as TEventType)) {
    return eventType as TEventType;
  }
  return "event";
}

// Infer category from eventType (for events from external sources without category)
function inferCategory(eventType: TEventType): TEventCategory {
  switch (eventType) {
    case "birthday":
      return "family";
    case "appointment":
      return "work";
    case "task":
      return "home";
    case "reminder":
      return "home";
    default:
      return "family";
  }
}

// Transform API response to calendar IEvent format
export function transformEventToIEvent(event: EventWithParticipants): IEvent {
  const eventType = normalizeEventType(event.eventType);
  const category = inferCategory(eventType);

  // Find the owner participant for ownerId
  const ownerParticipant = event.participants.find((p) => p.isOwner);

  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    startDate: new Date(event.startTime).toISOString(),
    endDate: new Date(event.endTime).toISOString(),
    category,
    eventType,
    allDay: event.allDay,
    isCompleted: false, // Events from calendar are not tasks with completion state
    ownerId: ownerParticipant?.familyMemberId,
    isHidden: event.isHidden,
    users: event.participants.map((p) => ({
      id: p.familyMemberId,
      name: p.displayName ?? p.userName,
      avatarFallback: (p.displayName ?? p.userName).slice(0, 2).toUpperCase(),
      avatarColor: p.avatarColor ?? null,
      avatarUrl: p.userImage ?? undefined,
      avatarSvg: p.avatarSvg,
    })),
  };
}

// Transform family members to calendar IUser format
export function transformMemberToIUser(member: {
  id: string;
  displayName: string | null;
  avatarColor: string | null;
  avatarSvg: string | null;
  user: { name: string; image: string | null };
}): IUser {
  const name = member.displayName ?? member.user.name;
  return {
    id: member.id,
    name,
    avatarFallback: name.slice(0, 2).toUpperCase(),
    avatarColor: member.avatarColor ?? null,
    avatarUrl: member.user.image ?? undefined,
    avatarSvg: member.avatarSvg,
  };
}

// Legacy exports for backward compatibility during migration
export const getEvents = async () => {
  return CALENDAR_ITEMS_MOCK;
};

export const getUsers = async () => {
  return USERS_MOCK;
};
