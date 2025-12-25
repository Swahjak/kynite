"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

interface FamilyMember {
  id: string;
  name: string;
  avatarColor: string;
}

// Query keys factory
export const familyKeys = {
  all: ["family"] as const,
  detail: (familyId: string) => [...familyKeys.all, familyId] as const,
  children: (familyId: string) =>
    [...familyKeys.detail(familyId), "children"] as const,
  invites: (familyId: string) =>
    [...familyKeys.detail(familyId), "invites"] as const,
};

export function useCreateFamily() {
  return useMutation({
    mutationFn: (input: { name: string }) =>
      apiFetch<{ family: { id: string } }>("/api/v1/families", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

export function useUpdateFamily(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name?: string }) =>
      apiFetch(`/api/v1/families/${familyId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: familyKeys.detail(familyId) });
    },
  });
}

export function useAddChild(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; avatarColor?: string }) =>
      apiFetch(`/api/v1/families/${familyId}/children`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: familyKeys.children(familyId),
      });
    },
  });
}

export function useUpdateChild(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      childId,
      input,
    }: {
      childId: string;
      input: { name?: string; avatarColor?: string; avatarSvg?: string };
    }) =>
      apiFetch(`/api/v1/families/${familyId}/children/${childId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: familyKeys.children(familyId),
      });
    },
  });
}

export function useDeleteChild(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (childId: string) =>
      apiFetch(`/api/v1/families/${familyId}/children/${childId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: familyKeys.children(familyId),
      });
    },
  });
}

export function useCreateInvite(familyId: string) {
  return useMutation({
    mutationFn: () =>
      apiFetch<{ invite: { token: string; expiresAt: string } }>(
        `/api/v1/families/${familyId}/invites`,
        { method: "POST", body: JSON.stringify({}) }
      ),
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: (token: string) =>
      apiFetch(`/api/v1/invites/${token}/accept`, { method: "POST" }),
  });
}

export function useInviteDetails(token: string) {
  return useQuery({
    queryKey: ["invite", token],
    queryFn: () => apiFetch<{ invite: unknown }>(`/api/v1/invites/${token}`),
    enabled: !!token,
  });
}

export function useGenerateUpgradeToken(familyId: string) {
  return useMutation({
    mutationFn: (childMemberId: string) =>
      apiFetch<{ upgradeToken: string }>(
        `/api/v1/families/${familyId}/children/${childMemberId}/upgrade-token`,
        { method: "POST" }
      ),
  });
}
