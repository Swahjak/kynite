"use client";

import { AlertTriangle } from "lucide-react";
import { useChores } from "../contexts/chores-context";
import { ChoreCard } from "../components/chore-card";
import { getUrgentChores, sortChores } from "../helpers";
import type { IChoreWithAssignee } from "@/types/chore";

interface UrgentViewProps {
  onEdit?: (chore: IChoreWithAssignee) => void;
  onDelete?: (chore: IChoreWithAssignee) => void;
}

export function UrgentView({ onEdit, onDelete }: UrgentViewProps) {
  const { chores } = useChores();
  const urgentChores = sortChores(getUrgentChores(chores));

  if (urgentChores.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        <AlertTriangle className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p className="text-lg font-medium">No urgent chores</p>
        <p className="text-sm">Everything is on track!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {urgentChores.map((chore) => (
        <ChoreCard
          key={chore.id}
          chore={chore}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
