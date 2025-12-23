"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Lock, LockOpen } from "lucide-react";

interface CalendarPrivacyToggleProps {
  calendarId: string;
  calendarName: string;
  isPrivate: boolean;
  syncEnabled: boolean;
  onPrivacyChange: (calendarId: string, isPrivate: boolean) => Promise<void>;
}

export function CalendarPrivacyToggle({
  calendarId,
  calendarName,
  isPrivate,
  syncEnabled,
  onPrivacyChange,
}: CalendarPrivacyToggleProps) {
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(isPrivate);

  const handleToggle = async (newValue: boolean) => {
    setLoading(true);
    try {
      await onPrivacyChange(calendarId, newValue);
      setChecked(newValue);
    } catch (error) {
      console.error("Failed to update privacy setting:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        {checked ? (
          <Lock className="text-muted-foreground h-4 w-4" />
        ) : (
          <LockOpen className="text-muted-foreground h-4 w-4" />
        )}
        <Label htmlFor={`privacy-${calendarId}`} className="text-sm">
          {calendarName}
        </Label>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Switch
              id={`privacy-${calendarId}`}
              checked={checked}
              onCheckedChange={handleToggle}
              disabled={!syncEnabled || loading}
              aria-label={`Make ${calendarName} private`}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {!syncEnabled
            ? "Enable sync first to set privacy"
            : checked
              ? "Event details hidden from family members"
              : "Event details visible to family members"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
