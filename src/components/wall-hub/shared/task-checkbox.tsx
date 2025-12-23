"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { IChoreWithAssignee } from "@/types/chore";

interface TaskCheckboxProps {
  chore: IChoreWithAssignee;
  onComplete: (choreId: string) => void;
  disabled?: boolean;
}

export function TaskCheckbox({
  chore,
  onComplete,
  disabled,
}: TaskCheckboxProps) {
  const isCompleted = chore.status === "completed";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
      <Checkbox
        checked={isCompleted}
        disabled={disabled || isCompleted}
        onCheckedChange={() => onComplete(chore.id)}
        className="size-5"
      />
      <span
        className={cn(
          "text-sm font-medium",
          isCompleted && "text-muted-foreground line-through"
        )}
      >
        {chore.title}
      </span>
    </div>
  );
}
