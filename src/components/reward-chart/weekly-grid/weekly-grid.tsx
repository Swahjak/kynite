"use client";

import { cn } from "@/lib/utils";
import { DayHeader } from "./day-header";
import { TaskRow } from "./task-row";
import { GridFooter } from "./grid-footer";
import { useRewardChart } from "../contexts/reward-chart-context";

interface WeeklyGridProps {
  className?: string;
}

export function WeeklyGrid({ className }: WeeklyGridProps) {
  const { weekData, completeTask, undoCompletion, isLoading } =
    useRewardChart();

  if (!weekData) {
    return (
      <div
        className={cn(
          "rounded-3xl bg-white p-8 shadow-sm dark:bg-slate-800",
          className
        )}
      >
        <p className="text-center text-slate-500">No chart data available</p>
      </div>
    );
  }

  const { days, tasks, todayStats } = weekData;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-slate-800",
        className
      )}
    >
      {/* Header Row */}
      <div className="grid grid-cols-[1.8fr_repeat(7,1fr)] border-b bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50">
        {/* Task/Routine label */}
        <div className="flex items-center px-4 py-3">
          <span className="text-xs font-medium tracking-wider text-slate-400 uppercase">
            Task / Routine
          </span>
        </div>

        {/* Day headers */}
        {days.map((day) => (
          <DayHeader key={day.date} day={day} />
        ))}
      </div>

      {/* Task Rows */}
      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
        {tasks.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500">
            No tasks configured yet
          </div>
        ) : (
          tasks.map((taskRow) => (
            <TaskRow
              key={taskRow.task.id}
              taskRow={taskRow}
              days={days}
              onComplete={completeTask}
              onUndo={undoCompletion}
              disabled={isLoading}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <GridFooter todayStats={todayStats} />
    </div>
  );
}
