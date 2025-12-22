import { setRequestLocale } from "next-intl/server";
import {
  RewardChartPage,
  RewardChartProvider,
} from "@/components/reward-chart";
import {
  getChartByMemberId,
  getChartWithDetails,
} from "@/server/services/reward-chart-service";
import { getFamilyMemberByUserId } from "@/server/services/family-service";
import { getSession } from "@/lib/get-session";
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
import { getCompletionsForDateRange } from "@/server/services/reward-chart-service";
import type { Locale } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function RewardChartRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  // Session and family are guaranteed by (app) layout
  const session = await getSession();
  const familyId = session!.session.familyId!;

  // Get member
  const member = await getFamilyMemberByUserId(session!.user.id, familyId);
  if (!member) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-lg font-medium text-slate-600">Member not found</p>
      </div>
    );
  }

  // Get chart for this member
  const chart = await getChartByMemberId(member.id);

  if (!chart) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-slate-600">
            No star chart found
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Ask a family manager to create one for you!
          </p>
        </div>
      </div>
    );
  }

  // Get full chart data
  const chartDetails = await getChartWithDetails(chart.id);

  if (!chartDetails) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-lg font-medium text-slate-600">Chart not found</p>
      </div>
    );
  }

  // Build week data
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const startDateStr = format(weekStart, "yyyy-MM-dd");
  const endDateStr = format(weekEnd, "yyyy-MM-dd");

  const completions = await getCompletionsForDateRange(
    chart.id,
    startDateStr,
    endDateStr
  );

  const days = eachDayOfInterval({ start: weekStart, end: weekEnd }).map(
    (date) => ({
      date: format(date, "yyyy-MM-dd"),
      dayOfWeek: date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      dayName: format(date, "EEE"),
      dayNumber: date.getDate(),
      isToday: isToday(date),
      isWeekend: isWeekend(date),
    })
  );

  const todayStr = format(now, "yyyy-MM-dd");
  const today = startOfDay(now);

  const tasks = chartDetails.tasks.map((task) => {
    const taskDays: number[] = JSON.parse(task.daysOfWeek);

    const cells = days.map((day) => {
      const dayDate = new Date(day.date);
      const isApplicable = taskDays.includes(day.dayOfWeek);
      const completion = completions.find(
        (c) => c.taskId === task.id && c.date === day.date
      );

      let status:
        | "completed"
        | "pending"
        | "missed"
        | "future"
        | "not_applicable";
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

    return {
      task: {
        ...task,
        daysOfWeek: taskDays as (0 | 1 | 2 | 3 | 4 | 5 | 6)[],
        createdAt: task.createdAt,
      },
      cells,
    };
  });

  const todayTasks = chartDetails.tasks.filter((task) => {
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

  const weekData = {
    chart: {
      ...chartDetails,
      tasks: chartDetails.tasks.map((t) => ({
        ...t,
        daysOfWeek: JSON.parse(t.daysOfWeek) as (0 | 1 | 2 | 3 | 4 | 5 | 6)[],
        createdAt: t.createdAt,
      })),
      createdAt: chartDetails.createdAt,
      updatedAt: chartDetails.updatedAt,
    },
    weekStart: startDateStr,
    weekEnd: endDateStr,
    days,
    tasks,
    todayStats,
  };

  return (
    <RewardChartProvider
      familyId={familyId}
      chartId={chart.id}
      initialData={weekData}
    >
      <RewardChartPage />
    </RewardChartProvider>
  );
}
