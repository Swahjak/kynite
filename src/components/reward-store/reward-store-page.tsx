"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, ShoppingBag, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { toast } from "sonner";
import { useRewardStore } from "./contexts/reward-store-context";
import { StarBalanceCard } from "./star-balance-card";
import { RewardCard } from "./reward-card";
import { RewardDialog } from "./dialogs/reward-dialog";
import { RedemptionConfirmDialog } from "./dialogs/redemption-confirm-dialog";
import type {
  IReward,
  IRewardWithStatus,
  CreateRewardInput,
} from "./interfaces";

export function RewardStorePage() {
  const t = useTranslations("rewardStore");
  const { mode } = useInteractionMode();
  const isManageMode = mode === "manage";

  const {
    data,
    isLoading,
    createReward,
    updateReward,
    deleteReward,
    redeemReward,
    setPrimaryGoal,
  } = useRewardStore();

  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<IReward | undefined>();
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [selectedReward, setSelectedReward] =
    useState<IRewardWithStatus | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const handleCreateReward = async (input: CreateRewardInput) => {
    try {
      await createReward(input);
      toast.success("Reward created!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create reward"
      );
      throw error;
    }
  };

  const handleUpdateReward = async (input: CreateRewardInput) => {
    if (!editingReward) return;
    try {
      await updateReward(editingReward.id, input);
      toast.success("Reward updated!");
      setEditingReward(undefined);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update reward"
      );
      throw error;
    }
  };

  const handleDeleteReward = async (reward: IReward) => {
    try {
      await deleteReward(reward.id);
      toast.success("Reward deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete reward"
      );
    }
  };

  const handleRedeem = async () => {
    if (!selectedReward) return;
    setIsRedeeming(true);
    try {
      await redeemReward(selectedReward.id);
      toast.success(t("redeemedSuccess", { reward: selectedReward.title }));
      setRedeemDialogOpen(false);
      setSelectedReward(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to redeem");
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleSetPrimaryGoal = async (reward: IReward) => {
    try {
      await setPrimaryGoal(reward.id);
      toast.success("Primary goal set!");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to set goal"
      );
    }
  };

  const openRedeemDialog = (reward: IRewardWithStatus) => {
    setSelectedReward(reward);
    setRedeemDialogOpen(true);
  };

  const openEditDialog = (reward: IReward) => {
    setEditingReward(reward);
    setRewardDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header with balance */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
        </div>
        <StarBalanceCard
          balance={data.balance}
          weeklyDelta={data.weeklyDelta}
          className="md:w-64"
        />
      </div>

      {/* Main content with tabs */}
      <Tabs defaultValue="available" className="w-full">
        <TabsList>
          <TabsTrigger value="available" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            {t("available")}
          </TabsTrigger>
          <TabsTrigger value="redeemed" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            {t("redeemed")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="mt-6">
          {data.rewards.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center">
              <ShoppingBag className="text-muted-foreground/50 h-12 w-12" />
              <h3 className="mt-4 text-lg font-medium">{t("noRewards")}</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {t("noRewardsDescription")}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.rewards.map((reward) => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  isPrimaryGoal={data.primaryGoal?.id === reward.id}
                  onRedeem={() => openRedeemDialog(reward)}
                  onEdit={
                    isManageMode ? () => openEditDialog(reward) : undefined
                  }
                  onDelete={
                    isManageMode ? () => handleDeleteReward(reward) : undefined
                  }
                  onSetGoal={
                    isManageMode && data.primaryGoal?.id !== reward.id
                      ? () => handleSetPrimaryGoal(reward)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="redeemed" className="mt-6">
          {data.redemptions.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center">
              <CheckCircle className="text-muted-foreground/50 h-12 w-12" />
              <h3 className="mt-4 text-lg font-medium">{t("noRedemptions")}</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {t("noRedemptionsDescription")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.redemptions.map((redemption) => (
                <div
                  key={redemption.id}
                  className="bg-card flex items-center gap-4 rounded-lg border p-4"
                >
                  <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-lg text-2xl">
                    {redemption.reward?.emoji}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{redemption.reward?.title}</p>
                    <p className="text-muted-foreground text-sm">
                      {new Date(redemption.redeemedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-muted-foreground text-sm font-medium">
                    -{redemption.starCost} ⭐
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* FAB - only visible in manage mode */}
      {isManageMode && (
        <Button
          onClick={() => {
            setEditingReward(undefined);
            setRewardDialogOpen(true);
          }}
          size="icon"
          className={cn(
            "fixed right-6 bottom-6 z-50 h-14 w-14 rounded-full shadow-lg",
            "transition-transform hover:scale-105 active:scale-95"
          )}
          aria-label={t("createReward")}
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* Dialogs */}
      <RewardDialog
        open={rewardDialogOpen}
        onOpenChange={setRewardDialogOpen}
        reward={editingReward}
        onSubmit={editingReward ? handleUpdateReward : handleCreateReward}
      />

      {selectedReward && (
        <RedemptionConfirmDialog
          open={redeemDialogOpen}
          onOpenChange={setRedeemDialogOpen}
          reward={selectedReward}
          currentBalance={data.balance}
          onConfirm={handleRedeem}
          isLoading={isRedeeming}
        />
      )}
    </div>
  );
}
