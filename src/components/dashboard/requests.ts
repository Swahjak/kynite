import type { DashboardData, DashboardEvent } from "./types";
import { MOCK_DASHBOARD_DATA } from "./mocks";
import { getUserFamily } from "@/server/services/family-service";
import { getEventsForFamily } from "@/server/services/event-service";
import { startOfDay, endOfDay } from "date-fns";

function mapEventToDashboardEvent(event: {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location: string | null;
  color: string | null;
}): DashboardEvent {
  return {
    id: event.id,
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location ?? undefined,
    category: event.color ?? "default",
    state: "upcoming" as const,
  };
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const family = await getUserFamily(userId);

  if (!family) {
    // User has no family - return empty dashboard
    return {
      familyName: "",
      todaysEvents: [],
      activeTimers: [],
      familyMembers: [],
      quickActions: [],
    };
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const events = await getEventsForFamily(family.id, {
    startDate: todayStart,
    endDate: todayEnd,
  });

  const todaysEvents = events
    .map(mapEventToDashboardEvent)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return {
    familyName: family.name,
    todaysEvents,
    activeTimers: MOCK_DASHBOARD_DATA.activeTimers,
    familyMembers: MOCK_DASHBOARD_DATA.familyMembers,
    quickActions: MOCK_DASHBOARD_DATA.quickActions,
  };
}
