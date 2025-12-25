"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type {
  IReward,
  IRewardWithStatus,
  IRedemption,
  IStarTransaction,
  CreateRewardInput,
  UpdateRewardInput,
} from "../interfaces";

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
  const [data, setData] = useState<RewardStoreData>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch rewards with status
      const [rewardsRes, balanceRes, historyRes, goalRes] = await Promise.all([
        fetch(`/api/v1/families/${familyId}/rewards`),
        fetch(`/api/v1/families/${familyId}/members/${memberId}/stars`),
        fetch(
          `/api/v1/families/${familyId}/members/${memberId}/stars/history?limit=10`
        ),
        fetch(`/api/v1/families/${familyId}/members/${memberId}/primary-goal`),
      ]);

      const [rewardsData, balanceData, historyData, goalData] =
        await Promise.all([
          rewardsRes.json(),
          balanceRes.json(),
          historyRes.json(),
          goalRes.json(),
        ]);

      // Calculate which rewards can be redeemed
      const rewardsWithStatus: IRewardWithStatus[] = await Promise.all(
        rewardsData.rewards.map(async (reward: IReward) => {
          // Check redemption status
          const canAfford = balanceData.balance >= reward.starCost;
          return {
            ...reward,
            canRedeem: canAfford, // Simplified - full check happens server-side
            reason: canAfford ? undefined : "insufficient_stars",
            starsNeeded: canAfford
              ? undefined
              : reward.starCost - balanceData.balance,
          };
        })
      );

      // Calculate weekly delta
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weeklyDelta = (historyData.transactions || [])
        .filter((t: IStarTransaction) => new Date(t.createdAt) >= weekAgo)
        .reduce((sum: number, t: IStarTransaction) => sum + t.amount, 0);

      setData({
        rewards: rewardsWithStatus,
        redemptions: [], // Fetch separately if on redeemed tab
        balance: balanceData.balance,
        weeklyDelta,
        recentTransactions: historyData.transactions || [],
        primaryGoal: goalData.goal,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load data"));
    } finally {
      setIsLoading(false);
    }
  }, [familyId, memberId]);

  const createReward = useCallback(
    async (input: CreateRewardInput) => {
      const res = await fetch(`/api/v1/families/${familyId}/rewards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create reward");
      }

      const { reward } = await res.json();
      await refreshData();
      return reward;
    },
    [familyId, refreshData]
  );

  const updateReward = useCallback(
    async (id: string, input: UpdateRewardInput) => {
      const res = await fetch(`/api/v1/families/${familyId}/rewards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update reward");
      }

      const { reward } = await res.json();
      await refreshData();
      return reward;
    },
    [familyId, refreshData]
  );

  const deleteReward = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/v1/families/${familyId}/rewards/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete reward");
      }

      await refreshData();
    },
    [familyId, refreshData]
  );

  const redeemReward = useCallback(
    async (rewardId: string) => {
      const res = await fetch(
        `/api/v1/families/${familyId}/rewards/${rewardId}/redeem`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to redeem reward");
      }

      const result = await res.json();
      await refreshData();
      return { newBalance: result.newBalance };
    },
    [familyId, memberId, refreshData]
  );

  const setPrimaryGoalFn = useCallback(
    async (rewardId: string) => {
      const res = await fetch(
        `/api/v1/families/${familyId}/members/${memberId}/primary-goal`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rewardId }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to set primary goal");
      }

      await refreshData();
    },
    [familyId, memberId, refreshData]
  );

  const clearPrimaryGoal = useCallback(async () => {
    const res = await fetch(
      `/api/v1/families/${familyId}/members/${memberId}/primary-goal`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to clear primary goal");
    }

    await refreshData();
  }, [familyId, memberId, refreshData]);

  return (
    <RewardStoreContext.Provider
      value={{
        familyId,
        memberId,
        data,
        isLoading,
        error,
        isManager,
        allChildren,
        createReward,
        updateReward,
        deleteReward,
        redeemReward,
        setPrimaryGoal: setPrimaryGoalFn,
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
