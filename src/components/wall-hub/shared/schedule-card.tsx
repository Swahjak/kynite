"use client";

import { format, isWithinInterval, parseISO } from "date-fns";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IEvent } from "@/components/calendar/interfaces";

interface ScheduleCardProps {
  event: IEvent;
  showNowBadge?: boolean;
}

const colorClasses: Record<string, string> = {
  blue: "border-l-blue-500 bg-blue-50 dark:bg-blue-950/30",
  green: "border-l-green-500 bg-green-50 dark:bg-green-950/30",
  red: "border-l-red-500 bg-red-50 dark:bg-red-950/30",
  yellow: "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/30",
  purple: "border-l-purple-500 bg-purple-50 dark:bg-purple-950/30",
  orange: "border-l-orange-500 bg-orange-50 dark:bg-orange-950/30",
};

export function ScheduleCard({ event, showNowBadge }: ScheduleCardProps) {
  const startDate = parseISO(event.startDate);
  const endDate = parseISO(event.endDate);
  const now = new Date();

  const isNow = isWithinInterval(now, { start: startDate, end: endDate });
  const timeDisplay = format(startDate, "h:mm a");

  return (
    <div
      className={cn(
        "rounded-lg border-l-4 p-3",
        colorClasses[event.color] || colorClasses.blue
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium">
          {timeDisplay}
        </span>
        {showNowBadge && isNow && (
          <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            NOW
          </span>
        )}
      </div>
      <p className="text-sm font-semibold">{event.title}</p>
      {event.description && (
        <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
          <MapPin className="size-3" />
          <span>{event.description}</span>
        </div>
      )}
    </div>
  );
}
