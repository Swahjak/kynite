"use client";

import { CalendarBody } from "@/components/calendar/calendar-body";
import { CalendarProvider } from "@/components/calendar/contexts/calendar-context";
import { DndProvider } from "@/components/calendar/contexts/dnd-context";
import { CalendarHeader } from "@/components/calendar/header/calendar-header";
import type { IEvent, IUser } from "@/components/calendar/interfaces";

interface CalendarProps {
  events?: IEvent[];
  users?: IUser[];
}

export function Calendar({ events, users }: CalendarProps) {
  // Try to use CalendarDataProvider if props not provided
  let finalEvents: IEvent[] = events ?? [];
  let finalUsers: IUser[] = users ?? [];

  if (!events || !users) {
    try {
      // Dynamic import to avoid circular dependency and make context optional
      const {
        useCalendarData,
      } = require("@/components/calendar/providers/calendar-data-provider");
      const context = useCalendarData();
      finalEvents = events ?? context.events;
      finalUsers = users ?? context.users;
    } catch {
      // Context not available, use provided props or empty arrays
      finalEvents = events ?? [];
      finalUsers = users ?? [];
    }
  }

  return (
    <CalendarProvider events={finalEvents} users={finalUsers} view="month">
      <DndProvider showConfirmation={false}>
        <div className="w-full rounded-xl border">
          <CalendarHeader />
          <CalendarBody />
        </div>
      </DndProvider>
    </CalendarProvider>
  );
}
