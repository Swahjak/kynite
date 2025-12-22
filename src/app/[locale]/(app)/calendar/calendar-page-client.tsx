"use client";

import { useRef } from "react";
import { Calendar } from "@/components/calendar/calendar";
import type { IEvent, IUser } from "@/components/calendar/interfaces";

interface CalendarPageClientProps {
  events: IEvent[];
  users: IUser[];
}

export function CalendarPageClient({ events, users }: CalendarPageClientProps) {
  const addEventButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <Calendar
      events={events}
      users={users}
      addEventButtonRef={addEventButtonRef}
    />
  );
}
