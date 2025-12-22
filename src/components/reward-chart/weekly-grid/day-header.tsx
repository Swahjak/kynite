"use client";

import { cn } from "@/lib/utils";
import type { WeekDay } from "../interfaces";

interface DayHeaderProps {
  day: WeekDay;
}

export function DayHeader({ day }: DayHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-3",
        day.isToday && "relative bg-indigo-50/50 dark:bg-indigo-500/10",
        day.isWeekend && "bg-slate-50/80 dark:bg-slate-800/80"
      )}
    >
      {/* Today indicator bar */}
      {day.isToday && (
        <div className="absolute inset-x-0 top-0 h-1 bg-indigo-500" />
      )}

      {/* Day name */}
      <span
        className={cn(
          "text-[10px] font-medium tracking-wide uppercase",
          day.isWeekend ? "text-rose-500/70" : "text-slate-400"
        )}
      >
        {day.dayName}
      </span>

      {/* Day number */}
      <span
        className={cn(
          "font-display mt-1 flex h-8 w-8 items-center justify-center text-lg font-bold",
          day.isToday
            ? "rounded-full bg-indigo-600 text-white"
            : "text-slate-600 dark:text-slate-300"
        )}
      >
        {day.dayNumber}
      </span>
    </div>
  );
}
