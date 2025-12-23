"use client";

import { useTranslations } from "next-intl";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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

  const isManageMode = mode === "manage";

  return (
    <div className="flex items-center gap-2">
      <Switch
        id="mode-toggle"
        checked={isManageMode}
        onCheckedChange={toggleMode}
        aria-label={isManageMode ? t("switchToWall") : t("switchToManage")}
      />
      <Label
        htmlFor="mode-toggle"
        className="text-muted-foreground cursor-pointer text-sm"
      >
        {t("manageMode")}
      </Label>
    </div>
  );
}
