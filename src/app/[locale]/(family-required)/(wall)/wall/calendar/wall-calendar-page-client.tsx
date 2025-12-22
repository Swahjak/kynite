"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Calendar } from "@/components/calendar/calendar";
import type { IEvent, IUser } from "@/components/calendar/interfaces";

interface WallCalendarPageClientProps {
  events: IEvent[];
  users: IUser[];
}

export function WallCalendarPageClient({
  events,
  users,
}: WallCalendarPageClientProps) {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1">
        <Calendar events={events} users={users} />
      </main>
    </div>
  );
}
