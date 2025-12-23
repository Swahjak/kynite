import type { DashboardData, DashboardEvent, FamilyMemberStar } from "./types";
import { MOCK_DASHBOARD_DATA } from "./mocks";
import {
  getUserFamily,
  getFamilyMembers,
} from "@/server/services/family-service";
import { getEventsForFamily } from "@/server/services/event-service";
import {
  getChartsForFamily,
  getCompletionsForDateRange,
} from "@/server/services/reward-chart-service";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, format } from "date-fns";

function mapEventToDashboardEvent(
  event: {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    location: string | null;
    color: string | null;
  },
  now: Date
): DashboardEvent {
  // Calculate state based on current time
  let state: "past" | "now" | "upcoming";
  if (now >= event.endTime) {
    state = "past";
  } else if (now >= event.startTime) {
    state = "now";
  } else {
    state = "upcoming";
  }

  return {
    id: event.id,
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location ?? undefined,
    category: event.color ?? "default",
    state,
  };
}

function calculateLevel(starCount: number): {
  level: number;
  levelTitle: string;
} {
  if (starCount >= 50) return { level: 5, levelTitle: "Superstar" };
  if (starCount >= 30) return { level: 4, levelTitle: "Champion" };
  if (starCount >= 20) return { level: 3, levelTitle: "Artist" };
  if (starCount >= 10) return { level: 2, levelTitle: "Explorer" };
  return { level: 1, levelTitle: "Beginner" };
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
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // Fetch events
  const events = await getEventsForFamily(family.id, {
    startDate: todayStart,
    endDate: todayEnd,
  });

  // Fetch family members
  const members = await getFamilyMembers(family.id);

  // Fetch reward charts for family
  const chartsData = await getChartsForFamily(family.id);

  // Calculate weekly stars for each member
  const familyMembers: FamilyMemberStar[] = await Promise.all(
    members.map(async (member) => {
      const chartEntry = chartsData.find((c) => c.chart.memberId === member.id);
      let weeklyStarCount = 0;

      if (chartEntry) {
        const completions = await getCompletionsForDateRange(
          chartEntry.chart.id,
          format(weekStart, "yyyy-MM-dd"),
          format(weekEnd, "yyyy-MM-dd")
        );

        // Count completed tasks (each completion that is "completed" counts as 1 star)
        weeklyStarCount = completions.filter(
          (c) => c.status === "completed"
        ).length;
      }

      const { level, levelTitle } = calculateLevel(weeklyStarCount);

      return {
        id: member.id,
        name: member.displayName || member.user?.name || "Unknown",
        avatarColor: member.avatarColor || "#888888",
        weeklyStarCount,
        level,
        levelTitle,
      };
    })
  );

  const todaysEvents = events
    .map((event) => mapEventToDashboardEvent(event, now))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return {
    familyName: family.name,
    todaysEvents,
    activeTimers: MOCK_DASHBOARD_DATA.activeTimers,
    familyMembers,
    quickActions: MOCK_DASHBOARD_DATA.quickActions,
  };
}
