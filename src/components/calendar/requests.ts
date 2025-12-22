import type { IEvent, IUser } from "@/components/calendar/interfaces";
import type { EventWithParticipants } from "@/server/services/event-service";
import { CALENDAR_ITEMS_MOCK, USERS_MOCK } from "@/components/calendar/mocks";

// Transform API response to calendar IEvent format
export function transformEventToIEvent(event: EventWithParticipants): IEvent {
  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    startDate: event.startTime.toISOString(),
    endDate: event.endTime.toISOString(),
    color: (event.color as IEvent["color"]) ?? "blue",
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
