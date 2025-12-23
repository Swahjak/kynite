"use client";

import { ChartHeader } from "./chart-header";
import { WeeklyGrid } from "./weekly-grid";
import { NextRewardCard, MessageCard } from "./bottom-cards";
import { ChartSelector } from "./chart-selector";
import { useRewardChart } from "./contexts/reward-chart-context";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function RewardChartPage() {
  const { weekData, isLoading, error, familyId } = useRewardChart();
  const { mode } = useInteractionMode();
  const searchParams = useSearchParams();
  const t = useTranslations("rewardChart");

  const isManageMode = mode === "manage";
  const selectedMemberId = searchParams.get("child");

  // Handle chart creation for a child
  const handleCreateChart = async (memberId: string) => {
    try {
      const response = await fetch(
        `/api/v1/families/${familyId}/reward-charts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ memberId }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || "Failed to create chart");
      }

      toast.success(t("chartCreated"));
      // Refresh to show new chart
      window.location.href = `?child=${memberId}`;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("chartError")
      );
    }
  };

  // Build childCharts array from weekData
  // Note: This is a simplified version. In a full implementation, you would fetch
  // all family members and their charts. For now, we'll show the selector only if
  // we have chart data (meaning we're in manage mode with access to family data).
  const childCharts =
    weekData?.chart.member
      ? [
          {
            memberId: weekData.chart.member.id,
            memberName: weekData.chart.member.displayName || "Child",
            memberAvatar: weekData.chart.member.avatarColor,
            chartId: weekData.chart.id,
            totalStars: weekData.chart.activeGoal?.starsCurrent || 0,
          },
        ]
      : [];

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
      {/* Chart Selector - only show in manage mode and when there are children */}
      {isManageMode && childCharts.length > 0 && (
        <ChartSelector
          charts={childCharts}
          selectedMemberId={selectedMemberId}
          onCreateChart={handleCreateChart}
        />
      )}

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
