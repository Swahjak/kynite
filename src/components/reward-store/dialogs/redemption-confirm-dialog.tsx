"use client";

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
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import type { IReward } from "../interfaces";

interface RedemptionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reward: IReward;
  currentBalance: number;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function RedemptionConfirmDialog({
  open,
  onOpenChange,
  reward,
  currentBalance,
  onConfirm,
  isLoading,
}: RedemptionConfirmDialogProps) {
  const t = useTranslations("rewardStore");
  const balanceAfter = currentBalance - reward.starCost;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-4xl dark:from-amber-900/30 dark:to-orange-900/30">
            {reward.emoji}
          </div>
          <AlertDialogTitle className="text-center">
            {t("confirmRedeem")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {t("confirmRedeemDescription", {
              cost: reward.starCost,
              reward: reward.title,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="bg-muted my-4 flex items-center justify-center gap-2 rounded-lg p-3">
          <Star className="fill-primary text-primary h-5 w-5" />
          <span className="font-medium">
            {t("balanceAfter", { balance: balanceAfter })}
          </span>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "..." : t("redeemNow")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
