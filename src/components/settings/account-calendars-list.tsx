"use client";

import { useEffect, useState } from "react";
import { CalendarPrivacyToggle } from "./calendar-privacy-toggle";
import { Skeleton } from "@/components/ui/skeleton";

interface Calendar {
  id: string;
  name: string;
  color: string | null;
  syncEnabled: boolean;
  isPrivate: boolean;
}

interface AccountCalendarsListProps {
  accountId: string;
}

export function AccountCalendarsList({ accountId }: AccountCalendarsListProps) {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCalendars() {
      try {
        const response = await fetch(`/api/v1/accounts/${accountId}/calendars`);
        const data = await response.json();
        if (data.success) {
          setCalendars(data.data.calendars);
        } else {
          setError(data.error || "Failed to load calendars");
        }
      } catch (err) {
        setError("Failed to load calendars");
      } finally {
        setLoading(false);
      }
    }
    fetchCalendars();
  }, [accountId]);

  const handlePrivacyChange = async (
    calendarId: string,
    isPrivate: boolean
  ) => {
    const response = await fetch(`/api/v1/calendars/${calendarId}/privacy`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrivate }),
    });

    if (!response.ok) {
      throw new Error("Failed to update privacy setting");
    }

    setCalendars((prev) =>
      prev.map((cal) => (cal.id === calendarId ? { ...cal, isPrivate } : cal))
    );
  };

  if (loading) {
    return (
      <div className="space-y-2 pl-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (error) {
    return <p className="text-destructive pl-4 text-sm">{error}</p>;
  }

  if (calendars.length === 0) {
    return (
      <p className="text-muted-foreground pl-4 text-sm">No calendars synced</p>
    );
  }

  return (
    <div className="space-y-1 pl-4">
      <p className="text-muted-foreground mb-2 text-xs">Calendar Privacy</p>
      {calendars.map((calendar) => (
        <CalendarPrivacyToggle
          key={calendar.id}
          calendarId={calendar.id}
          calendarName={calendar.name}
          isPrivate={calendar.isPrivate}
          syncEnabled={calendar.syncEnabled}
          onPrivacyChange={handlePrivacyChange}
        />
      ))}
    </div>
  );
}
