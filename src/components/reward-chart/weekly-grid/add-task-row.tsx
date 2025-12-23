"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface AddTaskRowProps {
  onClick: () => void;
}

export function AddTaskRow({ onClick }: AddTaskRowProps) {
  const t = useTranslations("rewardChart");

  return (
    <button
      onClick={onClick}
      className={cn(
        "col-span-full m-4 grid grid-cols-subgrid divide-x divide-slate-100 transition-colors hover:bg-slate-50/50 dark:divide-slate-700/50 dark:hover:bg-slate-800/50",
        "border-2 border-dashed border-slate-200 dark:border-slate-700",
        "rounded-lg"
      )}
    >
      <div className="flex items-center gap-3 px-4 py-2">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            "bg-slate-100 dark:bg-slate-800"
          )}
        >
          <Plus className="h-5 w-5 text-slate-500 dark:text-slate-400" />
        </div>
        <span className="text-sm font-medium text-slate-500 md:text-base dark:text-slate-400">
          {t("addTask")}
        </span>
      </div>
      {/* Empty cells for the 7 days */}
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="py-2" />
      ))}
    </button>
  );
}
