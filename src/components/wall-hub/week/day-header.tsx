"use client";

import { format, isToday } from "date-fns";
import { cn } from "@/lib/utils";

interface DayHeaderProps {
  date: Date;
}

export function DayHeader({ date }: DayHeaderProps) {
  const dayIsToday = isToday(date);

  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-center",
        dayIsToday
          ? "border-primary bg-primary/10 border-2"
          : "bg-card border-border"
      )}
    >
      <p
        className={cn(
          "text-sm font-medium tracking-wide uppercase",
          dayIsToday ? "text-primary" : "text-muted-foreground"
        )}
      >
        {format(date, "EEE")}
      </p>
      <p
        className={cn(
          "text-2xl font-bold",
          dayIsToday ? "text-foreground" : "text-foreground"
        )}
      >
        {format(date, "d")}
      </p>
      {dayIsToday && (
        <span className="bg-primary text-primary-foreground mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold">
          TODAY
        </span>
      )}
    </div>
  );
}
