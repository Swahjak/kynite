"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarToggle } from "./calendar-toggle";
import { SyncStatusBadge } from "./sync-status-badge";
import { CalendarPrivacyToggle } from "@/components/settings/calendar-privacy-toggle";
import { toast } from "sonner";
import type { GoogleCalendar } from "@/server/schema";

interface CalendarSelectionSectionProps {
  familyId: string;
  account: {
    id: string;
    googleAccountId: string;
  };
}

interface AvailableCalendar {
  id: string;
  name: string;
  color: string;
  accessRole: string;
  primary: boolean;
}

export function CalendarSelectionSection({
  familyId,
  account,
}: CalendarSelectionSectionProps) {
  const [availableCalendars, setAvailableCalendars] = useState<
    AvailableCalendar[]
  >([]);
  const [linkedCalendars, setLinkedCalendars] = useState<GoogleCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchCalendars = async () => {
    try {
      // Fetch available calendars from Google
      const availableRes = await fetch(
        `/api/v1/google/calendars?accountId=${account.id}`
      );
      const availableData = await availableRes.json();

      // Fetch already linked calendars
      const linkedRes = await fetch(`/api/v1/families/${familyId}/calendars`);
      const linkedData = await linkedRes.json();

      if (availableData.success) {
        setAvailableCalendars(availableData.data.calendars);
      }
      if (linkedData.success) {
        setLinkedCalendars(
          linkedData.data.calendars.filter(
            (c: GoogleCalendar) => c.accountId === account.id
          )
        );
      }
    } catch (error) {
      console.error("Failed to fetch calendars:", error);
      toast.error("Failed to load calendars");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendars();
  }, [familyId, account.id]);

  const handleAddCalendar = async (googleCal: AvailableCalendar) => {
    try {
      const response = await fetch(`/api/v1/families/${familyId}/calendars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          googleCalendarId: googleCal.id,
          name: googleCal.name,
          color: googleCal.color,
          accessRole: googleCal.accessRole,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setLinkedCalendars((prev) => [...prev, data.data.calendar]);
        toast.success(`Added "${googleCal.name}" to sync`);
      }
    } catch {
      toast.error("Failed to add calendar");
    }
  };

  const handleToggleSync = async (calendarId: string, enabled: boolean) => {
    const response = await fetch(
      `/api/v1/families/${familyId}/calendars/${calendarId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncEnabled: enabled }),
      }
    );

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || "Failed to toggle sync");
    }

    setLinkedCalendars((prev) =>
      prev.map((c) =>
        c.id === calendarId ? { ...c, syncEnabled: enabled } : c
      )
    );
  };

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
      const data = await response.json();
      throw new Error(data.error?.message || "Failed to update privacy");
    }

    setLinkedCalendars((prev) =>
      prev.map((c) => (c.id === calendarId ? { ...c, isPrivate } : c))
    );
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      for (const cal of linkedCalendars.filter((c) => c.syncEnabled)) {
        await fetch(`/api/v1/families/${familyId}/calendars/${cal.id}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      }
      toast.success("Sync completed");
      await fetchCalendars();
    } catch {
      toast.error("Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const linkedCalendarIds = new Set(
    linkedCalendars.map((c) => c.googleCalendarId)
  );
  const unlinkedCalendars = availableCalendars.filter(
    (c) => !linkedCalendarIds.has(c.id)
  );

  return (
    <div className="space-y-4">
      {/* Linked calendars */}
      {linkedCalendars.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Synced Calendars</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSyncNow}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 size-3" />
              )}
              Sync Now
            </Button>
          </div>
          <div className="divide-y rounded-md border">
            {linkedCalendars.map((cal) => (
              <div key={cal.id} className="space-y-2 px-3 py-3">
                <div className="flex items-center justify-between">
                  <CalendarToggle calendar={cal} onToggle={handleToggleSync} />
                  <SyncStatusBadge
                    status={cal.lastSyncedAt ? "synced" : "pending"}
                    lastSyncedAt={cal.lastSyncedAt ?? undefined}
                  />
                </div>
                <div className="pl-7">
                  <CalendarPrivacyToggle
                    calendarId={cal.id}
                    calendarName={cal.name}
                    isPrivate={cal.isPrivate ?? false}
                    syncEnabled={cal.syncEnabled}
                    onPrivacyChange={handlePrivacyChange}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available calendars to add */}
      {unlinkedCalendars.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-muted-foreground text-sm font-medium">
            Available Calendars
          </h4>
          <div className="divide-y rounded-md border border-dashed">
            {unlinkedCalendars.map((cal) => (
              <button
                key={cal.id}
                onClick={() => handleAddCalendar(cal)}
                className="hover:bg-muted/50 flex w-full items-center gap-3 px-3 py-2 text-left"
              >
                <div
                  className="size-4 rounded-full border"
                  style={{ backgroundColor: cal.color }}
                />
                <span className="text-sm">{cal.name}</span>
                {cal.primary && (
                  <span className="text-muted-foreground text-xs">
                    (Primary)
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
