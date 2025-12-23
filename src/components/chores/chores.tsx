"use client";

import { useState, useCallback } from "react";
import { useChores } from "./contexts/chores-context";
import { useInteractionModeSafe } from "@/components/calendar/contexts/interaction-mode-context";
import { ProgressCard } from "./components/progress-card";
import { FilterTabs } from "./components/filter-tabs";
import { Fab } from "./components/fab";
import { AllChoresView } from "./views/all-chores-view";
import { ByPersonView } from "./views/by-person-view";
import { UrgentView } from "./views/urgent-view";
import { ChoreDialog, DeleteChoreDialog } from "./dialogs";
import type { IChoreWithAssignee } from "@/types/chore";

interface ChoresProps {
  familyName: string;
}

export function Chores({ familyName }: ChoresProps) {
  const { currentView, isLoading } = useChores();
  const { canCreate, canEdit } = useInteractionModeSafe();

  // Dialog state
  const [choreDialogOpen, setChoreDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingChore, setEditingChore] = useState<IChoreWithAssignee | null>(
    null
  );
  const [deletingChore, setDeletingChore] = useState<IChoreWithAssignee | null>(
    null
  );

  // Get greeting based on time of day
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  // Handlers
  const handleCreate = useCallback(() => {
    setEditingChore(null);
    setChoreDialogOpen(true);
  }, []);

  const handleEdit = useCallback((chore: IChoreWithAssignee) => {
    setEditingChore(chore);
    setChoreDialogOpen(true);
  }, []);

  const handleDelete = useCallback((chore: IChoreWithAssignee) => {
    setDeletingChore(chore);
    setDeleteDialogOpen(true);
  }, []);

  const handleChoreDialogClose = useCallback((open: boolean) => {
    setChoreDialogOpen(open);
    if (!open) {
      setEditingChore(null);
    }
  }, []);

  const handleDeleteDialogClose = useCallback((open: boolean) => {
    setDeleteDialogOpen(open);
    if (!open) {
      setDeletingChore(null);
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-3xl font-bold">
          {greeting}, {familyName}!
        </h1>
        <p className="text-muted-foreground">
          Let&apos;s crush today&apos;s goals.
        </p>
      </div>

      {/* Progress */}
      <ProgressCard />

      {/* Filters */}
      <FilterTabs />

      {/* Chore List */}
      <div className={isLoading ? "pointer-events-none opacity-50" : ""}>
        {currentView === "all" && (
          <AllChoresView
            onEdit={canEdit ? handleEdit : undefined}
            onDelete={canEdit ? handleDelete : undefined}
          />
        )}
        {currentView === "by-person" && (
          <ByPersonView
            onEdit={canEdit ? handleEdit : undefined}
            onDelete={canEdit ? handleDelete : undefined}
          />
        )}
        {currentView === "urgent" && (
          <UrgentView
            onEdit={canEdit ? handleEdit : undefined}
            onDelete={canEdit ? handleDelete : undefined}
          />
        )}
      </div>

      {/* FAB - only visible in management mode */}
      {canCreate && <Fab onClick={handleCreate} />}

      {/* Dialogs */}
      <ChoreDialog
        open={choreDialogOpen}
        onOpenChange={handleChoreDialogClose}
        chore={editingChore}
      />

      <DeleteChoreDialog
        open={deleteDialogOpen}
        onOpenChange={handleDeleteDialogClose}
        chore={deletingChore}
      />
    </div>
  );
}
