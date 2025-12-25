"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { z } from "zod";
import type {
  createRewardSchema,
  updateRewardSchema,
} from "@/lib/validations/reward";

// Use z.input to allow optional fields that have defaults in zod
type CreateRewardInput = z.input<typeof createRewardSchema>;
type UpdateRewardInput = z.input<typeof updateRewardSchema>;
import type {
  IReward,
  IStarTransaction,
} from "@/components/reward-store/interfaces";

interface Reward {
  id: string;
  title: string;
  description: string | null;
  starCost: number;
  isActive: boolean;
}

interface MemberStars {
  memberId: string;
  memberName: string;
  totalStars: number;
  weeklyStars: number;
}

// Query keys factory
export const rewardKeys = {
  all: ["rewards"] as const,
  family: (familyId: string) => [...rewardKeys.all, familyId] as const,
  list: (familyId: string) => [...rewardKeys.family(familyId), "list"] as const,
  stars: (familyId: string) =>
    [...rewardKeys.family(familyId), "stars"] as const,
  redemptions: (familyId: string) =>
    [...rewardKeys.family(familyId), "redemptions"] as const,
  memberBalance: (familyId: string, memberId: string) =>
    [...rewardKeys.family(familyId), "balance", memberId] as const,
  memberHistory: (familyId: string, memberId: string) =>
    [...rewardKeys.family(familyId), "history", memberId] as const,
  primaryGoal: (familyId: string, memberId: string) =>
    [...rewardKeys.family(familyId), "primaryGoal", memberId] as const,
};

export function useRewards(familyId: string) {
  return useQuery({
    queryKey: rewardKeys.list(familyId),
    queryFn: () =>
      apiFetch<{ rewards: Reward[] }>(
        `/api/v1/families/${familyId}/rewards`
      ).then((data) => data.rewards),
    enabled: !!familyId,
  });
}

export function useMemberStars(familyId: string) {
  return useQuery({
    queryKey: rewardKeys.stars(familyId),
    queryFn: () =>
      apiFetch<{ members: MemberStars[] }>(
        `/api/v1/families/${familyId}/rewards/stars`
      ).then((data) => data.members),
    enabled: !!familyId,
  });
}

export function useRedemptions(familyId: string) {
  return useQuery({
    queryKey: rewardKeys.redemptions(familyId),
    queryFn: () =>
      apiFetch<{ redemptions: unknown[] }>(
        `/api/v1/families/${familyId}/rewards/redemptions`
      ).then((data) => data.redemptions),
    enabled: !!familyId,
  });
}

export function useCreateReward(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRewardInput) =>
      apiFetch<{ reward: IReward }>(`/api/v1/families/${familyId}/rewards`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rewardKeys.family(familyId) });
    },
  });
}

export function useUpdateReward(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRewardInput }) =>
      apiFetch<{ reward: IReward }>(
        `/api/v1/families/${familyId}/rewards/${id}`,
        {
          method: "PUT",
          body: JSON.stringify(input),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rewardKeys.family(familyId) });
    },
  });
}

export function useDeleteReward(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/families/${familyId}/rewards/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rewardKeys.family(familyId) });
    },
  });
}

export function useRedeemReward(familyId: string, memberId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rewardId: string) =>
      apiFetch<{ newBalance: number }>(
        `/api/v1/families/${familyId}/rewards/${rewardId}/redeem`,
        {
          method: "POST",
          body: JSON.stringify({ memberId }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rewardKeys.family(familyId) });
    },
  });
}

// Member-specific queries
export function useMemberBalance(familyId: string, memberId: string) {
  return useQuery({
    queryKey: rewardKeys.memberBalance(familyId, memberId),
    queryFn: () =>
      apiFetch<{ balance: number }>(
        `/api/v1/families/${familyId}/members/${memberId}/stars`
      ).then((data) => data.balance),
    enabled: !!familyId && !!memberId,
  });
}

export function useMemberStarHistory(
  familyId: string,
  memberId: string,
  limit: number = 10
) {
  return useQuery({
    queryKey: rewardKeys.memberHistory(familyId, memberId),
    queryFn: () =>
      apiFetch<{ balance: number; history: IStarTransaction[] }>(
        `/api/v1/families/${familyId}/members/${memberId}/stars?includeHistory=true&limit=${limit}`
      ).then((data) => ({
        balance: data.balance,
        transactions: data.history,
      })),
    enabled: !!familyId && !!memberId,
  });
}

export function usePrimaryGoal(familyId: string, memberId: string) {
  return useQuery({
    queryKey: rewardKeys.primaryGoal(familyId, memberId),
    queryFn: () =>
      apiFetch<{ goal: IReward | null }>(
        `/api/v1/families/${familyId}/members/${memberId}/primary-goal`
      ).then((data) => data.goal),
    enabled: !!familyId && !!memberId,
  });
}

export function useSetPrimaryGoal(familyId: string, memberId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (rewardId: string) =>
      apiFetch(
        `/api/v1/families/${familyId}/members/${memberId}/primary-goal`,
        {
          method: "PUT",
          body: JSON.stringify({ rewardId }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardKeys.primaryGoal(familyId, memberId),
      });
    },
  });
}

export function useClearPrimaryGoal(familyId: string, memberId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch(
        `/api/v1/families/${familyId}/members/${memberId}/primary-goal`,
        {
          method: "DELETE",
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardKeys.primaryGoal(familyId, memberId),
      });
    },
  });
}
