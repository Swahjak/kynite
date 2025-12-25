"use client";

import { useConfetti } from "@/components/confetti";
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
  const { fire } = useConfetti();
  const isCompleted = chore.status === "completed";

  const handleComplete = () => {
    onComplete(chore.id);
    fire(chore.starReward);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
      <Checkbox
        checked={isCompleted}
        disabled={disabled || isCompleted}
        onCheckedChange={handleComplete}
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
