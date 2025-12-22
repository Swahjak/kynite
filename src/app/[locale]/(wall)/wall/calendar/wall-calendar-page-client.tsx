"use client";

import { AppHeader } from "@/components/layout/app-header";
import { Calendar } from "@/components/calendar/calendar";

export function WallCalendarPageClient() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1">
        <Calendar />
      </main>
    </div>
  );
}
