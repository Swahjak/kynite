"use client";

import { Trophy } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useChores } from "../contexts/chores-context";

export function ProgressCard() {
  const { progress } = useChores();

  // TODO: Implement actual streak tracking
  const streak = 12;

  return (
    <div className="bg-card rounded-xl border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="text-primary h-5 w-5" />
          <span className="font-semibold">Daily Streak: {streak} Days</span>
        </div>
        <span className="text-muted-foreground text-sm">
          {progress.completed}/{progress.total} Done
        </span>
      </div>
      <Progress value={progress.percentage} className="h-3" />
    </div>
  );
}
