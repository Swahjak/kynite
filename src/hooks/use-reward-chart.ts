"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  WeeklyChartData,
  CompleteTaskResponse,
  UndoCompletionResponse,
  CreateTaskInput,
  UpdateTaskInput,
  CreateGoalInput,
  UpdateGoalInput,
} from "@/components/reward-chart/interfaces";

// Query keys factory
export const rewardChartKeys = {
  all: ["rewardChart"] as const,
  family: (familyId: string) => [...rewardChartKeys.all, familyId] as const,
  chart: (familyId: string, chartId: string) =>
    [...rewardChartKeys.family(familyId), chartId] as const,
  week: (familyId: string, chartId: string) =>
    [...rewardChartKeys.chart(familyId, chartId), "week"] as const,
};

export function useRewardChartWeek(familyId: string, chartId: string) {
  return useQuery({
    queryKey: rewardChartKeys.week(familyId, chartId),
    queryFn: () =>
      apiFetch<WeeklyChartData>(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/week`
      ),
    enabled: !!familyId && !!chartId,
  });
}

export function useCompleteTask(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch<CompleteTaskResponse>(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/${taskId}/complete`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useUndoTaskCompletion(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch<UndoCompletionResponse>(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/${taskId}/undo`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useCreateTask(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      apiFetch(`/api/v1/families/${familyId}/reward-charts/${chartId}/tasks`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useUpdateTask(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      input,
    }: {
      taskId: string;
      input: UpdateTaskInput;
    }) =>
      apiFetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/${taskId}`,
        { method: "PUT", body: JSON.stringify(input) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useDeleteTask(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/${taskId}`,
        { method: "DELETE" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useReorderTasks(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskIds: string[]) =>
      apiFetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/reorder`,
        { method: "POST", body: JSON.stringify({ taskIds }) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useCreateGoal(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateGoalInput) =>
      apiFetch(`/api/v1/families/${familyId}/reward-charts/${chartId}/goals`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useUpdateGoal(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      goalId,
      input,
    }: {
      goalId: string;
      input: UpdateGoalInput;
    }) =>
      apiFetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/goals/${goalId}`,
        { method: "PUT", body: JSON.stringify(input) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useSendChartMessage(familyId: string, chartId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) =>
      apiFetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/messages`,
        { method: "POST", body: JSON.stringify({ content }) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.chart(familyId, chartId),
      });
    },
  });
}

export function useCreateRewardChart(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) =>
      apiFetch(`/api/v1/families/${familyId}/reward-charts`, {
        method: "POST",
        body: JSON.stringify({ memberId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rewardChartKeys.family(familyId),
      });
    },
  });
}
