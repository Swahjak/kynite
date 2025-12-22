"use client";

import { Info } from "lucide-react";
import type { TodayStats } from "../interfaces";

interface GridFooterProps {
  todayStats: TodayStats;
}

export function GridFooter({ todayStats }: GridFooterProps) {
  return (
    <div className="flex items-center justify-between border-t bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/50">
      {/* Info hint */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Info className="h-4 w-4" />
        <span>Tap cells to update status</span>
      </div>

      {/* Today's Stats */}
      <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 shadow-sm dark:bg-slate-800">
        <span className="text-xs font-medium tracking-wider text-slate-400 uppercase">
          Today&apos;s Stars
        </span>
        <span className="text-lg font-bold text-slate-900 dark:text-white">
          {todayStats.completed}/{todayStats.total}
        </span>
      </div>
    </div>
  );
}
