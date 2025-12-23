"use client";

import { useChores } from "../contexts/chores-context";
import { ChoreCard } from "../components/chore-card";
import { sortChores } from "../helpers";
import type { IChoreWithAssignee } from "@/types/chore";

interface AllChoresViewProps {
  onEdit?: (chore: IChoreWithAssignee) => void;
  onDelete?: (chore: IChoreWithAssignee) => void;
}

export function AllChoresView({ onEdit, onDelete }: AllChoresViewProps) {
  const { chores } = useChores();
  const sortedChores = sortChores(chores);

  if (sortedChores.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">All done! 🎉</p>
        <p className="text-sm">No pending chores right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedChores.map((chore) => (
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
