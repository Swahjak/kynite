import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { isUserFamilyMember } from "@/server/services/family-service";
import {
  getChartWithDetails,
  getCompletionsForDateRange,
} from "@/server/services/reward-chart-service";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isToday,
  isWeekend,
  isBefore,
  startOfDay,
} from "date-fns";

type Params = { params: Promise<{ familyId: string; chartId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, chartId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a member of this family" },
        },
        { status: 403 }
      );
    }

    const chart = await getChartWithDetails(chartId);

    if (!chart) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Chart not found" },
        },
        { status: 404 }
      );
    }

    if (chart.familyId !== familyId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Chart does not belong to this family",
          },
        },
        { status: 403 }
      );
    }

    // Calculate week boundaries (Monday-Sunday)
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const startDateStr = format(weekStart, "yyyy-MM-dd");
    const endDateStr = format(weekEnd, "yyyy-MM-dd");

    // Get completions for the week
    const completions = await getCompletionsForDateRange(
      chartId,
      startDateStr,
      endDateStr
    );

    // Build days array
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd }).map(
      (date) => ({
        date: format(date, "yyyy-MM-dd"),
        dayOfWeek: date.getDay(),
        dayName: format(date, "EEE"),
        dayNumber: date.getDate(),
        isToday: isToday(date),
        isWeekend: isWeekend(date),
      })
    );

    // Build task rows with cells
    const todayStr = format(now, "yyyy-MM-dd");
    const today = startOfDay(now);

    const tasks = chart.tasks.map((task) => {
      const taskDays: number[] = JSON.parse(task.daysOfWeek);

      const cells = days.map((day) => {
        const dayDate = new Date(day.date);
        const isApplicable = taskDays.includes(day.dayOfWeek);
        const completion = completions.find(
          (c) => c.taskId === task.id && c.date === day.date
        );

        let status: string;
        if (!isApplicable) {
          status = "not_applicable";
        } else if (completion?.status === "completed") {
          status = "completed";
        } else if (day.date === todayStr) {
          status = "pending";
        } else if (isBefore(dayDate, today)) {
          status = "missed";
        } else {
          status = "future";
        }

        return {
          date: day.date,
          status,
          completion: completion ?? null,
          isApplicable,
        };
      });

      return { task, cells };
    });

    // Calculate today's stats
    const todayTasks = chart.tasks.filter((task) => {
      const taskDays: number[] = JSON.parse(task.daysOfWeek);
      return taskDays.includes(now.getDay());
    });

    const todayCompletions = completions.filter(
      (c) => c.date === todayStr && c.status === "completed"
    );

    const todayStats = {
      completed: todayCompletions.length,
      total: todayTasks.length,
    };

    return NextResponse.json({
      success: true,
      data: {
        chart,
        weekStart: startDateStr,
        weekEnd: endDateStr,
        days,
        tasks,
        todayStats,
      },
    });
  } catch (error) {
    console.error("Error getting weekly chart data:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get weekly chart data",
        },
      },
      { status: 500 }
    );
  }
}
