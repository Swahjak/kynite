"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { IChoreWithAssignee, IChoreProgress } from "@/types/chore";
import type {
  CreateChoreInput,
  UpdateChoreInput,
} from "@/lib/validations/chore";

// Query keys factory
export const choreKeys = {
  all: ["chores"] as const,
  family: (familyId: string) => [...choreKeys.all, familyId] as const,
  list: (familyId: string, status?: string) =>
    [...choreKeys.family(familyId), "list", status] as const,
  progress: (familyId: string) =>
    [...choreKeys.family(familyId), "progress"] as const,
};

export function useChores(familyId: string, status?: string) {
  return useQuery({
    queryKey: choreKeys.list(familyId, status),
    queryFn: () =>
      apiFetch<{ chores: IChoreWithAssignee[] }>(
        `/api/v1/families/${familyId}/chores${status ? `?status=${status}` : ""}`
      ).then((data) => data.chores),
    enabled: !!familyId,
  });
}

export function useChoreProgress(familyId: string) {
  return useQuery({
    queryKey: choreKeys.progress(familyId),
    queryFn: () =>
      apiFetch<{ progress: IChoreProgress }>(
        `/api/v1/families/${familyId}/chores/progress`
      ).then((data) => data.progress),
    enabled: !!familyId,
  });
}

export function useCompleteChore(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (choreId: string) =>
      apiFetch(`/api/v1/families/${familyId}/chores/${choreId}/complete`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.family(familyId) });
    },
  });
}

export function useCreateChore(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateChoreInput) =>
      apiFetch(`/api/v1/families/${familyId}/chores`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.family(familyId) });
    },
  });
}

export function useUpdateChore(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateChoreInput }) =>
      apiFetch(`/api/v1/families/${familyId}/chores/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.family(familyId) });
    },
  });
}

export function useDeleteChore(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/families/${familyId}/chores/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: choreKeys.family(familyId) });
    },
  });
}
