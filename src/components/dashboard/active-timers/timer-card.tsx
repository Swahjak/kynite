"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Pause, Plus, Check, X, Star } from "lucide-react";
import { useIsManager } from "@/hooks/use-is-manager";
import { useDashboard } from "../contexts/dashboard-context";
import type { Timer } from "../types";
import { cn } from "@/lib/utils";

interface TimerCardProps {
  timer: Timer;
}

type TimerUIState =
  | "running"
  | "paused"
  | "in_cooldown"
  | "cooldown_expired"
  | "needs_acknowledge";

export function TimerCard({ timer }: TimerCardProps) {
  const t = useTranslations("DashboardPage.activeTimers");
  const isManager = useIsManager();
  const {
    pauseTimer,
    extendTimer,
    confirmTimer,
    dismissTimer,
    acknowledgeTimer,
    familyMembers,
  } = useDashboard();

  const [remaining, setRemaining] = useState(timer.remainingSeconds);
  const [cooldownElapsed, setCooldownElapsed] = useState(0);

  // Find the assigned member for avatar display
  const assignedMember = timer.assignedToId
    ? familyMembers.find((m) => m.id === timer.assignedToId)
    : null;

  // Calculate cooldown elapsed time for expired timers
  useEffect(() => {
    if (timer.status === "expired" && timer.completedAt) {
      const elapsed = Math.floor(
        (Date.now() - timer.completedAt.getTime()) / 1000
      );
      setCooldownElapsed(elapsed);
    }
  }, [timer.status, timer.completedAt]);

  // Sync with server value when it changes
  useEffect(() => {
    setRemaining(timer.remainingSeconds);
  }, [timer.remainingSeconds]);

  // Local countdown for smooth display
  useEffect(() => {
    if (timer.status !== "running") return;

    const interval = setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [timer.status]);

  // Cooldown countdown for expired timers
  useEffect(() => {
    if (timer.status !== "expired") return;

    const interval = setInterval(() => {
      setCooldownElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timer.status]);

  // Determine UI state
  const getUIState = (): TimerUIState => {
    if (timer.status === "running") return "running";
    if (timer.status === "paused") return "paused";
    if (timer.status === "expired") {
      const cooldownRemaining = (timer.cooldownSeconds ?? 0) - cooldownElapsed;
      return cooldownRemaining > 0 ? "in_cooldown" : "cooldown_expired";
    }
    // Timer reached 0 without cooldown (locally detected)
    if (remaining <= 0 && !timer.cooldownSeconds) return "needs_acknowledge";
    return "running";
  };

  const uiState = getUIState();

  // Calculate display time
  const getDisplayTime = () => {
    if (uiState === "in_cooldown" || uiState === "cooldown_expired") {
      // Show negative time during cooldown
      const isNegative = true;
      const absSeconds = cooldownElapsed;
      const minutes = Math.floor(absSeconds / 60);
      const seconds = absSeconds % 60;
      return {
        display: `-${minutes}:${seconds.toString().padStart(2, "0")}`,
        isNegative,
      };
    }

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return {
      display: `${minutes}:${seconds.toString().padStart(2, "0")}`,
      isNegative: false,
    };
  };

  const { display: timeDisplay, isNegative } = getDisplayTime();
  const progress = (remaining / timer.totalSeconds) * 100;

  const handleConfirm = () => {
    // Use the assigned member as the confirmer (anyone can click, stars go to assigned)
    if (timer.assignedToId) {
      confirmTimer(timer.id, timer.assignedToId);
    }
  };

  const handleDismiss = () => {
    dismissTimer(timer.id);
  };

  const handleAcknowledge = () => {
    acknowledgeTimer(timer.id);
  };

  // Render action buttons based on state
  const renderActions = () => {
    switch (uiState) {
      case "running":
        if (!isManager) return null;
        return (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex-1 text-xs"
              onClick={() => extendTimer(timer.id, 900)}
            >
              <Plus className="mr-1 h-3 w-3" />
              15m
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex-1 text-xs"
              onClick={() => pauseTimer(timer.id)}
            >
              <Pause className="mr-1 h-3 w-3" />
              {t("pause")}
            </Button>
          </div>
        );

      case "paused":
        return null; // TODO: Add resume button if needed

      case "in_cooldown":
        return (
          <Button
            variant="default"
            size="sm"
            className="h-10 w-full"
            onClick={handleConfirm}
          >
            <Star className="mr-2 h-4 w-4" />
            {t("claim")} (+{timer.starReward})
          </Button>
        );

      case "cooldown_expired":
        return (
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-full"
            onClick={handleDismiss}
          >
            <X className="mr-2 h-4 w-4" />
            {t("dismiss")}
          </Button>
        );

      case "needs_acknowledge":
        return (
          <Button
            variant="default"
            size="sm"
            className="h-10 w-full"
            onClick={handleAcknowledge}
          >
            <Check className="mr-2 h-4 w-4" />
            {t("done")}
          </Button>
        );

      default:
        return null;
    }
  };

  return (
    <Card
      className={cn(
        uiState === "cooldown_expired" &&
          "border-destructive/50 bg-destructive/5"
      )}
    >
      <CardContent className="p-3 md:p-4">
        <div className="mb-2 flex items-start justify-between">
          <div className="flex items-center gap-2">
            {assignedMember && (
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={assignedMember.avatarUrl}
                  alt={assignedMember.name}
                />
                <AvatarFallback
                  style={{ backgroundColor: assignedMember.avatarColor }}
                  className="text-xs font-medium text-white"
                >
                  {assignedMember.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            )}
            <div>
              <h3 className="text-sm font-semibold">{timer.title}</h3>
              <p className="text-muted-foreground text-xs">{timer.subtitle}</p>
            </div>
          </div>
        </div>

        <div className="mb-2 text-center">
          {uiState === "cooldown_expired" ? (
            <span className="text-destructive text-3xl font-bold md:text-4xl">
              {t("missed")}
            </span>
          ) : (
            <>
              <span
                className={cn(
                  "text-3xl font-bold tabular-nums md:text-4xl",
                  isNegative && "text-destructive animate-pulse"
                )}
              >
                {timeDisplay}
              </span>
              <span className="text-muted-foreground ml-1 text-xs">
                {uiState === "in_cooldown" ? t("cooldown") : t("minutesLeft")}
              </span>
            </>
          )}
        </div>

        {uiState !== "cooldown_expired" && (
          <Progress
            value={uiState === "in_cooldown" ? 0 : progress}
            className={cn("mb-2 h-1.5", isNegative && "bg-destructive/20")}
          />
        )}

        {renderActions()}
      </CardContent>
    </Card>
  );
}
