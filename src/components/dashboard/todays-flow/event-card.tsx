"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardEvent, EventState } from "../types";

interface EventCardProps {
  event: DashboardEvent;
  state: EventState;
}

export function EventCard({ event, state }: EventCardProps) {
  const formattedTime = event.startTime.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card
      className={cn(
        "transition-all",
        state === "NOW" && "border-l-primary bg-primary/5 border-l-4",
        state === "NEXT" && "bg-muted/50",
        state === "LATER" && "opacity-60"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "font-mono tabular-nums",
                state === "NOW" ? "text-2xl font-bold" : "text-lg"
              )}
            >
              {formattedTime}
            </p>
            <h3
              className={cn(
                "truncate font-semibold",
                state === "NOW" ? "text-xl" : "text-base"
              )}
            >
              {event.title}
            </h3>
            {event.location && (
              <p className="text-muted-foreground truncate text-sm">
                {event.location}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
