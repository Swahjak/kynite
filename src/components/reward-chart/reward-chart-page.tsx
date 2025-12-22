"use client";

import { ChartHeader } from "./chart-header";
import { WeeklyGrid } from "./weekly-grid";
import { NextRewardCard, MessageCard } from "./bottom-cards";
import { useRewardChart } from "./contexts/reward-chart-context";

export function RewardChartPage() {
  const { weekData, isLoading, error } = useRewardChart();

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-red-600">
            Error loading chart
          </p>
          <p className="mt-1 text-sm text-slate-500">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!weekData) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-slate-600">No chart found</p>
          <p className="mt-1 text-sm text-slate-500">
            Ask a parent to set up your star chart!
          </p>
        </div>
      </div>
    );
  }

  const { chart } = weekData;

  return (
    <div className="space-y-6">
      {/* Header with Goal Progress */}
      <ChartHeader chart={chart} />

      {/* Weekly Grid */}
      <WeeklyGrid
        className={isLoading ? "pointer-events-none opacity-50" : ""}
      />

      {/* Bottom Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <NextRewardCard goal={chart.activeGoal} />
        <MessageCard message={chart.currentMessage} />
      </div>
    </div>
  );
}
