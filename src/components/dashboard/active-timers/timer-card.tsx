"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Pause, Plus } from "lucide-react";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { useDashboard } from "../contexts/dashboard-context";
import type { Timer } from "../types";

interface TimerCardProps {
  timer: Timer;
}

export function TimerCard({ timer }: TimerCardProps) {
  const { mode } = useInteractionMode();
  const { pauseTimer, extendTimer } = useDashboard();

  const minutes = Math.floor(timer.remainingSeconds / 60);
  const seconds = timer.remainingSeconds % 60;
  const progress = (timer.remainingSeconds / timer.totalSeconds) * 100;

  return (
    <Card>
      <CardContent className="p-3 md:p-4">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold">{timer.title}</h3>
            <p className="text-muted-foreground text-xs">{timer.subtitle}</p>
          </div>
        </div>

        <div className="mb-2 text-center">
          <span className="text-3xl font-bold tabular-nums md:text-4xl">
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>
          <span className="text-muted-foreground ml-1 text-xs">min left</span>
        </div>

        <Progress value={progress} className="mb-2 h-1.5" />

        {mode === "manage" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex-1 text-xs"
              onClick={() => extendTimer(timer.id, 900)}
            >
              <Plus className="mr-1 h-3 w-3" />
              15m
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 flex-1 text-xs"
              onClick={() => pauseTimer(timer.id)}
            >
              <Pause className="mr-1 h-3 w-3" />
              Pauze
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
