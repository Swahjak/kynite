"use client";

import { format, isWithinInterval, parseISO } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { IEvent } from "@/components/calendar/interfaces";
import { getEventColorByParticipants } from "./user-colors";

interface ScheduleCardProps {
  event: IEvent;
  showNowBadge?: boolean;
}

export function ScheduleCard({ event, showNowBadge }: ScheduleCardProps) {
  const startDate = parseISO(event.startDate);
  const endDate = parseISO(event.endDate);
  const now = new Date();

  const isNow = isWithinInterval(now, { start: startDate, end: endDate });
  const timeDisplay = format(startDate, "h:mm a");

  // Get color based on first participant (consistent via ID hash)
  const participantIds = event.users.map((u) => u.id);
  const color = getEventColorByParticipants(participantIds);

  return (
    <div
      className={cn(
        "rounded-lg border-l-4 p-3 shadow-sm",
        color.border.replace("border-", "border-l-"),
        color.bg
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">
          {timeDisplay}
        </span>
        <div className="flex items-center gap-1.5">
          {event.users.length > 0 && (
            <div className="flex -space-x-1">
              {event.users.map((user) =>
                user.avatarSvg ? (
                  <div
                    key={user.id}
                    className="relative flex size-4 shrink-0 overflow-hidden rounded-full border border-white dark:border-gray-800"
                    dangerouslySetInnerHTML={{ __html: user.avatarSvg }}
                  />
                ) : (
                  <Avatar
                    key={user.id}
                    className="size-4 border border-white dark:border-gray-800"
                  >
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                    <AvatarFallback
                      style={{ backgroundColor: user.avatarColor }}
                      className="text-[6px] font-bold"
                    >
                      {user.avatarFallback}
                    </AvatarFallback>
                  </Avatar>
                )
              )}
            </div>
          )}
          {showNowBadge && isNow && (
            <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              NOW
            </span>
          )}
        </div>
      </div>
      <p className="text-sm font-semibold">{event.title}</p>
    </div>
  );
}
