"use client";

import { useCacheStatus, type CacheStatus } from "./cache-status-context";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const statusConfig: Record<
  CacheStatus,
  {
    color: string;
    label: string;
    description: string;
  }
> = {
  live: {
    color: "bg-[oklch(var(--status-success))]",
    label: "Live",
    description: "Connected with fresh data",
  },
  stale: {
    color: "bg-[oklch(var(--status-warning))]",
    label: "Updating",
    description: "Showing cached data, refreshing in background",
  },
  offline: {
    color: "bg-[oklch(var(--status-error))]",
    label: "Offline",
    description: "No network connection, showing cached data",
  },
};

interface CacheStatusIndicatorProps {
  className?: string;
}

export function CacheStatusIndicator({ className }: CacheStatusIndicatorProps) {
  const { status, isFetching } = useCacheStatus();
  const config = statusConfig[status];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "fixed right-4 bottom-4 z-50",
              "flex items-center gap-2 rounded-full px-3 py-1.5",
              "bg-card/80 border shadow-sm backdrop-blur-sm",
              "transition-all duration-300 ease-in-out",
              className
            )}
          >
            <span className="relative flex size-2.5">
              {isFetching && (
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                    config.color
                  )}
                />
              )}
              <span
                className={cn(
                  "relative inline-flex size-2.5 rounded-full",
                  config.color
                )}
              />
            </span>
            <span className="text-muted-foreground text-xs font-medium">
              {config.label}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
