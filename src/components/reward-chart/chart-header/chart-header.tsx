"use client";

import { cn } from "@/lib/utils";
import { GoalProgressRing } from "./goal-progress-ring";
import type { IRewardChart } from "../interfaces";

interface ChartHeaderProps {
  chart: IRewardChart;
  className?: string;
}

export function ChartHeader({ chart, className }: ChartHeaderProps) {
  const memberName = chart.member?.displayName ?? "Friend";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between",
        className
      )}
    >
      <div>
        {/* Badge */}
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 dark:bg-amber-950">
          <span className="text-sm">⭐</span>
          <span className="text-xs font-medium tracking-wider text-amber-600 uppercase dark:text-amber-400">
            Weekly Goals
          </span>
        </div>

        {/* Title */}
        <h1 className="font-display text-4xl font-bold text-slate-900 lg:text-5xl dark:text-white">
          Star Chart
        </h1>

        {/* Greeting */}
        <p className="mt-2 text-lg font-medium text-slate-500 dark:text-slate-400">
          Let&apos;s collect stars and earn that reward, {memberName}!
        </p>
      </div>

      {/* Goal Progress */}
      <GoalProgressRing goal={chart.activeGoal} className="lg:min-w-80" />
    </div>
  );
}
