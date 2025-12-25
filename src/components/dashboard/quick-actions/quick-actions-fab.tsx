"use client";

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDashboard } from "../contexts/dashboard-context";
import { ActionButton } from "./action-button";
import type { QuickAction } from "../types";

export function QuickActionsFab() {
  const t = useTranslations("DashboardPage.quickActions");
  const queryClient = useQueryClient();
  const { quickActions, familyMembers, startQuickAction } = useDashboard();
  const [pendingAction, setPendingAction] = useState<QuickAction | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleActionClick = (action: QuickAction) => {
    setPendingAction(action);
    setPopoverOpen(false);
  };

  const handleMemberSelect = async (memberId: string) => {
    if (pendingAction) {
      await startQuickAction(pendingAction.id, memberId);
      setPendingAction(null);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setPopoverOpen(false);
    await queryClient.invalidateQueries();
    setIsRefreshing(false);
  };

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
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
              <ActionButton
                key={action.id}
                action={action}
                onClick={() => handleActionClick(action)}
              />
            ))}
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={cn("h-4 w-4", isRefreshing && "animate-spin")}
              />
              {t("refresh")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <Dialog
        open={!!pendingAction}
        onOpenChange={() => setPendingAction(null)}
      >
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>{t("selectMember")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {familyMembers.map((member) => (
              <Button
                key={member.id}
                variant="outline"
                className="justify-start gap-3"
                onClick={() => handleMemberSelect(member.id)}
              >
                <span
                  className="h-8 w-8 rounded-full"
                  style={{ backgroundColor: member.avatarColor }}
                />
                <span>{member.name}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
