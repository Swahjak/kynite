"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CalendarToggleProps {
  calendar: {
    id: string;
    name: string;
    color?: string | null;
    accessRole: string;
    syncEnabled: boolean;
  };
  onToggle: (calendarId: string, enabled: boolean) => Promise<void>;
}

export function CalendarToggle({ calendar, onToggle }: CalendarToggleProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [enabled, setEnabled] = useState(calendar.syncEnabled);
  const isReadOnly =
    calendar.accessRole === "reader" ||
    calendar.accessRole === "freeBusyReader";

  const handleToggle = async (checked: boolean) => {
    setIsLoading(true);
    setEnabled(checked);
    try {
      await onToggle(calendar.id, checked);
    } catch {
      setEnabled(!checked); // Revert on error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        {/* Color swatch */}
        <div
          className="size-4 rounded-full border"
          style={{ backgroundColor: calendar.color || "#4285f4" }}
        />

        {/* Calendar name */}
        <span className="text-sm font-medium">{calendar.name}</span>

        {/* Read-only indicator */}
        {isReadOnly && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Lock className="text-muted-foreground size-3" />
              </TooltipTrigger>
              <TooltipContent>
                <p>This calendar is read-only</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <Switch
        checked={enabled}
        onCheckedChange={handleToggle}
        disabled={isLoading}
        className={cn(isLoading && "opacity-50")}
      />
    </div>
  );
}
