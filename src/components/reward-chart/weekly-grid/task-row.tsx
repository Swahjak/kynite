"use client";

import { cn } from "@/lib/utils";
import { Pencil, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskCell } from "./task-cell";
import { ICON_COLORS, type IconColorKey } from "../constants";
import type {
  TaskRow as TaskRowType,
  WeekDay,
  IRewardChartTask,
} from "../interfaces";

interface TaskRowProps {
  taskRow: TaskRowType;
  days: WeekDay[];
  onComplete: (taskId: string) => void;
  onUndo: (taskId: string) => void;
  disabled?: boolean;
  showControls?: boolean;
  onEdit?: (task: IRewardChartTask) => void;
  onDelete?: (taskId: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, taskId: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, taskId: string) => void;
}

export function TaskRow({
  taskRow,
  days,
  onComplete,
  onUndo,
  disabled,
  showControls,
  onEdit,
  onDelete,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
}: TaskRowProps) {
  const { task, cells } = taskRow;
  const colors =
    ICON_COLORS[task.iconColor as IconColorKey] ?? ICON_COLORS.blue;

  return (
    <div
      className="group col-span-full grid grid-cols-subgrid divide-x divide-slate-100 transition-colors hover:bg-slate-50/50 dark:divide-slate-700/50 dark:hover:bg-slate-800/50"
      draggable={draggable && showControls}
      onDragStart={(e) => onDragStart?.(e, task.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop?.(e, task.id)}
    >
      {/* Task Info */}
      <div className="relative flex min-w-0 items-center gap-3 px-4 py-2">
        {/* Drag Handle - only visible in manage mode */}
        {showControls && (
          <GripVertical className="h-4 w-4 cursor-grab text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
        )}

        {/* Icon */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
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
        <span className="flex-1 truncate text-sm font-semibold text-slate-700 md:text-base dark:text-slate-200">
          {task.title}
        </span>

        {/* Edit/Delete Controls - only visible in manage mode, positioned absolutely to float over content */}
        {showControls && (
          <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1 rounded-lg bg-white/90 opacity-0 shadow-sm backdrop-blur-sm transition-opacity group-hover:opacity-100 dark:bg-slate-800/90">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit?.(task)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive h-8 w-8"
              onClick={() => onDelete?.(task.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
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
