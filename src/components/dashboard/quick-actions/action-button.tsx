"use client";

import { Button } from "@/components/ui/button";
import {
  Utensils,
  Droplets,
  Sparkles,
  CheckCircle,
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
      className="h-20 flex-col gap-1 transition-transform active:scale-95"
      disabled={isDisabled}
      onClick={() => startQuickAction(action.id)}
    >
      <Icon className="h-6 w-6" />
      <span className="text-xs font-medium">{action.label}</span>
    </Button>
  );
}
