"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DayHeader } from "./day-header";
import { TaskRow } from "./task-row";
import { AddTaskRow } from "./add-task-row";
import { GridFooter } from "./grid-footer";
import { useRewardChart } from "../contexts/reward-chart-context";
import { TaskDialog } from "../dialogs/task-dialog";
import type { TaskFormValues } from "../dialogs/task-dialog";
import type { IRewardChartTask } from "../interfaces";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface WeeklyGridProps {
  className?: string;
}

export function WeeklyGrid({ className }: WeeklyGridProps) {
  const t = useTranslations("rewardChart");
  const {
    weekData,
    completeTask,
    undoCompletion,
    isLoading,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    isManager,
  } = useRewardChart();

  // Local edit mode state (only managers can toggle)
  const [isEditMode, setIsEditMode] = useState(false);

  // Task dialog state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<
    IRewardChartTask | undefined
  >();

  // Drag state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const handleAddTask = useCallback(() => {
    setEditingTask(undefined);
    setTaskDialogOpen(true);
  }, []);

  const handleEditTask = useCallback((task: IRewardChartTask) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  }, []);

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      try {
        await deleteTask(taskId);
        toast.success(t("taskDeleted"));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("taskDeleteError")
        );
      }
    },
    [deleteTask, t]
  );

  const handleTaskSubmit = useCallback(
    async (values: TaskFormValues) => {
      try {
        if (editingTask) {
          await updateTask(editingTask.id, values);
          toast.success(t("taskUpdated"));
        } else {
          await createTask(values);
          toast.success(t("taskCreated"));
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("taskSaveError")
        );
        throw error;
      }
    },
    [editingTask, createTask, updateTask, t]
  );

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetTaskId: string) => {
      e.preventDefault();
      if (!draggedTaskId || draggedTaskId === targetTaskId || !weekData) return;

      const tasks = weekData.tasks;
      const draggedIndex = tasks.findIndex((t) => t.task.id === draggedTaskId);
      const targetIndex = tasks.findIndex((t) => t.task.id === targetTaskId);

      if (draggedIndex === -1 || targetIndex === -1) return;

      // Reorder locally first for immediate feedback
      const newOrder = [...tasks];
      const [removed] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, removed);

      try {
        await reorderTasks(newOrder.map((tr) => tr.task.id));
      } catch (error) {
        toast.error(t("taskReorderError"));
      }

      setDraggedTaskId(null);
    },
    [draggedTaskId, weekData, reorderTasks, t]
  );

  if (!weekData) {
    return (
      <div
        className={cn(
          "rounded-3xl bg-white p-8 shadow-sm dark:bg-slate-800",
          className
        )}
      >
        <p className="text-center text-slate-500">No chart data available</p>
      </div>
    );
  }

  const { days, tasks, todayStats } = weekData;

  return (
    <div className="relative">
      <div
        className={cn(
          "grid grid-cols-[minmax(180px,1.5fr)_repeat(7,1fr)] overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-slate-800",
          className
        )}
      >
        {/* Header Row */}
        <div className="col-span-full grid grid-cols-subgrid border-b bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50">
          {/* Task/Routine label */}
          <div className="flex items-center px-4 py-3">
            <span className="text-xs font-medium tracking-wider text-slate-400 uppercase">
              Task / Routine
            </span>
          </div>

          {/* Day headers */}
          {days.map((day) => (
            <DayHeader key={day.date} day={day} />
          ))}
        </div>

        {/* Task Rows */}
        <div className="col-span-full grid grid-cols-subgrid divide-y divide-slate-100 dark:divide-slate-700/50">
          {tasks.length === 0 ? (
            <div className="col-span-full px-6 py-8 text-center text-slate-500">
              No tasks configured yet
            </div>
          ) : (
            tasks.map((taskRow) => (
              <TaskRow
                key={taskRow.task.id}
                taskRow={taskRow}
                days={days}
                onComplete={completeTask}
                onUndo={undoCompletion}
                disabled={isLoading}
                showControls={isEditMode}
                onEdit={handleEditTask}
                onDelete={handleDeleteTask}
                draggable={isEditMode}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            ))
          )}

          {/* Add Task Row - only in edit mode */}
          {isEditMode && <AddTaskRow onClick={handleAddTask} />}
        </div>

        {/* Footer */}
        <GridFooter todayStats={todayStats} />

        {/* Task Dialog */}
        <TaskDialog
          open={taskDialogOpen}
          onOpenChange={setTaskDialogOpen}
          task={editingTask}
          onSubmit={handleTaskSubmit}
        />
      </div>

      {/* Edit Mode FAB - fixed to viewport bottom-right, only visible to managers */}
      {isManager && (
        <Button
          onClick={() => setIsEditMode(!isEditMode)}
          size="icon"
          className={cn(
            "fixed right-6 bottom-6 z-50 h-14 w-14 rounded-full shadow-lg transition-colors",
            isEditMode
              ? "bg-green-600 hover:bg-green-700"
              : "bg-indigo-600 hover:bg-indigo-700"
          )}
          aria-label={isEditMode ? t("doneEditing") : t("editChart")}
        >
          {isEditMode ? (
            <Check className="h-6 w-6 text-white" />
          ) : (
            <Pencil className="h-6 w-6 text-white" />
          )}
        </Button>
      )}
    </div>
  );
}
