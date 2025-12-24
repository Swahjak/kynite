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
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { useDashboard } from "../contexts/dashboard-context";
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
}

export function ActionButton({ action }: ActionButtonProps) {
  const { mode } = useInteractionMode();
  const { startQuickAction } = useDashboard();

  const Icon = iconMap[action.icon] || CheckCircle;
  const isDisabled = mode === "wall";

  return (
    <Button
      variant="outline"
      className="h-16 flex-col gap-1 rounded-lg transition-transform active:scale-95"
      disabled={isDisabled}
      onClick={() => startQuickAction(action.id)}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs font-medium">{action.label}</span>
    </Button>
  );
}
