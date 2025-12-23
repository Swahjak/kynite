"use client";

import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { CalendarDataProvider } from "@/components/calendar/providers/calendar-data-provider";
import { CalendarProvider } from "@/components/calendar/contexts/calendar-context";
import { ChoresProvider } from "@/components/chores/contexts/chores-context";
import { useCalendarData } from "@/components/calendar/providers/calendar-data-provider";
import { WallHubHeader } from "@/components/wall-hub/wall-hub-header";
import { AddEditEventDialog } from "@/components/calendar/dialogs/add-edit-event-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useInteractionModeSafe } from "@/contexts/interaction-mode-context";
import type { FamilyMemberWithUser } from "@/types/family";
import type { IChoreWithAssignee, IChoreProgress } from "@/types/chore";

interface CalendarLayoutClientProps {
  familyId: string;
  members: FamilyMemberWithUser[];
  initialChores: IChoreWithAssignee[];
  initialProgress: IChoreProgress;
  children: ReactNode;
}

function CalendarLayoutInner({ children }: { children: ReactNode }) {
  const { events, users } = useCalendarData();
  const { mode } = useInteractionModeSafe();
  const t = useTranslations("Calendar");
  const isManageMode = mode === "manage";

  return (
    <CalendarProvider users={users} events={events}>
      <div className="flex h-full flex-col">
        <WallHubHeader />
        <div className="flex-1 overflow-hidden">{children}</div>

        {/* FAB - only visible in manage mode */}
        {isManageMode && (
          <AddEditEventDialog>
            <Button
              size="icon"
              className={cn(
                "fixed right-6 bottom-6 z-50 h-14 w-14 rounded-full shadow-lg",
                "transition-transform hover:scale-105 active:scale-95"
              )}
              aria-label={t("addEvent")}
            >
              <Plus className="h-6 w-6" />
            </Button>
          </AddEditEventDialog>
        )}
      </div>
    </CalendarProvider>
  );
}

export function CalendarLayoutClient({
  familyId,
  members,
  initialChores,
  initialProgress,
  children,
}: CalendarLayoutClientProps) {
  return (
    <CalendarDataProvider familyId={familyId} members={members}>
      <ChoresProvider
        familyId={familyId}
        initialChores={initialChores}
        initialProgress={initialProgress}
        members={members}
      >
        <CalendarLayoutInner>{children}</CalendarLayoutInner>
      </ChoresProvider>
    </CalendarDataProvider>
  );
}
