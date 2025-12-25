"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Medal, ChevronRight, Pencil, Target, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsManager } from "@/hooks/use-is-manager";
import { useRewardChart } from "../contexts/reward-chart-context";
import { GoalDialog } from "../dialogs/goal-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {
  IRewardChartGoal,
  CreateGoalInput,
  UpdateGoalInput,
} from "../interfaces";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface NextRewardCardProps {
  goal: IRewardChartGoal | null;
  onViewRewards?: () => void;
  className?: string;
}

export function NextRewardCard({
  goal,
  onViewRewards,
  className,
}: NextRewardCardProps) {
  const t = useTranslations("rewardChart");
  const isManager = useIsManager();
  const { createGoal, updateGoal } = useRewardChart();

  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<
    "achieved" | "cancelled" | null
  >(null);

  const handleGoalSubmit = async (
    values: CreateGoalInput | UpdateGoalInput
  ) => {
    try {
      if (goal) {
        await updateGoal(goal.id, values as UpdateGoalInput);
        toast.success(t("goalUpdated"));
      } else {
        await createGoal(values as CreateGoalInput);
        toast.success(t("goalCreated"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("goalError"));
      throw error;
    }
  };

  const handleMarkGoal = async () => {
    if (!goal || !confirmAction) return;

    try {
      await updateGoal(goal.id, { status: confirmAction });
      toast.success(
        confirmAction === "achieved" ? t("goalAchieved") : t("goalCancelled")
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("goalError"));
    } finally {
      setConfirmDialogOpen(false);
      setConfirmAction(null);
    }
  };

  const openConfirmDialog = (action: "achieved" | "cancelled") => {
    setConfirmAction(action);
    setConfirmDialogOpen(true);
  };

  const progressPercent = goal
    ? Math.min(100, Math.round((goal.starsCurrent / goal.starTarget) * 100))
    : 0;

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800",
          className
        )}
      >
        {goal && (
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-amber-50 opacity-60 blur-3xl dark:bg-amber-900/20" />
        )}

        {/* Header */}
        <div className="relative flex items-center gap-2">
          <Medal className="h-5 w-5 text-amber-500" />
          <span className="font-display text-lg font-bold text-slate-900 dark:text-white">
            {t("nextReward")}
          </span>
          {goal && (
            <span className="ml-auto rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-400 dark:bg-slate-700">
              {goal.starTarget} STARS
            </span>
          )}
          {isManager && goal && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setGoalDialogOpen(true)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-green-600 hover:text-green-700"
                onClick={() => openConfirmDialog("achieved")}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive h-8 w-8"
                onClick={() => openConfirmDialog("cancelled")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {goal ? (
          <>
            {/* Reward Display */}
            <div className="relative mt-4 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30">
                <span className="text-3xl">{goal.emoji}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {goal.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  You&apos;re getting closer!
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="relative mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {goal.starsCurrent} / {goal.starTarget}
                </span>
                <span className="font-bold text-amber-500">
                  {progressPercent}%
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Action Button */}
            {onViewRewards && (
              <Button
                variant="default"
                className="mt-4 w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
                onClick={onViewRewards}
              >
                View All Rewards
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </>
        ) : (
          <div className="py-4 text-center">
            {isManager ? (
              <Button onClick={() => setGoalDialogOpen(true)}>
                <Target className="mr-2 h-4 w-4" />
                {t("setGoal")}
              </Button>
            ) : (
              <p className="text-slate-500">{t("noGoalSet")}</p>
            )}
          </div>
        )}
      </div>

      <GoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        goal={goal || undefined}
        onSubmit={handleGoalSubmit}
      />

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "achieved"
                ? t("markAchievedTitle")
                : t("markCancelledTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "achieved"
                ? t("markAchievedDescription")
                : t("markCancelledDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkGoal}>
              {confirmAction === "achieved"
                ? t("markAchieved")
                : t("markCancelled")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
