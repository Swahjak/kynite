"use client";

import { useRef } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { Calendar } from "@/components/calendar/calendar";

export function CalendarPageClient() {
  const addEventButtonRef = useRef<HTMLButtonElement>(null);

  const handleAddEvent = () => {
    // Trigger the add event dialog by clicking the hidden button
    addEventButtonRef.current?.click();
  };

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AppHeader onAddEvent={handleAddEvent} />
      <main className="flex-1">
        <Calendar addEventButtonRef={addEventButtonRef} />
      </main>
    </div>
  );
}
