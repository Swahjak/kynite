"use client";

import type { ReactNode } from "react";
import { CalendarDataProvider } from "@/components/calendar/providers/calendar-data-provider";
import { CalendarProvider } from "@/components/calendar/contexts/calendar-context";
import { ChoresProvider } from "@/components/chores/contexts/chores-context";
import { useCalendarData } from "@/components/calendar/providers/calendar-data-provider";
import { WallHubHeader } from "@/components/wall-hub/wall-hub-header";
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

  return (
    <CalendarProvider users={users} events={events}>
      <div className="flex h-full flex-col">
        <WallHubHeader />
        <div className="flex-1 overflow-hidden">{children}</div>
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
