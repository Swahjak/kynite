"use client";

import { useMemo } from "react";
import { isToday, parseISO, compareAsc } from "date-fns";
import { PersonHeader } from "@/components/wall-hub/shared/person-header";
import { ScheduleCard } from "@/components/wall-hub/shared/schedule-card";
import { TaskCheckbox } from "@/components/wall-hub/shared/task-checkbox";
import { cn } from "@/lib/utils";
import type { IEvent, IUser } from "@/components/calendar/interfaces";
import type { IChoreWithAssignee } from "@/types/chore";

interface PersonColumnProps {
  user: IUser;
  events: IEvent[];
  chores: IChoreWithAssignee[];
  onCompleteChore: (choreId: string) => void;
  isHighlighted?: boolean;
}

export function PersonColumn({
  user,
  events,
  chores,
  onCompleteChore,
  isHighlighted = true,
}: PersonColumnProps) {
  // Filter events for today that include this user
  const todayEvents = useMemo(() => {
    return events
      .filter((event) => {
        const startDate = parseISO(event.startDate);
        return isToday(startDate) && event.users.some((u) => u.id === user.id);
      })
      .sort((a, b) => compareAsc(parseISO(a.startDate), parseISO(b.startDate)));
  }, [events, user.id]);

  // Filter chores assigned to this user
  const userChores = useMemo(() => {
    return chores.filter((chore) => chore.assignedToId === user.id);
  }, [chores, user.id]);

  const hasNoContent = todayEvents.length === 0 && userChores.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <PersonHeader user={user} isHighlighted={isHighlighted} />
      <div
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-xl p-3",
          isHighlighted ? "bg-primary/5 dark:bg-primary/10" : "bg-muted/30"
        )}
      >
        {todayEvents.map((event) => (
          <ScheduleCard key={event.id} event={event} showNowBadge />
        ))}
        {userChores.length > 0 && (
          <div className="mt-auto space-y-2">
            {userChores.map((chore) => (
              <TaskCheckbox
                key={chore.id}
                chore={chore}
                onComplete={onCompleteChore}
              />
            ))}
          </div>
        )}
        {hasNoContent && (
          <div className="text-muted-foreground flex flex-1 items-center justify-center text-xs">
            No events
          </div>
        )}
      </div>
    </div>
  );
}
