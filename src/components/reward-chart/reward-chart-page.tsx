"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { WeeklyGrid } from "./weekly-grid";
import { NextRewardCard, MessageCard } from "./bottom-cards";
import { useRewardChart } from "./contexts/reward-chart-context";
import { useIsManager } from "@/hooks/use-is-manager";
import { useIsDevice } from "@/hooks/use-is-device";
import { PersonFilterChips } from "@/components/wall-hub/shared/person-filter-chips";

export function RewardChartPage() {
  const { weekData, isLoading, error, familyId, allChildren } =
    useRewardChart();
  const isManager = useIsManager();
  const isDevice = useIsDevice();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("rewardChart");

  const selectedMemberId = searchParams.get("child");

  // Handle selecting a child's chart
  const handleSelectChild = (childId: string | "all") => {
    if (childId === "all") return; // We don't use "all" for reward charts

    const child = allChildren?.find((c) => c.id === childId);
    if (!child) return;

    if (child.chartId) {
      // Navigate to the child's chart
      const params = new URLSearchParams(searchParams.toString());
      params.set("child", childId);
      router.push(`?${params.toString()}`);
    } else {
      // Create chart for child without one
      handleCreateChart(childId);
    }
  };

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
      router.push(`?child=${memberId}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("chartError"));
    }
  };

  if (error) {
    return (
      <div className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-medium text-red-600">
                Error loading chart
              </p>
              <p className="mt-1 text-sm text-slate-500">{error.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!weekData) {
    return (
      <div className="flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-medium text-slate-600">
                No chart found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Ask a parent to set up your star chart!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { chart } = weekData;

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Person Filter Chips - show for managers and devices with multiple children */}
        {(isManager || isDevice) && allChildren && allChildren.length > 1 && (
          <PersonFilterChips
            people={allChildren}
            selectedId={selectedMemberId || "all"}
            onSelect={handleSelectChild}
            showEveryone={false}
          />
        )}

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
    </div>
  );
}
