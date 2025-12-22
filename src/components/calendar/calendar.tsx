"use client";

import React from "react";
import { CalendarBody } from "@/components/calendar/calendar-body";
import { CalendarProvider } from "@/components/calendar/contexts/calendar-context";
import { DndProvider } from "@/components/calendar/contexts/dnd-context";
import { CalendarHeader } from "@/components/calendar/header/calendar-header";
import type { IEvent, IUser } from "@/components/calendar/interfaces";

interface CalendarProps {
  events: IEvent[];
  users: IUser[];
  addEventButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export function Calendar({ events, users, addEventButtonRef }: CalendarProps) {
  return (
    <CalendarProvider events={events} users={users} view="month">
      <DndProvider showConfirmation={false}>
        <div className="w-full rounded-xl border">
          <CalendarHeader addEventButtonRef={addEventButtonRef} />
          <CalendarBody />
        </div>
      </DndProvider>
    </CalendarProvider>
  );
}
