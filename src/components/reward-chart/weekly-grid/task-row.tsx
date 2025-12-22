"use client";

import { cn } from "@/lib/utils";
import { TaskCell } from "./task-cell";
import { ICON_COLORS, type IconColorKey } from "../constants";
import type { TaskRow as TaskRowType, WeekDay } from "../interfaces";

interface TaskRowProps {
  taskRow: TaskRowType;
  days: WeekDay[];
  onComplete: (taskId: string) => void;
  onUndo: (taskId: string) => void;
  disabled?: boolean;
}

export function TaskRow({
  taskRow,
  days,
  onComplete,
  onUndo,
  disabled,
}: TaskRowProps) {
  const { task, cells } = taskRow;
  const colors =
    ICON_COLORS[task.iconColor as IconColorKey] ?? ICON_COLORS.blue;

  return (
    <div className="grid grid-cols-[1.8fr_repeat(7,1fr)] divide-x divide-slate-100 transition-colors hover:bg-slate-50/50 dark:divide-slate-700/50 dark:hover:bg-slate-800/50">
      {/* Task Info */}
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Icon */}
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl",
            colors.bg,
            colors.darkBg
          )}
        >
          <span
            className={cn(
              "material-symbols-outlined text-xl",
              colors.text,
              colors.darkText
            )}
          >
            {task.icon}
          </span>
        </div>

        {/* Title */}
        <span className="text-sm font-semibold text-slate-700 md:text-base dark:text-slate-200">
          {task.title}
        </span>
      </div>

      {/* Cells */}
      {cells.map((cell, index) => (
        <TaskCell
          key={cell.date}
          cell={cell}
          isToday={days[index].isToday}
          onComplete={() => onComplete(task.id)}
          onUndo={() => onUndo(task.id)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}
