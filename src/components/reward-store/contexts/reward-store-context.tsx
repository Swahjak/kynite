"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type {
  IReward,
  IRewardWithStatus,
  IRedemption,
  IStarTransaction,
  CreateRewardInput,
  UpdateRewardInput,
} from "../interfaces";
import {
  useRewards,
  useCreateReward,
  useUpdateReward,
  useDeleteReward,
  useRedeemReward,
  useMemberStarHistory,
  usePrimaryGoal,
  useSetPrimaryGoal,
  useClearPrimaryGoal,
  rewardKeys,
} from "@/hooks/use-rewards";
import { useQueryClient } from "@tanstack/react-query";

interface RewardStoreData {
  rewards: IRewardWithStatus[];
  redemptions: IRedemption[];
  balance: number;
  weeklyDelta: number;
  recentTransactions: IStarTransaction[];
  primaryGoal: IReward | null;
}

interface ChildInfo {
  id: string;
  name: string;
  avatarColor: string | null;
  avatarSvg?: string | null;
  avatarUrl?: string | null;
  balance: number;
}

interface RewardStoreContextValue {
  familyId: string;
  memberId: string;
  data: RewardStoreData;
  isLoading: boolean;
  error: Error | null;
  isManager: boolean;
  allChildren?: ChildInfo[];
  // Actions
  createReward: (input: CreateRewardInput) => Promise<IReward>;
  updateReward: (id: string, input: UpdateRewardInput) => Promise<IReward>;
  deleteReward: (id: string) => Promise<void>;
  redeemReward: (rewardId: string) => Promise<{ newBalance: number }>;
  setPrimaryGoal: (rewardId: string) => Promise<void>;
  clearPrimaryGoal: () => Promise<void>;
  refreshData: () => Promise<void>;
}

const RewardStoreContext = createContext<RewardStoreContextValue | null>(null);

interface RewardStoreProviderProps {
  children: ReactNode;
  familyId: string;
  memberId: string;
  initialData: RewardStoreData;
  isManager?: boolean;
  allChildren?: ChildInfo[];
}

export function RewardStoreProvider({
  children,
  familyId,
  memberId,
  initialData,
  isManager = false,
  allChildren,
}: RewardStoreProviderProps) {
  const queryClient = useQueryClient();

  // React Query hooks for fetching data
  const {
    data: rewards = [],
    isLoading: isLoadingRewards,
    error: rewardsError,
  } = useRewards(familyId);

  const {
    data: historyData,
    isLoading: isLoadingHistory,
    error: historyError,
  } = useMemberStarHistory(familyId, memberId, 10);

  const {
    data: primaryGoal = null,
    isLoading: isLoadingGoal,
    error: goalError,
  } = usePrimaryGoal(familyId, memberId);

  // Mutation hooks
  const createRewardMutation = useCreateReward(familyId);
  const updateRewardMutation = useUpdateReward(familyId);
  const deleteRewardMutation = useDeleteReward(familyId);
  const redeemRewardMutation = useRedeemReward(familyId, memberId);
  const setPrimaryGoalMutation = useSetPrimaryGoal(familyId, memberId);
  const clearPrimaryGoalMutation = useClearPrimaryGoal(familyId, memberId);

  // Derive balance and transactions from history data
  const balance = historyData?.balance ?? initialData.balance;
  const recentTransactions =
    historyData?.transactions ?? initialData.recentTransactions;

  // Calculate weekly delta from transactions
  const weeklyDelta = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return recentTransactions
      .filter((t) => new Date(t.createdAt) >= weekAgo)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [recentTransactions]);

  // Calculate rewards with status based on balance
  const rewardsWithStatus: IRewardWithStatus[] = useMemo(() => {
    return (rewards as IReward[]).map((reward) => {
      const canAfford = balance >= reward.starCost;
      return {
        ...reward,
        canRedeem: canAfford,
        reason: canAfford ? undefined : "insufficient_stars",
        starsNeeded: canAfford ? undefined : reward.starCost - balance,
      };
    });
  }, [rewards, balance]);

  // Combine loading and error states
  const isLoading = isLoadingRewards || isLoadingHistory || isLoadingGoal;
  const error = rewardsError || historyError || goalError;

  // Build data object
  const data: RewardStoreData = useMemo(
    () => ({
      rewards: rewardsWithStatus,
      redemptions: initialData.redemptions, // Keep from initial - separate fetch if needed
      balance,
      weeklyDelta,
      recentTransactions,
      primaryGoal,
    }),
    [
      rewardsWithStatus,
      initialData.redemptions,
      balance,
      weeklyDelta,
      recentTransactions,
      primaryGoal,
    ]
  );

  // Action handlers
  const createReward = async (input: CreateRewardInput): Promise<IReward> => {
    const result = await createRewardMutation.mutateAsync(input);
    return result.reward;
  };

  const updateReward = async (
    id: string,
    input: UpdateRewardInput
  ): Promise<IReward> => {
    const result = await updateRewardMutation.mutateAsync({ id, input });
    return result.reward;
  };

  const deleteReward = async (id: string): Promise<void> => {
    await deleteRewardMutation.mutateAsync(id);
  };

  const redeemReward = async (
    rewardId: string
  ): Promise<{ newBalance: number }> => {
    const result = await redeemRewardMutation.mutateAsync(rewardId);
    return { newBalance: result.newBalance };
  };

  const setPrimaryGoal = async (rewardId: string): Promise<void> => {
    await setPrimaryGoalMutation.mutateAsync(rewardId);
  };

  const clearPrimaryGoal = async (): Promise<void> => {
    await clearPrimaryGoalMutation.mutateAsync();
  };

  const refreshData = async (): Promise<void> => {
    await queryClient.invalidateQueries({
      queryKey: rewardKeys.family(familyId),
    });
  };

  return (
    <RewardStoreContext.Provider
      value={{
        familyId,
        memberId,
        data,
        isLoading,
        error: error instanceof Error ? error : null,
        isManager,
        allChildren,
        createReward,
        updateReward,
        deleteReward,
        redeemReward,
        setPrimaryGoal,
        clearPrimaryGoal,
        refreshData,
      }}
    >
      {children}
    </RewardStoreContext.Provider>
  );
}

export function useRewardStore() {
  const context = useContext(RewardStoreContext);
  if (!context) {
    throw new Error("useRewardStore must be used within RewardStoreProvider");
  }
  return context;
}
