import { db } from "@/server/db";
import {
  rewardCharts,
  rewardChartTasks,
  rewardChartCompletions,
  rewardChartGoals,
  rewardChartMessages,
  familyMembers,
} from "@/server/schema";
import { eq, and, gte, lte, desc, asc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type {
  CreateRewardChartTaskInput,
  UpdateRewardChartTaskInput,
  CreateRewardChartGoalInput,
  UpdateRewardChartGoalInput,
  CreateRewardChartMessageInput,
} from "@/lib/validations/reward-chart";

// =============================================================================
// CHART OPERATIONS
// =============================================================================

/**
 * Get reward chart for a family member
 */
export async function getChartByMemberId(memberId: string) {
  const charts = await db
    .select()
    .from(rewardCharts)
    .where(
      and(eq(rewardCharts.memberId, memberId), eq(rewardCharts.isActive, true))
    )
    .limit(1);

  return charts[0] ?? null;
}

/**
 * Get reward chart by ID with all related data
 */
export async function getChartWithDetails(chartId: string) {
  const charts = await db
    .select()
    .from(rewardCharts)
    .where(eq(rewardCharts.id, chartId))
    .limit(1);

  if (charts.length === 0) return null;

  const chart = charts[0];

  const [tasks, goals, messages, member] = await Promise.all([
    db
      .select()
      .from(rewardChartTasks)
      .where(
        and(
          eq(rewardChartTasks.chartId, chartId),
          eq(rewardChartTasks.isActive, true)
        )
      )
      .orderBy(asc(rewardChartTasks.sortOrder)),
    db
      .select()
      .from(rewardChartGoals)
      .where(eq(rewardChartGoals.chartId, chartId))
      .orderBy(desc(rewardChartGoals.createdAt)),
    db
      .select()
      .from(rewardChartMessages)
      .where(
        and(
          eq(rewardChartMessages.chartId, chartId),
          eq(rewardChartMessages.isActive, true)
        )
      )
      .orderBy(desc(rewardChartMessages.createdAt))
      .limit(1),
    db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.id, chart.memberId))
      .limit(1),
  ]);

  const activeGoal = goals.find((g) => g.status === "active") ?? null;

  return {
    ...chart,
    member: member[0] ?? null,
    tasks,
    activeGoal,
    currentMessage: messages[0] ?? null,
  };
}

/**
 * Get all charts for a family
 */
export async function getChartsForFamily(familyId: string) {
  return await db
    .select({
      chart: rewardCharts,
      member: familyMembers,
    })
    .from(rewardCharts)
    .innerJoin(familyMembers, eq(rewardCharts.memberId, familyMembers.id))
    .where(
      and(eq(rewardCharts.familyId, familyId), eq(rewardCharts.isActive, true))
    );
}

/**
 * Create a reward chart for a family member
 */
