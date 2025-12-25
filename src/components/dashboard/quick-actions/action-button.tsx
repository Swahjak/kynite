"use client";

import { Button } from "@/components/ui/button";
import {
  Utensils,
  Droplets,
  Sparkles,
  CheckCircle,
  Monitor,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { useIsManager } from "@/hooks/use-is-manager";
import { useIsDevice } from "@/hooks/use-is-device";
import type { QuickAction } from "../types";

const iconMap: Record<string, LucideIcon> = {
  Utensils,
  Droplets,
  Sparkles,
  CheckCircle,
  Monitor,
  Timer,
};

interface ActionButtonProps {
  action: QuickAction;
  onClick?: () => void;
}

export function ActionButton({ action, onClick }: ActionButtonProps) {
  const isManager = useIsManager();
  const isDevice = useIsDevice();

  const Icon = iconMap[action.icon] || CheckCircle;
  // Devices are shared family displays - allow interactions like starting timers
  const isDisabled = !isManager && !isDevice;

  return (
    <Button
      variant="outline"
      className="h-16 flex-col gap-1 rounded-lg transition-transform active:scale-95"
      disabled={isDisabled}
      onClick={onClick}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs font-medium">{action.label}</span>
    </Button>
  );
}
