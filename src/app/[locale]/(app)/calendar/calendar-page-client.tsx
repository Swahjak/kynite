"use client";

import { useAddEvent } from "@/contexts/add-event-context";
import { Calendar } from "@/components/calendar/calendar";
import type { IEvent, IUser } from "@/components/calendar/interfaces";

interface CalendarPageClientProps {
  events: IEvent[];
  users: IUser[];
}

export function CalendarPageClient({ events, users }: CalendarPageClientProps) {
  const { addEventButtonRef } = useAddEvent();

  return (
    <Calendar
      events={events}
      users={users}
      addEventButtonRef={addEventButtonRef}
    />
  );
}
