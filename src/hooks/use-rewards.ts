"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  CreateRewardInput,
  UpdateRewardInput,
} from "@/lib/validations/reward";

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
      apiFetch(`/api/v1/families/${familyId}/rewards`, {
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
      apiFetch(`/api/v1/families/${familyId}/rewards/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
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

export function useRedeemReward(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      rewardId,
      memberId,
    }: {
      rewardId: string;
      memberId: string;
    }) =>
      apiFetch(`/api/v1/families/${familyId}/rewards/${rewardId}/redeem`, {
        method: "POST",
        body: JSON.stringify({ memberId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rewardKeys.family(familyId) });
    },
  });
}
