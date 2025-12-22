"use client";

import { Monitor, MonitorSmartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ModeToggleProps {
  /** Only render if user is a manager (parent) */
  isManager: boolean;
}

export function ModeToggle({ isManager }: ModeToggleProps) {
  const t = useTranslations("Header");
  const { mode, toggleMode } = useInteractionMode();

  if (!isManager) {
    return null;
  }

  const isWallMode = mode === "wall";
  const Icon = isWallMode ? MonitorSmartphone : Monitor;
  const label = isWallMode ? t("switchToManage") : t("switchToWall");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMode}
          aria-label={label}
        >
          <Icon className="size-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
