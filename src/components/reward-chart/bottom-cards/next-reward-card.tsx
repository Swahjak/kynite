"use client";

import { cn } from "@/lib/utils";
import { Medal, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IRewardChartGoal } from "../interfaces";

interface NextRewardCardProps {
  goal: IRewardChartGoal | null;
  onViewRewards?: () => void;
  className?: string;
}

export function NextRewardCard({
  goal,
  onViewRewards,
  className,
}: NextRewardCardProps) {
  if (!goal) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800",
          className
        )}
      >
        <div className="text-center text-slate-500">No reward set yet</div>
      </div>
    );
  }

  const progressPercent = Math.min(
    100,
    Math.round((goal.starsCurrent / goal.starTarget) * 100)
  );

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800",
        className
      )}
    >
      {/* Glow effect */}
      <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-amber-50 opacity-60 blur-3xl dark:bg-amber-900/20" />

      {/* Header */}
      <div className="relative flex items-center gap-2">
        <Medal className="h-5 w-5 text-amber-500" />
        <span className="font-display text-lg font-bold text-slate-900 dark:text-white">
          Next Reward
        </span>
        <span className="ml-auto rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-400 dark:bg-slate-700">
          {goal.starTarget} STARS
        </span>
      </div>

      {/* Reward Display */}
      <div className="relative mt-4 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30">
          <span className="text-3xl">{goal.emoji}</span>
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            {goal.title}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            You&apos;re getting closer!
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="relative mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">
            {goal.starsCurrent} / {goal.starTarget}
          </span>
          <span className="font-bold text-amber-500">{progressPercent}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Action Button */}
      {onViewRewards && (
        <Button
          variant="default"
          className="mt-4 w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
          onClick={onViewRewards}
        >
          View All Rewards
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
