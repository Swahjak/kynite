"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { DayHeader } from "./day-header";
import { TaskRow } from "./task-row";
import { AddTaskRow } from "./add-task-row";
import { GridFooter } from "./grid-footer";
import { useRewardChart } from "../contexts/reward-chart-context";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { TaskDialog } from "../dialogs/task-dialog";
import type { TaskFormValues } from "../dialogs/task-dialog";
import type { IRewardChartTask } from "../interfaces";
import { toast } from "sonner";

interface WeeklyGridProps {
  className?: string;
}

export function WeeklyGrid({ className }: WeeklyGridProps) {
  const { weekData, completeTask, undoCompletion, isLoading, createTask, updateTask, deleteTask, reorderTasks } =
    useRewardChart();
  const { mode } = useInteractionMode();
  const isManageMode = mode === "manage";

  // Task dialog state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<IRewardChartTask | undefined>();

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

  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      await deleteTask(taskId);
      toast.success("Task deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete task");
    }
  }, [deleteTask]);

  const handleTaskSubmit = useCallback(async (values: TaskFormValues) => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, values);
        toast.success("Task updated");
      } else {
        await createTask(values);
        toast.success("Task created");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save task");
      throw error;
    }
  }, [editingTask, createTask, updateTask]);

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

  const handleDrop = useCallback(async (e: React.DragEvent, targetTaskId: string) => {
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
      await reorderTasks(newOrder.map((t) => t.task.id));
    } catch (error) {
      toast.error("Failed to reorder tasks");
    }

    setDraggedTaskId(null);
  }, [draggedTaskId, weekData, reorderTasks]);

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
    <div
      className={cn(
        "overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-slate-800",
        className
      )}
    >
      {/* Header Row */}
      <div className="grid grid-cols-[1.8fr_repeat(7,1fr)] border-b bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50">
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
      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
        {tasks.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500">
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
              showControls={isManageMode}
              onEdit={handleEditTask}
              onDelete={handleDeleteTask}
              draggable={isManageMode}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            />
          ))
        )}

        {/* Add Task Row - only in manage mode */}
        {isManageMode && (
          <div className="p-4">
            <AddTaskRow onClick={handleAddTask} />
          </div>
        )}
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
  );
}
