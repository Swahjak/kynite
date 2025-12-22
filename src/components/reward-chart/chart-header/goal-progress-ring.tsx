"use client";

import { cn } from "@/lib/utils";
import type { IRewardChartGoal } from "../interfaces";

interface GoalProgressRingProps {
  goal: IRewardChartGoal | null;
  className?: string;
}

export function GoalProgressRing({ goal, className }: GoalProgressRingProps) {
  if (!goal) {
    return (
      <div
        className={cn(
          "flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800",
          className
        )}
      >
        <div className="text-sm text-slate-500">No active goal</div>
      </div>
    );
  }

  const progressPercent = Math.min(
    100,
    Math.round((goal.starsCurrent / goal.starTarget) * 100)
  );
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progressPercent / 100) * circumference;

  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800",
        className
      )}
    >
      {/* Progress Ring */}
      <div className="relative h-20 w-20">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
          {/* Track */}
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-slate-100 dark:text-slate-700"
          />
          {/* Progress */}
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-amber-400 transition-all duration-500 ease-out"
          />
        </svg>
        {/* Center Number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">
            {goal.starsCurrent}
          </span>
        </div>
      </div>

      {/* Goal Info */}
      <div className="flex-1">
        <div className="text-xs font-medium tracking-wider text-slate-400 uppercase">
          Current Goal
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xl">{goal.emoji}</span>
          <span className="text-lg font-bold text-slate-900 dark:text-white">
            {goal.title}
          </span>
        </div>
        {/* Progress Bar */}
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-amber-400 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {goal.starsCurrent} / {goal.starTarget} stars
          </span>
          <span className="font-bold text-amber-500">{progressPercent}%</span>
        </div>
      </div>
    </div>
  );
}
