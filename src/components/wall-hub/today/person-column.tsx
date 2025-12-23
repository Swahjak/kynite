"use client";

import { useMemo } from "react";
import { isToday, parseISO, compareAsc } from "date-fns";
import { useTranslations } from "next-intl";
import { PartyPopper } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScheduleCard } from "@/components/wall-hub/shared/schedule-card";
import { TaskCheckbox } from "@/components/wall-hub/shared/task-checkbox";
import type { IEvent, IUser } from "@/components/calendar/interfaces";
import type { IChoreWithAssignee } from "@/types/chore";

interface PersonColumnProps {
  user: IUser;
  events: IEvent[];
  chores: IChoreWithAssignee[];
  onCompleteChore: (choreId: string) => void;
}

export function PersonColumn({
  user,
  events,
  chores,
  onCompleteChore,
}: PersonColumnProps) {
  const t = useTranslations("WallHub");

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
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarImage src={user.avatarUrl} alt={user.name} />
            <AvatarFallback style={{ backgroundColor: user.avatarColor }}>
              {user.avatarFallback}
            </AvatarFallback>
          </Avatar>
          <span className="text-lg font-semibold">{user.name}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {hasNoContent ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <PartyPopper className="text-muted-foreground size-12" />
            <p className="text-muted-foreground text-sm font-medium">
              {t("freeDay")}
            </p>
            <p className="text-muted-foreground text-xs">
              {t("noScheduledEvents")}
            </p>
          </div>
        ) : (
          <>
            {todayEvents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {t("schedule")}
                </h4>
                <div className="space-y-2">
                  {todayEvents.map((event) => (
                    <ScheduleCard key={event.id} event={event} showNowBadge />
                  ))}
                </div>
              </div>
            )}
            {userChores.length > 0 && (
              <div className="mt-auto space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {t("tasks")}
                  </h4>
                  <span className="text-muted-foreground text-xs">
                    {userChores.filter((c) => c.status === "completed").length}/
                    {userChores.length} {t("done")}
                  </span>
                </div>
                <div className="space-y-2">
                  {userChores.map((chore) => (
                    <TaskCheckbox
                      key={chore.id}
                      chore={chore}
                      onComplete={onCompleteChore}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
