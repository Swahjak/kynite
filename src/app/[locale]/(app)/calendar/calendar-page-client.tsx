"use client";

import { useAddEvent } from "@/contexts/add-event-context";
import { Calendar } from "@/components/calendar/calendar";

export function CalendarPageClient() {
  const { addEventButtonRef } = useAddEvent();

  return <Calendar addEventButtonRef={addEventButtonRef} />;
}
