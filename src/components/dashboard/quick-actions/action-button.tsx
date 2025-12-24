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
  const { mode } = useInteractionMode();

  const Icon = iconMap[action.icon] || CheckCircle;
  const isDisabled = mode === "wall";

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
