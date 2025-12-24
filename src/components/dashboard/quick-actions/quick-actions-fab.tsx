"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDashboard } from "../contexts/dashboard-context";
import { ActionButton } from "./action-button";

export function QuickActionsFab() {
  const t = useTranslations("DashboardPage.quickActions");
  const { quickActions } = useDashboard();

  if (quickActions.length === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          className={cn(
            "fixed right-6 bottom-6 z-50 h-14 w-14 rounded-full shadow-lg",
            "transition-transform hover:scale-105 active:scale-95"
          )}
          aria-label={t("title")}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-auto p-2"
        sideOffset={12}
      >
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
