import type { IEvent, IUser } from "@/components/calendar/interfaces";
import type { EventWithParticipants } from "@/server/services/event-service";
import { CALENDAR_ITEMS_MOCK, USERS_MOCK } from "@/components/calendar/mocks";
import type { TEventColor } from "@/components/calendar/types";

// Map avatar color to event color (handles pink/teal which aren't in TEventColor)
function avatarColorToEventColor(avatarColor: string | null): TEventColor {
  const colorMap: Record<string, TEventColor> = {
    blue: "blue",
    green: "green",
    red: "red",
    yellow: "yellow",
    purple: "purple",
    orange: "orange",
    pink: "red", // Fallback
    teal: "green", // Fallback
  };
  return colorMap[avatarColor ?? ""] ?? "blue";
}

// Transform API response to calendar IEvent format
export function transformEventToIEvent(event: EventWithParticipants): IEvent {
  // Use first participant's avatar color for the event color
  const firstParticipant = event.participants[0];
  const eventColor = firstParticipant
    ? avatarColorToEventColor(firstParticipant.avatarColor)
    : "blue";

  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    startDate: new Date(event.startTime).toISOString(),
    endDate: new Date(event.endTime).toISOString(),
    color: eventColor,
    users: event.participants.map((p) => ({
      id: p.familyMemberId,
      name: p.displayName ?? p.userName,
      avatarFallback: (p.displayName ?? p.userName).slice(0, 2).toUpperCase(),
      avatarColor: p.avatarColor ?? "bg-primary",
      avatarUrl: p.userImage ?? undefined,
    })),
  };
}

// Transform family members to calendar IUser format
export function transformMemberToIUser(member: {
  id: string;
  displayName: string | null;
  avatarColor: string | null;
  user: { name: string; image: string | null };
}): IUser {
  const name = member.displayName ?? member.user.name;
  return {
    id: member.id,
    name,
    avatarFallback: name.slice(0, 2).toUpperCase(),
    avatarColor: member.avatarColor ?? "bg-primary",
    avatarUrl: member.user.image ?? undefined,
  };
}

// Legacy exports for backward compatibility during migration
export const getEvents = async () => {
  return CALENDAR_ITEMS_MOCK;
};

export const getUsers = async () => {
  return USERS_MOCK;
};
