"use client";

import { Check, Loader2, Clock, AlertTriangle, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SyncStatus =
  | "synced"
  | "syncing"
  | "pending"
  | "conflict"
  | "error"
  | "offline";

interface SyncStatusBadgeProps {
  status: SyncStatus;
  lastSyncedAt?: Date;
  errorMessage?: string;
  className?: string;
}

const statusConfig = {
  synced: {
    icon: Check,
    label: "Synced",
    className: "text-green-600 bg-green-50",
  },
  syncing: {
    icon: Loader2,
    label: "Syncing",
    className: "text-blue-600 bg-blue-50",
    iconClassName: "animate-spin",
  },
  pending: {
    icon: Clock,
    label: "Pending",
    className: "text-amber-600 bg-amber-50",
  },
  conflict: {
    icon: AlertTriangle,
    label: "Conflict",
    className: "text-orange-600 bg-orange-50",
  },
  error: {
    icon: AlertTriangle,
    label: "Error",
    className: "text-red-600 bg-red-50",
  },
  offline: {
    icon: CloudOff,
    label: "Offline",
    className: "text-gray-600 bg-gray-50",
  },
};

export function SyncStatusBadge({
  status,
  lastSyncedAt,
  errorMessage,
  className,
}: SyncStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const tooltipContent = () => {
    if (errorMessage) return errorMessage;
    if (lastSyncedAt) {
      return `Last synced: ${lastSyncedAt.toLocaleString()}`;
    }
    return config.label;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              config.className,
              className
            )}
          >
            <Icon
              className={cn(
                "size-3",
                "iconClassName" in config && config.iconClassName
              )}
            />
            <span>{config.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
