"use client";

import { useState, useCallback } from "react";
import { useChores } from "./contexts/chores-context";
import { useIsManager } from "@/hooks/use-is-manager";
import { ProgressCard } from "./components/progress-card";
import { FilterTabs } from "./components/filter-tabs";
import { Fab } from "./components/fab";
import { AllChoresView } from "./views/all-chores-view";
import { UrgentView } from "./views/urgent-view";
import { ChoreDialog, DeleteChoreDialog } from "./dialogs";
import { PersonFilterChips } from "@/components/wall-hub/shared/person-filter-chips";
import type { IChoreWithAssignee } from "@/types/chore";

export function Chores() {
  const {
    currentView,
    isLoading,
    members,
    selectedPersonId,
    setSelectedPersonId,
  } = useChores();
  const isManager = useIsManager();
  const canCreate = isManager;
  const canEdit = isManager;

  // Map members to PersonChip format
  const people = members.map((m) => ({
    id: m.id,
    name: m.displayName || m.user?.name || "",
    avatarColor: m.avatarColor,
    avatarUrl: m.user?.image,
    avatarFallback: (m.displayName || m.user?.name || "?")[0],
  }));

  // Dialog state
  const [choreDialogOpen, setChoreDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingChore, setEditingChore] = useState<IChoreWithAssignee | null>(
    null
  );
  const [deletingChore, setDeletingChore] = useState<IChoreWithAssignee | null>(
    null
  );

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
      {/* Progress */}
      <ProgressCard />

      {/* Person Filter Chips */}
      <PersonFilterChips
        people={people}
        selectedId={selectedPersonId}
        onSelect={setSelectedPersonId}
      />

      {/* View Tabs */}
      <FilterTabs />

      {/* Chore List */}
      <div className={isLoading ? "pointer-events-none opacity-50" : ""}>
        {currentView === "all" && (
          <AllChoresView
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
