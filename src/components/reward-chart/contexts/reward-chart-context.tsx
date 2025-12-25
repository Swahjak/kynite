"use client";

import type React from "react";
import { createContext, useContext } from "react";
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
import {
  useRewardChartWeek,
  useCompleteTask,
  useUndoTaskCompletion,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useReorderTasks,
  useCreateGoal,
  useUpdateGoal,
  useSendChartMessage,
} from "@/hooks/use-reward-chart";

interface RewardChartContextValue {
  weekData: WeeklyChartData | null;
  isLoading: boolean;
  error: Error | null;
  completeTask: (taskId: string) => Promise<CompleteTaskResponse | null>;
  undoCompletion: (taskId: string) => Promise<UndoCompletionResponse | null>;
  familyId: string;
  chartId: string;
  isManager: boolean;
  allChildren?: ChildChartInfo[];
  createTask: (input: CreateTaskInput) => Promise<void>;
  updateTask: (taskId: string, input: UpdateTaskInput) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  reorderTasks: (taskIds: string[]) => Promise<void>;
  createGoal: (input: CreateGoalInput) => Promise<void>;
  updateGoal: (goalId: string, input: UpdateGoalInput) => Promise<void>;
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
  // React Query hooks
  const {
    data: weekData = initialData,
    isLoading,
    error,
  } = useRewardChartWeek(familyId, chartId);

  const completeTaskMutation = useCompleteTask(familyId, chartId);
  const undoTaskMutation = useUndoTaskCompletion(familyId, chartId);
  const createTaskMutation = useCreateTask(familyId, chartId);
  const updateTaskMutation = useUpdateTask(familyId, chartId);
  const deleteTaskMutation = useDeleteTask(familyId, chartId);
  const reorderTasksMutation = useReorderTasks(familyId, chartId);
  const createGoalMutation = useCreateGoal(familyId, chartId);
  const updateGoalMutation = useUpdateGoal(familyId, chartId);
  const sendMessageMutation = useSendChartMessage(familyId, chartId);

  const completeTask = async (
    taskId: string
  ): Promise<CompleteTaskResponse | null> => {
    try {
      return await completeTaskMutation.mutateAsync(taskId);
    } catch {
      return null;
    }
  };

  const undoCompletion = async (
    taskId: string
  ): Promise<UndoCompletionResponse | null> => {
    try {
      return await undoTaskMutation.mutateAsync(taskId);
    } catch {
      return null;
    }
  };

  const createTask = async (input: CreateTaskInput) => {
    await createTaskMutation.mutateAsync(input);
  };

  const updateTask = async (taskId: string, input: UpdateTaskInput) => {
    await updateTaskMutation.mutateAsync({ taskId, input });
  };

  const deleteTask = async (taskId: string) => {
    await deleteTaskMutation.mutateAsync(taskId);
  };

  const reorderTasks = async (taskIds: string[]) => {
    await reorderTasksMutation.mutateAsync(taskIds);
  };

  const createGoal = async (input: CreateGoalInput) => {
    await createGoalMutation.mutateAsync(input);
  };

  const updateGoal = async (goalId: string, input: UpdateGoalInput) => {
    await updateGoalMutation.mutateAsync({ goalId, input });
  };

  const sendMessage = async (content: string) => {
    await sendMessageMutation.mutateAsync(content);
  };

  const value: RewardChartContextValue = {
    weekData,
    isLoading,
    error: error instanceof Error ? error : null,
    completeTask,
    undoCompletion,
    familyId,
    chartId,
    isManager,
    allChildren,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    createGoal,
    updateGoal,
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
