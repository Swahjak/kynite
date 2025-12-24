"use client";

import { createContext, useContext, useState, useCallback } from "react";
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

interface ChoresContextValue {
  chores: IChoreWithAssignee[];
  members: FamilyMemberWithUser[];
  progress: IChoreProgress;
  currentView: ChoreViewFilter;
  setCurrentView: (view: ChoreViewFilter) => void;
  selectedPersonId: string | "all";
  setSelectedPersonId: (id: string | "all") => void;
  completeChore: (choreId: string) => Promise<void>;
  refreshChores: () => Promise<void>;
  isLoading: boolean;
  // New: expanded card management
  expandedChoreId: string | null;
  setExpandedChoreId: (id: string | null) => void;
  // New: CRUD mutations
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
  const [chores, setChores] = useState<IChoreWithAssignee[]>(initialChores);
  const [progress, setProgress] = useState<IChoreProgress>(initialProgress);
  const [currentView, setCurrentView] = useState<ChoreViewFilter>("all");
  const [selectedPersonId, setSelectedPersonId] = useState<string | "all">(
    "all"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [expandedChoreId, setExpandedChoreId] = useState<string | null>(null);

  const refreshChores = useCallback(async () => {
    setIsLoading(true);
    try {
      const [choresRes, progressRes] = await Promise.all([
        fetch(`/api/v1/families/${familyId}/chores?status=pending`),
        fetch(`/api/v1/families/${familyId}/chores/progress`),
      ]);

      if (choresRes.ok) {
        const data = await choresRes.json();
        setChores(data.data.chores);
      }
      if (progressRes.ok) {
        const data = await progressRes.json();
        setProgress(data.data.progress);
      }
    } finally {
      setIsLoading(false);
    }
  }, [familyId]);

  const completeChore = useCallback(
    async (choreId: string) => {
      // Optimistic update
      setChores((prev) => prev.filter((c) => c.id !== choreId));
      setProgress((prev) => ({
        completed: prev.completed + 1,
        total: prev.total,
        percentage: Math.round(((prev.completed + 1) / prev.total) * 100),
      }));

      try {
        const res = await fetch(
          `/api/v1/families/${familyId}/chores/${choreId}/complete`,
          { method: "POST" }
        );

        if (!res.ok) {
          // Revert on error
          await refreshChores();
        }
      } catch {
        await refreshChores();
      }
    },
    [familyId, refreshChores]
  );

  const createChore = useCallback(
    async (input: CreateChoreInput) => {
      const res = await fetch(`/api/v1/families/${familyId}/chores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to create chore");
      }

      await refreshChores();
    },
    [familyId, refreshChores]
  );

  const updateChore = useCallback(
    async (id: string, input: UpdateChoreInput) => {
      const res = await fetch(`/api/v1/families/${familyId}/chores/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to update chore");
      }

      await refreshChores();
    },
    [familyId, refreshChores]
  );

  const deleteChore = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/v1/families/${familyId}/chores/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? "Failed to delete chore");
      }

      setExpandedChoreId(null);
      await refreshChores();
    },
    [familyId, refreshChores]
  );

  const value: ChoresContextValue = {
    chores,
    members,
    progress,
    currentView,
    setCurrentView,
    selectedPersonId,
    setSelectedPersonId,
    completeChore,
    refreshChores,
    isLoading,
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
