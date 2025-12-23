"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { FamilyAvatar } from "@/components/family/family-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AvatarColor } from "@/types/family";
import { Star, Plus } from "lucide-react";

interface ChartOption {
  memberId: string;
  memberName: string;
  memberAvatar?: string | null;
  chartId: string | null;
  totalStars: number;
}

interface ChartSelectorProps {
  charts: ChartOption[];
  selectedMemberId: string | null;
  onCreateChart: (memberId: string) => void;
}

export function ChartSelector({
  charts,
  selectedMemberId,
  onCreateChart,
}: ChartSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("rewardChart");

  const handleSelectChart = (memberId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("child", memberId);
    router.push(`?${params.toString()}`);
  };

  if (charts.length === 0) {
    return null;
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex gap-3 pb-2">
        {charts.map((chart) => {
          const isSelected = chart.memberId === selectedMemberId;
          const hasChart = chart.chartId !== null;

          return (
            <Button
              key={chart.memberId}
              variant={isSelected ? "default" : "outline"}
              onClick={() => {
                if (hasChart) {
                  handleSelectChart(chart.memberId);
                } else {
                  onCreateChart(chart.memberId);
                }
              }}
              className={cn(
                "flex h-auto min-w-[100px] flex-col items-center gap-2 px-4 py-3",
                isSelected && "ring-primary ring-2 ring-offset-2"
              )}
            >
              <FamilyAvatar
                name={chart.memberName}
                color={(chart.memberAvatar as AvatarColor) || null}
                size="md"
              />
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm leading-none font-medium">
                  {chart.memberName}
                </span>
                {hasChart ? (
                  <div className="flex items-center gap-1 text-xs">
                    <Star className="size-3 fill-current" />
                    <span>{chart.totalStars}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs">
                    <Plus className="size-3" />
                    <span>{t("createChart")}</span>
                  </div>
                )}
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
