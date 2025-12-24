import type {
  DashboardData,
  DashboardEvent,
  DashboardChore,
  FamilyMemberStar,
  ChoreUrgency,
} from "./types";
// Keep MOCK_DASHBOARD_DATA for activeTimers and quickActions until those features are implemented
import { MOCK_DASHBOARD_DATA } from "./mocks";
import {
  getUserFamily,
  getFamilyMembers,
} from "@/server/services/family-service";
import { getEventsForFamily } from "@/server/services/event-service";
import { getChartsForFamily } from "@/server/services/reward-chart-service";
import { getChoresForFamily } from "@/server/services/chore-service";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, format } from "date-fns";
import { db } from "@/server/db";
import { rewardChartTasks, rewardChartCompletions } from "@/server/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import type { IChoreWithAssignee } from "@/types/chore";

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

function calculateChoreUrgency(
  chore: IChoreWithAssignee,
  now: Date
): ChoreUrgency {
  if (chore.status !== "pending") return "none";
  if (chore.isUrgent) return "urgent";
  if (!chore.dueDate) return "none";

  // Combine date and time for comparison
  let dueDateTime: Date;
  if (chore.dueTime) {
    dueDateTime = new Date(`${chore.dueDate}T${chore.dueTime}:00`);
  } else {
    dueDateTime = new Date(`${chore.dueDate}T23:59:59`);
  }

  if (dueDateTime < now) return "overdue";

  // Due within 4 hours
  const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  if (dueDateTime < fourHoursLater) return "due-soon";

  return "none";
}

function mapChoreToDashboardChore(
  chore: IChoreWithAssignee,
  now: Date
): DashboardChore {
  const urgency = calculateChoreUrgency(chore, now);

  return {
    id: chore.id,
    title: chore.title,
    dueTime: chore.dueTime,
    urgency,
    assignee: chore.assignedTo
      ? {
          name:
            chore.assignedTo.displayName ??
            chore.assignedTo.user.name ??
            "Unknown",
          avatarColor: chore.assignedTo.avatarColor ?? "#888888",
        }
      : null,
    starReward: chore.starReward,
  };
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const family = await getUserFamily(userId);

  if (!family) {
    // User has no family - return empty dashboard
    return {
      familyName: "",
      todaysEvents: [],
      todaysChores: [],
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

  const today = format(now, "yyyy-MM-dd");

  // Fetch events, chores, and members in parallel
  const [events, todaysPendingChores, members, chartsData] = await Promise.all([
    getEventsForFamily(family.id, {
      startDate: todayStart,
      endDate: todayEnd,
    }),
    getChoresForFamily(family.id, {
      status: "pending",
      startDate: today,
      endDate: today,
    }),
    getFamilyMembers(family.id),
    getChartsForFamily(family.id),
  ]);

  // Map chores to dashboard format and sort by urgency
  const todaysChores = todaysPendingChores
    .map((chore) => mapChoreToDashboardChore(chore, now))
    .sort((a, b) => {
      const urgencyOrder: Record<ChoreUrgency, number> = {
        overdue: 0,
        urgent: 1,
        "due-soon": 2,
        none: 3,
      };
      const orderDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (orderDiff !== 0) return orderDiff;
      // Same urgency: sort by time
      if (a.dueTime && b.dueTime) {
        return a.dueTime.localeCompare(b.dueTime);
      }
      return 0;
    });

  if (chartsData.length === 0) {
    // No charts, return members with 0 stars
    const familyMembers: FamilyMemberStar[] = members.map((member) => ({
      id: member.id,
      name: member.displayName || member.user?.name || "Unknown",
      avatarColor: member.avatarColor || "#888888",
      weeklyStarCount: 0,
      level: 1,
      levelTitle: "Beginner",
    }));

    return {
      familyName: family.name,
      todaysEvents: events
        .map((event) => mapEventToDashboardEvent(event, now))
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime()),
      todaysChores,
      activeTimers: MOCK_DASHBOARD_DATA.activeTimers,
      familyMembers,
      quickActions: MOCK_DASHBOARD_DATA.quickActions,
    };
  }

  // Fetch all tasks for all charts in a single query
  const chartIds = chartsData.map((c) => c.chart.id);
  const allTasks = await db
    .select()
    .from(rewardChartTasks)
    .where(
      and(
        inArray(rewardChartTasks.chartId, chartIds),
        eq(rewardChartTasks.isActive, true)
      )
    );

  // Create maps for quick lookup
  const taskStarValueMap = new Map(
    allTasks.map((task) => [task.id, task.starValue])
  );
  const taskToChartMap = new Map(
    allTasks.map((task) => [task.id, task.chartId])
  );

  // Fetch all completions for the week in a single query
  const taskIds = allTasks.map((t) => t.id);
  const allCompletions =
    taskIds.length > 0
      ? await db
          .select()
          .from(rewardChartCompletions)
          .where(
            and(
              inArray(rewardChartCompletions.taskId, taskIds),
              gte(rewardChartCompletions.date, format(weekStart, "yyyy-MM-dd")),
              lte(rewardChartCompletions.date, format(weekEnd, "yyyy-MM-dd"))
            )
          )
      : [];

  // Group completions by chartId
  const completionsByChart = new Map<string, typeof allCompletions>();
  for (const completion of allCompletions) {
    const chartId = taskToChartMap.get(completion.taskId);
    if (chartId) {
      if (!completionsByChart.has(chartId)) {
        completionsByChart.set(chartId, []);
      }
      completionsByChart.get(chartId)!.push(completion);
    }
  }

  // Calculate weekly stars for each member
  const familyMembers: FamilyMemberStar[] = members.map((member) => {
    let weeklyStarCount = 0;

    // Find chart for this member
    const chartEntry = chartsData.find((c) => c.chart.memberId === member.id);

    if (chartEntry) {
      const completions = completionsByChart.get(chartEntry.chart.id) ?? [];

      // Sum the starValue from each completed task
      weeklyStarCount = completions
        .filter((c) => c.status === "completed")
        .reduce((sum, completion) => {
          // Look up the starValue for this task
          const starValue = taskStarValueMap.get(completion.taskId) ?? 1;
          return sum + starValue;
        }, 0);
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
  });

  const todaysEvents = events
    .map((event) => mapEventToDashboardEvent(event, now))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return {
    familyName: family.name,
    todaysEvents,
    todaysChores,
    activeTimers: MOCK_DASHBOARD_DATA.activeTimers,
    familyMembers,
    quickActions: MOCK_DASHBOARD_DATA.quickActions,
  };
}
