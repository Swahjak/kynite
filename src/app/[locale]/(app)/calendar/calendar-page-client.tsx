"use client";

import { useAddEvent } from "@/contexts/add-event-context";
import { Calendar } from "@/components/calendar/calendar";
import { CalendarDataProvider } from "@/components/calendar/providers/calendar-data-provider";

interface CalendarPageClientProps {
  familyId: string;
  members: Array<{
    id: string;
    displayName: string | null;
    avatarColor: string | null;
    user: { name: string; image: string | null };
  }>;
}

export function CalendarPageClient({
  familyId,
  members,
}: CalendarPageClientProps) {
  const { addEventButtonRef } = useAddEvent();

  return (
    <CalendarDataProvider familyId={familyId} members={members}>
      <Calendar addEventButtonRef={addEventButtonRef} />
    </CalendarDataProvider>
  );
}
