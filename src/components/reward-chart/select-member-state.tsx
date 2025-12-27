"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PersonSelectorCards } from "@/components/shared/person-selector-cards";
import type { ChildChartInfo } from "./interfaces";

interface SelectMemberStateProps {
  familyId: string;
  children: ChildChartInfo[];
}

export function SelectMemberState({
  familyId,
  children,
}: SelectMemberStateProps) {
  const t = useTranslations("rewardChart");
  const router = useRouter();

  const handleSelectChild = async (childId: string | "all") => {
    if (childId === "all") return;

    const child = children.find((c) => c.id === childId);
    if (!child) return;

    if (child.chartId) {
      // Navigate to the child's chart
      router.push(`?child=${childId}`);
    } else {
      // Create chart for child without one
      try {
        const response = await fetch(
          `/api/v1/families/${familyId}/reward-charts`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ memberId: childId }),
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || "Failed to create chart");
        }

        toast.success(t("chartCreated"));
        router.push(`?child=${childId}`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("chartError"));
      }
    }
  };

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex min-h-[400px] flex-col items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-lg font-medium text-slate-600">
              {t("selectMemberTitle")}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {t("selectMemberDescription")}
            </p>
          </div>
          <PersonSelectorCards
            people={children}
            selectedId="all"
            onSelect={handleSelectChild}
          />
        </div>
      </div>
    </div>
  );
}
