"use client";

import { useMemo } from "react";
import { useChores } from "../contexts/chores-context";
import { ChoreCard } from "../components/chore-card";
import { sortChores } from "../helpers";
import type { IChoreWithAssignee } from "@/types/chore";

interface AllChoresViewProps {
  onEdit?: (chore: IChoreWithAssignee) => void;
  onDelete?: (chore: IChoreWithAssignee) => void;
}

export function AllChoresView({ onEdit, onDelete }: AllChoresViewProps) {
  const { chores, selectedPersonId } = useChores();

  const filteredChores = useMemo(() => {
    if (selectedPersonId === "all") return chores;
    return chores.filter((c) => c.assignedToId === selectedPersonId);
  }, [chores, selectedPersonId]);

  const sortedChores = sortChores(filteredChores);

  if (sortedChores.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center">
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
