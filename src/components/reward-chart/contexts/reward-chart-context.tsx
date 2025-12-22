"use client";

import type React from "react";
import { createContext, useContext, useState, useCallback } from "react";
import type {
  WeeklyChartData,
  CompleteTaskResponse,
  UndoCompletionResponse,
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
}

const RewardChartContext = createContext<RewardChartContextValue | undefined>(
  undefined
);

interface RewardChartProviderProps {
  children: React.ReactNode;
  familyId: string;
  chartId: string;
  initialData: WeeklyChartData | null;
}

export function RewardChartProvider({
  children,
  familyId,
  chartId,
  initialData,
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