export async function createChart(familyId: string, memberId: string) {
  // Check if chart already exists
  const existing = await getChartByMemberId(memberId);
  if (existing) {
    throw new Error("Chart already exists for this member");
  }

  const [chart] = await db
    .insert(rewardCharts)
    .values({
      id: createId(),
      familyId,
      memberId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return chart;
}

// =============================================================================
// TASK OPERATIONS
// =============================================================================

/**
 * Create a task for a chart
 */
export async function createTask(
  chartId: string,
  input: CreateRewardChartTaskInput
) {
  const [task] = await db
    .insert(rewardChartTasks)
    .values({
      id: createId(),
      chartId,
      title: input.title,
      icon: input.icon,
      iconColor: input.iconColor,
      starValue: input.starValue,
      daysOfWeek: JSON.stringify(input.daysOfWeek),
      sortOrder: input.sortOrder,
      isActive: true,
      createdAt: new Date(),
    })
    .returning();

  return task;
}

/**
 * Update a task
 */
export async function updateTask(
  taskId: string,
  input: UpdateRewardChartTaskInput
) {
  const updates: Record<string, unknown> = {};

  if (input.title !== undefined) updates.title = input.title;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.iconColor !== undefined) updates.iconColor = input.iconColor;
  if (input.starValue !== undefined) updates.starValue = input.starValue;
  if (input.daysOfWeek !== undefined)
    updates.daysOfWeek = JSON.stringify(input.daysOfWeek);
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  const [task] = await db
    .update(rewardChartTasks)
    .set(updates)
    .where(eq(rewardChartTasks.id, taskId))
    .returning();

  return task;
}

/**
 * Delete a task (soft delete by setting isActive = false)
 */
export async function deleteTask(taskId: string) {
  await db
    .update(rewardChartTasks)
    .set({ isActive: false })
    .where(eq(rewardChartTasks.id, taskId));
}

/**
 * Reorder tasks by updating sortOrder for all tasks in the chart
 */
export async function reorderTasks(
  chartId: string,
  taskIds: string[]
): Promise<void> {
  await db.transaction(async (tx) => {
    for (let i = 0; i < taskIds.length; i++) {
      await tx
        .update(rewardChartTasks)
        .set({ sortOrder: i })
        .where(
          and(
            eq(rewardChartTasks.id, taskIds[i]),
            eq(rewardChartTasks.chartId, chartId)
          )
        );
    }
  });
}

// =============================================================================
// COMPLETION OPERATIONS
// =============================================================================

/**
 * Get completions for a chart within a date range
 */
export async function getCompletionsForDateRange(
  chartId: string,
  startDate: string,
  endDate: string
) {
  const tasks = await db
    .select()
    .from(rewardChartTasks)
    .where(eq(rewardChartTasks.chartId, chartId));

  const taskIds = tasks.map((t) => t.id);

  if (taskIds.length === 0) return [];

  const completions = await db
    .select()
    .from(rewardChartCompletions)
    .where(
      and(
        gte(rewardChartCompletions.date, startDate),
        lte(rewardChartCompletions.date, endDate)
      )
    );

  // Filter to only completions for this chart's tasks
  return completions.filter((c) => taskIds.includes(c.taskId));
}

/**
 * Complete a task for a specific date
 */
export async function completeTask(taskId: string, date: string) {
  // Check if already completed
  const existing = await db
    .select()
    .from(rewardChartCompletions)
    .where(
      and(
        eq(rewardChartCompletions.taskId, taskId),
        eq(rewardChartCompletions.date, date)
      )
    )
    .limit(1);

  if (existing.length > 0 && existing[0].status === "completed") {
    return existing[0];
  }

  // Get task to know star value
  const tasks = await db
    .select()
    .from(rewardChartTasks)
    .where(eq(rewardChartTasks.id, taskId))
    .limit(1);

  if (tasks.length === 0) {
    throw new Error("Task not found");
  }

  const task = tasks[0];

  // Get chart and active goal
  const charts = await db
    .select()
    .from(rewardCharts)
    .where(eq(rewardCharts.id, task.chartId))
    .limit(1);

  if (charts.length === 0) {
    throw new Error("Chart not found");
  }

  const chart = charts[0];

  return await db.transaction(async (tx) => {
    // Upsert completion
    let completion;
    if (existing.length > 0) {
      [completion] = await tx
        .update(rewardChartCompletions)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(rewardChartCompletions.id, existing[0].id))
        .returning();
    } else {
      [completion] = await tx
        .insert(rewardChartCompletions)
        .values({
          id: createId(),
          taskId,
          date,
          status: "completed",
          completedAt: new Date(),
          createdAt: new Date(),
        })
        .returning();
    }

    // Update active goal progress
    const goals = await tx
      .select()
      .from(rewardChartGoals)
      .where(
        and(
          eq(rewardChartGoals.chartId, chart.id),
          eq(rewardChartGoals.status, "active")
        )
      )
      .limit(1);

    let goalProgress = null;
    if (goals.length > 0) {
      const goal = goals[0];
      const newStars = goal.starsCurrent + task.starValue;
      const achieved = newStars >= goal.starTarget;

      const [updatedGoal] = await tx
        .update(rewardChartGoals)
        .set({
          starsCurrent: newStars,
          status: achieved ? "achieved" : "active",
          achievedAt: achieved ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(rewardChartGoals.id, goal.id))
        .returning();

      goalProgress = {
        starsCurrent: updatedGoal.starsCurrent,
        starTarget: updatedGoal.starTarget,
        progressPercent: Math.round(
          (updatedGoal.starsCurrent / updatedGoal.starTarget) * 100
        ),
        achieved,
      };
    }

    return { completion, goalProgress, starsEarned: task.starValue };
  });
}

/**
 * Undo a task completion for a specific date
 */
export async function undoCompletion(taskId: string, date: string) {
  const existing = await db
    .select()
    .from(rewardChartCompletions)
    .where(
      and(
        eq(rewardChartCompletions.taskId, taskId),
        eq(rewardChartCompletions.date, date),
        eq(rewardChartCompletions.status, "completed")
      )
    )
    .limit(1);

  if (existing.length === 0) {
    return null;
  }

  // Get task to know star value
  const tasks = await db
    .select()
    .from(rewardChartTasks)
    .where(eq(rewardChartTasks.id, taskId))
    .limit(1);

  if (tasks.length === 0) {
    throw new Error("Task not found");
  }

  const task = tasks[0];

  return await db.transaction(async (tx) => {
    // Delete completion
    await tx
      .delete(rewardChartCompletions)
      .where(eq(rewardChartCompletions.id, existing[0].id));

    // Update active goal progress
    const charts = await tx
      .select()
      .from(rewardCharts)
      .where(eq(rewardCharts.id, task.chartId))
      .limit(1);

    let goalProgress = null;
    if (charts.length > 0) {
      const goals = await tx
        .select()
        .from(rewardChartGoals)
        .where(
          and(
            eq(rewardChartGoals.chartId, charts[0].id),
            eq(rewardChartGoals.status, "active")
          )
        )
        .limit(1);

      if (goals.length > 0) {
        const goal = goals[0];
        const newStars = Math.max(0, goal.starsCurrent - task.starValue);

        const [updatedGoal] = await tx
          .update(rewardChartGoals)
          .set({
            starsCurrent: newStars,
            updatedAt: new Date(),
          })
          .where(eq(rewardChartGoals.id, goal.id))
          .returning();

        goalProgress = {
          starsCurrent: updatedGoal.starsCurrent,
          starTarget: updatedGoal.starTarget,
          progressPercent: Math.round(
            (updatedGoal.starsCurrent / updatedGoal.starTarget) * 100
          ),
        };
      }
    }

    return { goalProgress, starsRemoved: task.starValue };
  });
}

// =============================================================================
// GOAL OPERATIONS
// =============================================================================

/**
 * Create a goal for a chart
 */
export async function createGoal(
  chartId: string,
  input: CreateRewardChartGoalInput
) {
  const [goal] = await db
    .insert(rewardChartGoals)
    .values({
      id: createId(),
      chartId,
      title: input.title,
      description: input.description ?? null,
      emoji: input.emoji,
      starTarget: input.starTarget,
      starsCurrent: 0,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return goal;
}

/**
 * Update a goal
 */
export async function updateGoal(
  goalId: string,
  input: UpdateRewardChartGoalInput
) {
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.emoji !== undefined) updates.emoji = input.emoji;
  if (input.starTarget !== undefined) updates.starTarget = input.starTarget;
  if (input.status !== undefined) {
    updates.status = input.status;
    if (input.status === "achieved") {
      updates.achievedAt = new Date();
    }
  }

  const [goal] = await db
    .update(rewardChartGoals)
    .set(updates)
    .where(eq(rewardChartGoals.id, goalId))
    .returning();

  return goal;
}

// =============================================================================
// MESSAGE OPERATIONS
// =============================================================================

/**
 * Create a message for a chart
 */
export async function createMessage(
  chartId: string,
  authorId: string,
  input: CreateRewardChartMessageInput
) {
  // Deactivate previous messages
  await db
    .update(rewardChartMessages)
    .set({ isActive: false })
    .where(eq(rewardChartMessages.chartId, chartId));

  const [message] = await db
    .insert(rewardChartMessages)
    .values({
      id: createId(),
      chartId,
      content: input.content,
      authorId,
      isActive: true,
      createdAt: new Date(),
    })
    .returning();

  return message;
}

/**
 * Get active message for a chart
 */
export async function getActiveMessage(chartId: string) {
  const messages = await db
    .select()
    .from(rewardChartMessages)
    .where(
      and(
        eq(rewardChartMessages.chartId, chartId),
        eq(rewardChartMessages.isActive, true)
      )
    )
    .limit(1);

  return messages[0] ?? null;
}
