"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { TimerTemplate, ActiveTimer } from "@/server/schema";

// Query keys factory
export const timerKeys = {
  all: ["timers"] as const,
  templates: () => [...timerKeys.all, "templates"] as const,
  active: () => [...timerKeys.all, "active"] as const,
};

export function useTimerTemplates() {
  return useQuery({
    queryKey: timerKeys.templates(),
    queryFn: () =>
      apiFetch<{ templates: TimerTemplate[] }>("/api/v1/timers/templates").then(
        (data) => data.templates
      ),
  });
}

export function useActiveTimers() {
  return useQuery({
    queryKey: timerKeys.active(),
    queryFn: () =>
      apiFetch<{ timers: ActiveTimer[] }>("/api/v1/timers/active").then(
        (data) => data.timers
      ),
    staleTime: Infinity, // Real-time updates via Pusher
  });
}

export function useStartTimer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      templateId: string;
      assignedToId?: string;
      deviceId?: string;
    }) =>
      apiFetch("/api/v1/timers/active", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timerKeys.active() });
    },
  });
}

export function useCreateTimerTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<TimerTemplate>) =>
      apiFetch("/api/v1/timers/templates", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timerKeys.templates() });
    },
  });
}

export function useUpdateTimerTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<TimerTemplate> }) =>
      apiFetch(`/api/v1/timers/templates/${id}`, {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timerKeys.templates() });
    },
  });
}

export function useDeleteTimerTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/v1/timers/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: timerKeys.templates() });
    },
  });
}
