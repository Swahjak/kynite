"use client";

import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import { useConfetti } from "@/components/confetti";
import type { TaskCell as TaskCellType } from "../interfaces";

interface TaskCellProps {
  cell: TaskCellType;
  isToday: boolean;
  onComplete: () => void;
  onUndo: () => void;
  disabled?: boolean;
  starValue?: number;
}

export function TaskCell({
  cell,
  isToday,
  onComplete,
  onUndo,
  disabled,
  starValue,
}: TaskCellProps) {
  const { fire } = useConfetti();

  const handleClick = () => {
    if (disabled) return;

    if (cell.status === "completed" && isToday) {
      onUndo();
    } else if (cell.status === "pending") {
      onComplete();
      fire(starValue ?? 1);
    }
  };

  const isInteractive =
    !disabled &&
    (cell.status === "pending" || (cell.status === "completed" && isToday));

  return (
    <div
      className={cn(
        "flex h-12 items-center justify-center border-l border-slate-100 dark:border-slate-700/50",
        isToday && "bg-indigo-50/20 dark:bg-indigo-500/10",
        cell.status === "not_applicable" &&
          "bg-slate-50/50 dark:bg-slate-800/50"
      )}
    >
      {cell.status === "completed" && (
        <button
          onClick={handleClick}
          disabled={!isToday || disabled}
          className={cn(
            "text-[28px] drop-shadow-sm transition-transform",
            isToday && !disabled && "cursor-pointer hover:scale-110"
          )}
          aria-label="Completed - click to undo"
        >
          ⭐
        </button>
      )}

      {cell.status === "pending" && (
        <button
          onClick={handleClick}
          disabled={disabled}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full",
            "border-2 border-dashed border-slate-300 dark:border-slate-600",
            "text-slate-300 dark:text-slate-600",
            "transition-all",
            !disabled &&
              "hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-500",
            !disabled &&
              "dark:hover:border-emerald-400 dark:hover:bg-emerald-950 dark:hover:text-emerald-400"
          )}
          aria-label="Pending - click to complete"
        >
          <Check className="h-4 w-4" />
        </button>
      )}

      {cell.status === "missed" && (
        <X
          className="h-5 w-5 text-slate-300 dark:text-slate-600"
          aria-label="Missed"
        />
      )}

      {cell.status === "not_applicable" && (
        <div
          className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700"
          aria-label="Not scheduled"
        />
      )}

      {cell.status === "future" && null}
    </div>
  );
}
