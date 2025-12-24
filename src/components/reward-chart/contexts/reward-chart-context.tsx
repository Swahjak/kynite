"use client";

import type React from "react";
import { createContext, useContext, useState, useCallback } from "react";
import type {
  WeeklyChartData,
  CompleteTaskResponse,
  UndoCompletionResponse,
  CreateTaskInput,
  UpdateTaskInput,
  CreateGoalInput,
  UpdateGoalInput,
  ChildChartInfo,
} from "../interfaces";

interface RewardChartContextValue {
  weekData: WeeklyChartData | null;
  setWeekData: (data: WeeklyChartData | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: Error | null;
  setError: (error: Error | null) => void;
  completeTask: (taskId: string) => Promise<CompleteTaskResponse | null>;
  undoCompletion: (taskId: string) => Promise<UndoCompletionResponse | null>;
  refetch: () => Promise<void>;
  familyId: string;
  chartId: string;
  isManager: boolean;
  allChildren?: ChildChartInfo[];
  // Task mutations
  createTask: (input: CreateTaskInput) => Promise<void>;
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  reorderTasks: (taskIds: string[]) => Promise<void>;
  // Goal mutations
  createGoal: (input: CreateGoalInput) => Promise<void>;
  updateGoal: (goalId: string, input: UpdateGoalInput) => Promise<void>;
  // Message mutation
  sendMessage: (content: string) => Promise<void>;
}

const RewardChartContext = createContext<RewardChartContextValue | undefined>(
  undefined
);

interface RewardChartProviderProps {
  children: React.ReactNode;
  familyId: string;
  chartId: string;
  initialData: WeeklyChartData | null;
  isManager?: boolean;
  allChildren?: ChildChartInfo[];
}

export function RewardChartProvider({
  children,
  familyId,
  chartId,
  initialData,
  isManager = false,
  allChildren,
}: RewardChartProviderProps) {
  const [weekData, setWeekData] = useState<WeeklyChartData | null>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/week`
      );
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message ?? "Failed to fetch chart data");
      }

      setWeekData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [familyId, chartId]);

  const completeTask = useCallback(
    async (taskId: string): Promise<CompleteTaskResponse | null> => {
      try {
        const res = await fetch(
          `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/${taskId}/complete`,
          { method: "POST" }
        );
        const json = await res.json();

        if (!json.success) {
          throw new Error(json.error?.message ?? "Failed to complete task");
        }

        // Refetch to update UI
        await refetch();

        return json.data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
        return null;
      }
    },
    [familyId, chartId, refetch]
  );

  const undoCompletion = useCallback(
    async (taskId: string): Promise<UndoCompletionResponse | null> => {
      try {
        const res = await fetch(
          `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/${taskId}/undo`,
          { method: "POST" }
        );
        const json = await res.json();

        if (!json.success) {
          throw new Error(json.error?.message ?? "Failed to undo completion");
        }

        // Refetch to update UI
        await refetch();

        return json.data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
        return null;
      }
    },
    [familyId, chartId, refetch]
  );

  const createTask = useCallback(
    async (input: CreateTaskInput) => {
      const response = await fetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to create task");
      }
      await refetch();
    },
    [familyId, chartId, refetch]
  );

  const updateTask = useCallback(
    async (taskId: string, input: UpdateTaskInput) => {
      const response = await fetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/${taskId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to update task");
      }
      await refetch();
    },
    [familyId, chartId, refetch]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      const response = await fetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/${taskId}`,
        {
          method: "DELETE",
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to delete task");
      }
      await refetch();
    },
    [familyId, chartId, refetch]
  );

  const reorderTasks = useCallback(
    async (taskIds: string[]) => {
      const response = await fetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/reorder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskIds }),
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to reorder tasks");
      }
      await refetch();
    },
    [familyId, chartId, refetch]
  );

  const createGoal = useCallback(
    async (input: CreateGoalInput) => {
      const response = await fetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/goals`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to create goal");
      }
      await refetch();
    },
    [familyId, chartId, refetch]
  );

  const updateGoal = useCallback(
    async (goalId: string, input: UpdateGoalInput) => {
      const response = await fetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/goals/${goalId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to update goal");
      }
      await refetch();
    },
    [familyId, chartId, refetch]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const response = await fetch(
        `/api/v1/families/${familyId}/reward-charts/${chartId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to send message");
      }
      await refetch();
    },
    [familyId, chartId, refetch]
  );

  const value: RewardChartContextValue = {
    weekData,
    setWeekData,
    isLoading,
    setIsLoading,
    error,
    setError,
    completeTask,
    undoCompletion,
    refetch,
    familyId,
    chartId,
    isManager,
    allChildren,
    // Task mutations
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    // Goal mutations
    createGoal,
    updateGoal,
    // Message mutation
    sendMessage,
  };

  return (
    <RewardChartContext.Provider value={value}>
      {children}
    </RewardChartContext.Provider>
  );
}

export function useRewardChart() {
  const context = useContext(RewardChartContext);
  if (!context) {
    throw new Error("useRewardChart must be used within RewardChartProvider");
  }
  return context;
}
