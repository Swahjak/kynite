"use client";

import { createContext, useContext, useState } from "react";
import type {
  IChoreWithAssignee,
  IChoreProgress,
  ChoreViewFilter,
} from "@/types/chore";
import type { FamilyMemberWithUser } from "@/types/family";
import type {
  CreateChoreInput,
  UpdateChoreInput,
} from "@/lib/validations/chore";
import {
  useChores as useChoresQuery,
  useChoreProgress,
  useCompleteChore,
  useCreateChore,
  useUpdateChore,
  useDeleteChore,
} from "@/hooks/use-chores";

interface ChoresContextValue {
  chores: IChoreWithAssignee[];
  members: FamilyMemberWithUser[];
  progress: IChoreProgress;
  currentView: ChoreViewFilter;
  setCurrentView: (view: ChoreViewFilter) => void;
  selectedPersonId: string | "all";
  setSelectedPersonId: (id: string | "all") => void;
  completeChore: (choreId: string) => Promise<void>;
  isLoading: boolean;
  expandedChoreId: string | null;
  setExpandedChoreId: (id: string | null) => void;
  createChore: (input: CreateChoreInput) => Promise<void>;
  updateChore: (id: string, input: UpdateChoreInput) => Promise<void>;
  deleteChore: (id: string) => Promise<void>;
}

const ChoresContext = createContext<ChoresContextValue | null>(null);

interface ChoresProviderProps {
  children: React.ReactNode;
  familyId: string;
  initialChores: IChoreWithAssignee[];
  initialProgress: IChoreProgress;
  members: FamilyMemberWithUser[];
}

export function ChoresProvider({
  children,
  familyId,
  initialChores,
  initialProgress,
  members,
}: ChoresProviderProps) {
  // Local UI state
  const [currentView, setCurrentView] = useState<ChoreViewFilter>("all");
  const [selectedPersonId, setSelectedPersonId] = useState<string | "all">(
    "all"
  );
  const [expandedChoreId, setExpandedChoreId] = useState<string | null>(null);

  // React Query hooks for data fetching
  const { data: chores = initialChores, isLoading: isLoadingChores } =
    useChoresQuery(familyId, "pending");
  const { data: progress = initialProgress } = useChoreProgress(familyId);

  // React Query mutations
  const completeChoreMutation = useCompleteChore(familyId);
  const createChoreMutation = useCreateChore(familyId);
  const updateChoreMutation = useUpdateChore(familyId);
  const deleteChoreMutation = useDeleteChore(familyId);

  const completeChore = async (choreId: string) => {
    await completeChoreMutation.mutateAsync(choreId);
  };

  const createChore = async (input: CreateChoreInput) => {
    await createChoreMutation.mutateAsync(input);
  };

  const updateChore = async (id: string, input: UpdateChoreInput) => {
    await updateChoreMutation.mutateAsync({ id, input });
  };

  const deleteChore = async (id: string) => {
    setExpandedChoreId(null);
    await deleteChoreMutation.mutateAsync(id);
  };

  const value: ChoresContextValue = {
    chores,
    members,
    progress,
    currentView,
    setCurrentView,
    selectedPersonId,
    setSelectedPersonId,
    completeChore,
    isLoading: isLoadingChores,
    expandedChoreId,
    setExpandedChoreId,
    createChore,
    updateChore,
    deleteChore,
  };

  return (
    <ChoresContext.Provider value={value}>{children}</ChoresContext.Provider>
  );
}

export function useChores(): ChoresContextValue {
  const context = useContext(ChoresContext);
  if (!context) {
    throw new Error("useChores must be used within a ChoresProvider");
  }
  return context;
}
