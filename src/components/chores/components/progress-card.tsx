"use client";

import { Trophy } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useChores } from "../contexts/chores-context";

export function ProgressCard() {
  const { progress } = useChores();

  // TODO: Implement actual streak tracking
  const streak = 12;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <span className="font-semibold">Daily Streak: {streak} Days</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {progress.completed}/{progress.total} Done
        </span>
      </div>
      <Progress value={progress.percentage} className="h-3" />
    </div>
  );
}
