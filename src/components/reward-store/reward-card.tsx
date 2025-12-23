"use client";

import { Star, Clock, Target, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { useTranslations } from "next-intl";
import type { IRewardWithStatus } from "./interfaces";
import { formatDistanceToNow } from "date-fns";

interface RewardCardProps {
  reward: IRewardWithStatus;
  isPrimaryGoal?: boolean;
  onRedeem: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSetGoal?: () => void;
  className?: string;
}

export function RewardCard({
  reward,
  isPrimaryGoal,
  onRedeem,
  onEdit,
  onDelete,
  onSetGoal,
  className,
}: RewardCardProps) {
  const t = useTranslations("rewardStore");
  const { mode } = useInteractionMode();
  const isManageMode = mode === "manage";

  const getButtonContent = () => {
    if (reward.canRedeem) {
      return t("redeem");
    }
    if (reward.reason === "insufficient_stars" && reward.starsNeeded) {
      return t("needMore", { count: reward.starsNeeded });
    }
    if (reward.reason === "limit_reached" && reward.nextAvailable) {
      return t("availableIn", {
        time: formatDistanceToNow(new Date(reward.nextAvailable)),
      });
    }
    return t("redeem");
  };

  return (
    <div
      className={cn(
        "bg-card relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all",
        !reward.canRedeem && "opacity-60",
        isPrimaryGoal && "ring-primary ring-2 ring-offset-2",
        className
      )}
    >
      {/* Header with emoji and badges */}
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-xl text-3xl",
            reward.canRedeem
              ? "bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30"
              : "bg-muted grayscale"
          )}
        >
          {reward.emoji}
        </div>

        <div className="flex gap-1">
          {isPrimaryGoal && (
            <Badge variant="secondary" className="gap-1">
              <Target className="h-3 w-3" />
              {t("primaryGoal")}
            </Badge>
          )}
          {reward.limitType !== "none" && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {t(
                `limit${reward.limitType.charAt(0).toUpperCase()}${reward.limitType.slice(1)}`
              )}
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mt-4">
        <h3 className="text-lg font-semibold">{reward.title}</h3>
        {reward.description && (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
            {reward.description}
          </p>
        )}
      </div>

      {/* Footer with cost and actions */}
      <div className="mt-4 flex items-center justify-between">
        <div
          className={cn(
            "flex items-center gap-1 text-lg font-bold",
            reward.canRedeem ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Star
            className={cn(
              "h-5 w-5",
              reward.canRedeem && "fill-primary text-primary"
            )}
          />
          {reward.starCost}
        </div>

        <div className="flex gap-2">
          {isManageMode && (
            <>
              {onSetGoal && !isPrimaryGoal && (
                <Button variant="ghost" size="sm" onClick={onSetGoal}>
                  <Target className="h-4 w-4" />
                </Button>
              )}
              {onEdit && (
                <Button variant="ghost" size="sm" onClick={onEdit}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button variant="ghost" size="sm" onClick={onDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
          <Button onClick={onRedeem} disabled={!reward.canRedeem} size="sm">
            {getButtonContent()}
          </Button>
        </div>
      </div>
    </div>
  );
}
