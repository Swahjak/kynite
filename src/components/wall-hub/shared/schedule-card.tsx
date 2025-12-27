"use client";

import { format, isWithinInterval, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { FamilyAvatar } from "@/components/family/family-avatar";
import { getAvatarColorClasses } from "@/lib/avatar-colors";
import { useUserPreferences } from "@/hooks/use-preferences";
import type { IEvent } from "@/components/calendar/interfaces";
import type { AvatarColor } from "@/types/family";

interface ScheduleCardProps {
  event: IEvent;
  showNowBadge?: boolean;
}

export function ScheduleCard({ event, showNowBadge }: ScheduleCardProps) {
  const { data: preferences } = useUserPreferences();
  const use24HourFormat = preferences?.use24HourFormat ?? true;

  const startDate = parseISO(event.startDate);
  const endDate = parseISO(event.endDate);
  const now = new Date();

  const isNow = isWithinInterval(now, { start: startDate, end: endDate });
  const timeFormat = use24HourFormat ? "HH:mm" : "h:mm a";
  const timeDisplay = `${format(startDate, timeFormat)} - ${format(endDate, timeFormat)}`;

  // Get color based on first participant's avatarColor
  const firstUser = event.users[0];
  const color = getAvatarColorClasses(firstUser?.avatarColor as AvatarColor);
  // Convert ring class to border class for card styling
  const borderClass = color.ring.replace("ring-", "border-l-");

  return (
    <div
      className={cn(
        "rounded-lg border-l-4 p-3 shadow-sm",
        borderClass,
        color.bgSubtle
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs font-medium">
          {timeDisplay}
        </span>
        <div className="flex items-center gap-1.5">
          {event.users.length > 0 && (
            <div className="flex -space-x-1">
              {event.users.map((user) => (
                <FamilyAvatar
                  key={user.id}
                  name={user.name}
                  color={user.avatarColor as AvatarColor}
                  avatarSvg={user.avatarSvg}
                  googleImage={user.avatarUrl}
                  size="sm"
                  showRing={false}
                  className="size-4 border border-white text-[6px] dark:border-gray-800"
                />
              ))}
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
