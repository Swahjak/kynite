"use client";

import { Progress } from "@/components/ui/progress";
import { useChores } from "../contexts/chores-context";

export function ProgressCard() {
  const { progress } = useChores();

  return (
    <div className="bg-card rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold">Today&apos;s Progress</span>
        <span className="text-muted-foreground text-sm">
          {progress.completed}/{progress.total} Done
        </span>
      </div>
      <Progress value={progress.percentage} className="h-3" />
    </div>
  );
}
