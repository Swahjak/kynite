"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface EmptyChartStateProps {
  familyId: string;
  memberId: string;
  memberName: string;
}

export function EmptyChartState({
  familyId,
  memberId,
  memberName,
}: EmptyChartStateProps) {
  const t = useTranslations("rewardChart");
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateChart = async () => {
    setIsCreating(true);
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
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("chartError"));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex-1 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-medium text-slate-600">
              No star chart for {memberName}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Create a star chart to track their progress!
            </p>
            <Button
              onClick={handleCreateChart}
              disabled={isCreating}
              className="mt-4"
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 size-4" />
                  {t("createChart")}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
