"use client";

import { useMemo } from "react";
import { isSameDay, parseISO, compareAsc, isPast, isToday } from "date-fns";
import { ScheduleCard } from "@/components/wall-hub/shared/schedule-card";
import { TaskCheckbox } from "@/components/wall-hub/shared/task-checkbox";
import { DayHeader } from "./day-header";
import { cn } from "@/lib/utils";
import type { IEvent } from "@/components/calendar/interfaces";
import type { IChoreWithAssignee } from "@/types/chore";

interface DayColumnProps {
  date: Date;
  events: IEvent[];
  chores: IChoreWithAssignee[];
  onCompleteChore: (choreId: string) => void;
}

export function DayColumn({
  date,
  events,
  chores,
  onCompleteChore,
}: DayColumnProps) {
  // Filter events for this specific day
  const dayEvents = useMemo(() => {
    return events
      .filter((event) => isSameDay(parseISO(event.startDate), date))
      .sort((a, b) => compareAsc(parseISO(a.startDate), parseISO(b.startDate)));
  }, [events, date]);

  // Filter chores due on this day
  const dayChores = useMemo(() => {
    return chores.filter((chore) => {
      if (!chore.dueDate) return false;
      return isSameDay(parseISO(chore.dueDate), date);
    });
  }, [chores, date]);

  const isPastDay = isPast(date) && !isToday(date);

  return (
    <div className={cn("flex flex-col gap-3", isPastDay && "opacity-60")}>
      <DayHeader date={date} />
      <div className="bg-muted/30 flex flex-1 flex-col gap-2 rounded-xl p-2">
        {dayEvents.map((event) => (
          <ScheduleCard
            key={event.id}
            event={event}
            showNowBadge={isToday(date)}
          />
        ))}
        {dayChores.length > 0 && (
          <div className="mt-auto space-y-2">
            {dayChores.map((chore) => (
              <TaskCheckbox
                key={chore.id}
                chore={chore}
                onComplete={onCompleteChore}
              />
            ))}
          </div>
        )}
        {dayEvents.length === 0 && dayChores.length === 0 && (
          <div className="text-muted-foreground flex flex-1 items-center justify-center text-xs">
            No events
          </div>
        )}
      </div>
    </div>
  );
}
