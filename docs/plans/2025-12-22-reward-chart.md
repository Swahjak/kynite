# Reward Chart Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a gamification feature where children track daily routines, earn stars, and work toward goals on personalized reward charts.

**Architecture:** Per-child reward charts with recurring tasks, daily completions, and goal progress tracking. Parents configure tasks/goals; children self-report completions. Weekly grid view with today-only interaction. Stars integrate with existing family member system.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + PostgreSQL, Zod validation, React Context, shadcn/ui components, Tailwind CSS 4

---

## Phase 1: Database Schema

### Task 1.1: Add Reward Chart Tables to Schema

**Files:**

- Modify: `src/server/schema.ts`

**Step 1: Add the reward chart tables**

Add after the existing `familyMembers` table and relations:

```typescript
// =============================================================================
// REWARD CHARTS
// =============================================================================

export const rewardCharts = pgTable("reward_charts", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const rewardChartsRelations = relations(
  rewardCharts,
  ({ one, many }) => ({
    family: one(families, {
      fields: [rewardCharts.familyId],
      references: [families.id],
    }),
    member: one(familyMembers, {
      fields: [rewardCharts.memberId],
      references: [familyMembers.id],
    }),
    tasks: many(rewardChartTasks),
    goals: many(rewardChartGoals),
    messages: many(rewardChartMessages),
  })
);

export type RewardChart = typeof rewardCharts.$inferSelect;
export type NewRewardChart = typeof rewardCharts.$inferInsert;

// -----------------------------------------------------------------------------

export const rewardChartTasks = pgTable("reward_chart_tasks", {
  id: text("id").primaryKey(),
  chartId: text("chart_id")
    .notNull()
    .references(() => rewardCharts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  icon: text("icon").notNull(),
  iconColor: text("icon_color").notNull(),
  starValue: integer("star_value").notNull().default(1),
  daysOfWeek: text("days_of_week").notNull(), // JSON array: [0,1,2,3,4,5,6]
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const rewardChartTasksRelations = relations(
  rewardChartTasks,
  ({ one, many }) => ({
    chart: one(rewardCharts, {
      fields: [rewardChartTasks.chartId],
      references: [rewardCharts.id],
    }),
    completions: many(rewardChartCompletions),
  })
);

export type RewardChartTask = typeof rewardChartTasks.$inferSelect;
export type NewRewardChartTask = typeof rewardChartTasks.$inferInsert;

// -----------------------------------------------------------------------------

export const rewardChartCompletions = pgTable("reward_chart_completions", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => rewardChartTasks.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(),
  status: text("status").notNull(), // 'completed' | 'missed' | 'skipped'
  completedAt: timestamp("completed_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const rewardChartCompletionsRelations = relations(
  rewardChartCompletions,
  ({ one }) => ({
    task: one(rewardChartTasks, {
      fields: [rewardChartCompletions.taskId],
      references: [rewardChartTasks.id],
    }),
  })
);

export type RewardChartCompletion = typeof rewardChartCompletions.$inferSelect;
export type NewRewardChartCompletion =
  typeof rewardChartCompletions.$inferInsert;

// -----------------------------------------------------------------------------

export const rewardChartGoals = pgTable("reward_chart_goals", {
  id: text("id").primaryKey(),
  chartId: text("chart_id")
    .notNull()
    .references(() => rewardCharts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  emoji: text("emoji").notNull(),
  starTarget: integer("star_target").notNull(),
  starsCurrent: integer("stars_current").notNull().default(0),
  status: text("status").notNull().default("active"), // 'active' | 'achieved' | 'cancelled'
  achievedAt: timestamp("achieved_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const rewardChartGoalsRelations = relations(
  rewardChartGoals,
  ({ one }) => ({
    chart: one(rewardCharts, {
      fields: [rewardChartGoals.chartId],
      references: [rewardCharts.id],
    }),
  })
);

export type RewardChartGoal = typeof rewardChartGoals.$inferSelect;
export type NewRewardChartGoal = typeof rewardChartGoals.$inferInsert;

// -----------------------------------------------------------------------------

export const rewardChartMessages = pgTable("reward_chart_messages", {
  id: text("id").primaryKey(),
  chartId: text("chart_id")
    .notNull()
    .references(() => rewardCharts.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  authorId: text("author_id")
    .notNull()
    .references(() => familyMembers.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export const rewardChartMessagesRelations = relations(
  rewardChartMessages,
  ({ one }) => ({
    chart: one(rewardCharts, {
      fields: [rewardChartMessages.chartId],
      references: [rewardCharts.id],
    }),
    author: one(familyMembers, {
      fields: [rewardChartMessages.authorId],
      references: [familyMembers.id],
    }),
  })
);

export type RewardChartMessage = typeof rewardChartMessages.$inferSelect;
export type NewRewardChartMessage = typeof rewardChartMessages.$inferInsert;
```

**Step 2: Add required imports to schema.ts**

Ensure these imports exist at the top:

```typescript
import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  date,
} from "drizzle-orm/pg-core";
```

**Step 3: Generate migration**

Run: `pnpm db:generate`
Expected: New migration file created in `drizzle/` directory

**Step 4: Apply migration**

Run: `pnpm db:migrate`
Expected: Migration applied successfully

**Step 5: Verify with Drizzle Studio**

Run: `pnpm db:studio`
Expected: New tables visible in Drizzle Studio UI

**Step 6: Commit**

```bash
git add src/server/schema.ts drizzle/
git commit -m "feat(reward-chart): add database schema for reward charts"
```

---

## Phase 2: Validation Schemas

### Task 2.1: Create Zod Validation Schemas

**Files:**

- Create: `src/lib/validations/reward-chart.ts`

**Step 1: Create the validation file**

```typescript
import { z } from "zod";

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export const completionStatusSchema = z.enum([
  "completed",
  "missed",
  "skipped",
]);
export type CompletionStatus = z.infer<typeof completionStatusSchema>;

export const goalStatusSchema = z.enum(["active", "achieved", "cancelled"]);
export type GoalStatus = z.infer<typeof goalStatusSchema>;

export const dayOfWeekSchema = z.number().int().min(0).max(6);
export type DayOfWeek = z.infer<typeof dayOfWeekSchema>;

export const iconColorSchema = z.enum([
  "blue",
  "emerald",
  "purple",
  "orange",
  "pink",
  "amber",
  "teal",
  "rose",
]);
export type IconColor = z.infer<typeof iconColorSchema>;

// =============================================================================
// REWARD CHART
// =============================================================================

export const createRewardChartSchema = z.object({
  memberId: z.string().min(1, "Member ID is required"),
});

export type CreateRewardChartInput = z.infer<typeof createRewardChartSchema>;

// =============================================================================
// TASKS
// =============================================================================

export const createRewardChartTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  icon: z.string().min(1, "Icon is required"),
  iconColor: iconColorSchema,
  starValue: z.number().int().min(1).max(10).default(1),
  daysOfWeek: z.array(dayOfWeekSchema).min(1, "At least one day required"),
  sortOrder: z.number().int().default(0),
});

export type CreateRewardChartTaskInput = z.infer<
  typeof createRewardChartTaskSchema
>;

export const updateRewardChartTaskSchema = createRewardChartTaskSchema
  .partial()
  .extend({
    isActive: z.boolean().optional(),
  });

export type UpdateRewardChartTaskInput = z.infer<
  typeof updateRewardChartTaskSchema
>;

// =============================================================================
// COMPLETIONS
// =============================================================================

export const createCompletionSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
});

export type CreateCompletionInput = z.infer<typeof createCompletionSchema>;

// =============================================================================
// GOALS
// =============================================================================

export const createRewardChartGoalSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  description: z.string().max(500).nullable().optional(),
  emoji: z.string().min(1, "Emoji is required"),
  starTarget: z.number().int().min(1, "Target must be at least 1").max(1000),
});

export type CreateRewardChartGoalInput = z.infer<
  typeof createRewardChartGoalSchema
>;

export const updateRewardChartGoalSchema = createRewardChartGoalSchema
  .partial()
  .extend({
    status: goalStatusSchema.optional(),
  });

export type UpdateRewardChartGoalInput = z.infer<
  typeof updateRewardChartGoalSchema
>;

// =============================================================================
// MESSAGES
// =============================================================================

export const createRewardChartMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Message is required")
    .max(500, "Message too long"),
});

export type CreateRewardChartMessageInput = z.infer<
  typeof createRewardChartMessageSchema
>;
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm build`
Expected: Build succeeds with no type errors

**Step 3: Commit**

```bash
git add src/lib/validations/reward-chart.ts
git commit -m "feat(reward-chart): add Zod validation schemas"
```

---

## Phase 3: Service Layer

### Task 3.1: Create Reward Chart Service

**Files:**

- Create: `src/server/services/reward-chart-service.ts`

**Step 1: Create the service file with chart operations**

```typescript
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
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm build`
Expected: Build succeeds with no type errors

**Step 3: Commit**

```bash
git add src/server/services/reward-chart-service.ts
git commit -m "feat(reward-chart): add service layer for reward charts"
```

---

## Phase 4: API Routes

### Task 4.1: Create Chart API Routes

**Files:**

- Create: `src/app/api/v1/families/[familyId]/reward-charts/route.ts`

**Step 1: Create the route file**

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import {
  isUserFamilyMember,
  isUserFamilyManager,
} from "@/server/services/family-service";
import {
  getChartsForFamily,
  createChart,
} from "@/server/services/reward-chart-service";
import { createRewardChartSchema } from "@/lib/validations/reward-chart";

type Params = { params: Promise<{ familyId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a member of this family" },
        },
        { status: 403 }
      );
    }

    const charts = await getChartsForFamily(familyId);

    return NextResponse.json({
      success: true,
      data: { charts },
    });
  } catch (error) {
    console.error("Error getting reward charts:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get reward charts",
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can create reward charts",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createRewardChartSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0].message,
          },
        },
        { status: 400 }
      );
    }

    const chart = await createChart(familyId, parsed.data.memberId);

    return NextResponse.json(
      { success: true, data: { chart } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating reward chart:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create reward chart";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/reward-charts/route.ts
git commit -m "feat(reward-chart): add GET/POST API routes for charts"
```

### Task 4.2: Create Chart Detail Routes

**Files:**

- Create: `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/route.ts`

**Step 1: Create the route file**

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { isUserFamilyMember } from "@/server/services/family-service";
import { getChartWithDetails } from "@/server/services/reward-chart-service";

type Params = { params: Promise<{ familyId: string; chartId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, chartId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a member of this family" },
        },
        { status: 403 }
      );
    }

    const chart = await getChartWithDetails(chartId);

    if (!chart) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Chart not found" },
        },
        { status: 404 }
      );
    }

    if (chart.familyId !== familyId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Chart does not belong to this family",
          },
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { chart },
    });
  } catch (error) {
    console.error("Error getting reward chart:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get reward chart",
        },
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/reward-charts/\[chartId\]/route.ts
git commit -m "feat(reward-chart): add GET API route for chart details"
```

### Task 4.3: Create Week Data Route

**Files:**

- Create: `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/week/route.ts`

**Step 1: Create the route file**

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { isUserFamilyMember } from "@/server/services/family-service";
import {
  getChartWithDetails,
  getCompletionsForDateRange,
} from "@/server/services/reward-chart-service";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isToday,
  isWeekend,
  isBefore,
  startOfDay,
} from "date-fns";

type Params = { params: Promise<{ familyId: string; chartId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, chartId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a member of this family" },
        },
        { status: 403 }
      );
    }

    const chart = await getChartWithDetails(chartId);

    if (!chart) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Chart not found" },
        },
        { status: 404 }
      );
    }

    if (chart.familyId !== familyId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Chart does not belong to this family",
          },
        },
        { status: 403 }
      );
    }

    // Calculate week boundaries (Monday-Sunday)
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const startDateStr = format(weekStart, "yyyy-MM-dd");
    const endDateStr = format(weekEnd, "yyyy-MM-dd");

    // Get completions for the week
    const completions = await getCompletionsForDateRange(
      chartId,
      startDateStr,
      endDateStr
    );

    // Build days array
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd }).map(
      (date) => ({
        date: format(date, "yyyy-MM-dd"),
        dayOfWeek: date.getDay(),
        dayName: format(date, "EEE"),
        dayNumber: date.getDate(),
        isToday: isToday(date),
        isWeekend: isWeekend(date),
      })
    );

    // Build task rows with cells
    const todayStr = format(now, "yyyy-MM-dd");
    const today = startOfDay(now);

    const tasks = chart.tasks.map((task) => {
      const taskDays: number[] = JSON.parse(task.daysOfWeek);

      const cells = days.map((day) => {
        const dayDate = new Date(day.date);
        const isApplicable = taskDays.includes(day.dayOfWeek);
        const completion = completions.find(
          (c) => c.taskId === task.id && c.date === day.date
        );

        let status: string;
        if (!isApplicable) {
          status = "not_applicable";
        } else if (completion?.status === "completed") {
          status = "completed";
        } else if (day.date === todayStr) {
          status = "pending";
        } else if (isBefore(dayDate, today)) {
          status = "missed";
        } else {
          status = "future";
        }

        return {
          date: day.date,
          status,
          completion: completion ?? null,
          isApplicable,
        };
      });

      return { task, cells };
    });

    // Calculate today's stats
    const todayTasks = chart.tasks.filter((task) => {
      const taskDays: number[] = JSON.parse(task.daysOfWeek);
      return taskDays.includes(now.getDay());
    });

    const todayCompletions = completions.filter(
      (c) => c.date === todayStr && c.status === "completed"
    );

    const todayStats = {
      completed: todayCompletions.length,
      total: todayTasks.length,
    };

    return NextResponse.json({
      success: true,
      data: {
        chart,
        weekStart: startDateStr,
        weekEnd: endDateStr,
        days,
        tasks,
        todayStats,
      },
    });
  } catch (error) {
    console.error("Error getting weekly chart data:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get weekly chart data",
        },
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/reward-charts/\[chartId\]/week/route.ts
git commit -m "feat(reward-chart): add GET API route for weekly chart data"
```

### Task 4.4: Create Task Routes

**Files:**

- Create: `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/tasks/route.ts`

**Step 1: Create the route file**

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { isUserFamilyManager } from "@/server/services/family-service";
import {
  createTask,
  getChartWithDetails,
} from "@/server/services/reward-chart-service";
import { createRewardChartTaskSchema } from "@/lib/validations/reward-chart";

type Params = { params: Promise<{ familyId: string; chartId: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, chartId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Only managers can add tasks" },
        },
        { status: 403 }
      );
    }

    const chart = await getChartWithDetails(chartId);
    if (!chart || chart.familyId !== familyId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Chart not found" },
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createRewardChartTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0].message,
          },
        },
        { status: 400 }
      );
    }

    const task = await createTask(chartId, parsed.data);

    return NextResponse.json(
      { success: true, data: { task } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create task" },
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/reward-charts/\[chartId\]/tasks/route.ts
git commit -m "feat(reward-chart): add POST API route for tasks"
```

### Task 4.5: Create Task Complete/Undo Routes

**Files:**

- Create: `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/tasks/[taskId]/complete/route.ts`
- Create: `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/tasks/[taskId]/undo/route.ts`

**Step 1: Create the complete route**

```typescript
// src/app/api/v1/families/[familyId]/reward-charts/[chartId]/tasks/[taskId]/complete/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { isUserFamilyMember } from "@/server/services/family-service";
import {
  completeTask,
  getChartWithDetails,
} from "@/server/services/reward-chart-service";
import { format } from "date-fns";

type Params = {
  params: Promise<{ familyId: string; chartId: string; taskId: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, chartId, taskId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a member of this family" },
        },
        { status: 403 }
      );
    }

    const chart = await getChartWithDetails(chartId);
    if (!chart || chart.familyId !== familyId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Chart not found" },
        },
        { status: 404 }
      );
    }

    // Verify task belongs to chart
    const task = chart.tasks.find((t) => t.id === taskId);
    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        },
        { status: 404 }
      );
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const result = await completeTask(taskId, today);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error completing task:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to complete task" },
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Create the undo route**

```typescript
// src/app/api/v1/families/[familyId]/reward-charts/[chartId]/tasks/[taskId]/undo/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { isUserFamilyMember } from "@/server/services/family-service";
import {
  undoCompletion,
  getChartWithDetails,
} from "@/server/services/reward-chart-service";
import { format } from "date-fns";

type Params = {
  params: Promise<{ familyId: string; chartId: string; taskId: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, chartId, taskId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a member of this family" },
        },
        { status: 403 }
      );
    }

    const chart = await getChartWithDetails(chartId);
    if (!chart || chart.familyId !== familyId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Chart not found" },
        },
        { status: 404 }
      );
    }

    const task = chart.tasks.find((t) => t.id === taskId);
    if (!task) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Task not found" },
        },
        { status: 404 }
      );
    }

    const today = format(new Date(), "yyyy-MM-dd");
    const result = await undoCompletion(taskId, today);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error undoing completion:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to undo completion" },
      },
      { status: 500 }
    );
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/reward-charts/\[chartId\]/tasks/\[taskId\]/
git commit -m "feat(reward-chart): add complete/undo API routes for tasks"
```

### Task 4.6: Create Goal Routes

**Files:**

- Create: `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/goals/route.ts`

**Step 1: Create the route file**

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import {
  isUserFamilyManager,
  isUserFamilyMember,
} from "@/server/services/family-service";
import {
  createGoal,
  getChartWithDetails,
} from "@/server/services/reward-chart-service";
import { createRewardChartGoalSchema } from "@/lib/validations/reward-chart";
import { db } from "@/server/db";
import { rewardChartGoals } from "@/server/schema";
import { eq, desc } from "drizzle-orm";

type Params = { params: Promise<{ familyId: string; chartId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, chartId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a member of this family" },
        },
        { status: 403 }
      );
    }

    const chart = await getChartWithDetails(chartId);
    if (!chart || chart.familyId !== familyId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Chart not found" },
        },
        { status: 404 }
      );
    }

    const goals = await db
      .select()
      .from(rewardChartGoals)
      .where(eq(rewardChartGoals.chartId, chartId))
      .orderBy(desc(rewardChartGoals.createdAt));

    return NextResponse.json({
      success: true,
      data: { goals },
    });
  } catch (error) {
    console.error("Error getting goals:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to get goals" },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, chartId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can create goals",
          },
        },
        { status: 403 }
      );
    }

    const chart = await getChartWithDetails(chartId);
    if (!chart || chart.familyId !== familyId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Chart not found" },
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createRewardChartGoalSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0].message,
          },
        },
        { status: 400 }
      );
    }

    const goal = await createGoal(chartId, parsed.data);

    return NextResponse.json(
      { success: true, data: { goal } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating goal:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create goal" },
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/reward-charts/\[chartId\]/goals/route.ts
git commit -m "feat(reward-chart): add GET/POST API routes for goals"
```

### Task 4.7: Create Message Routes

**Files:**

- Create: `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/messages/route.ts`

**Step 1: Create the route file**

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import {
  isUserFamilyManager,
  isUserFamilyMember,
  getFamilyMemberByUserId,
} from "@/server/services/family-service";
import {
  createMessage,
  getActiveMessage,
  getChartWithDetails,
} from "@/server/services/reward-chart-service";
import { createRewardChartMessageSchema } from "@/lib/validations/reward-chart";

type Params = { params: Promise<{ familyId: string; chartId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, chartId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a member of this family" },
        },
        { status: 403 }
      );
    }

    const chart = await getChartWithDetails(chartId);
    if (!chart || chart.familyId !== familyId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Chart not found" },
        },
        { status: 404 }
      );
    }

    const message = await getActiveMessage(chartId);

    return NextResponse.json({
      success: true,
      data: { message },
    });
  } catch (error) {
    console.error("Error getting message:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to get message" },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, chartId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can send messages",
          },
        },
        { status: 403 }
      );
    }

    const chart = await getChartWithDetails(chartId);
    if (!chart || chart.familyId !== familyId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Chart not found" },
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createRewardChartMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0].message,
          },
        },
        { status: 400 }
      );
    }

    // Get author's family member ID
    const member = await getFamilyMemberByUserId(session.user.id, familyId);
    if (!member) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a member of this family" },
        },
        { status: 403 }
      );
    }

    const message = await createMessage(chartId, member.id, parsed.data);

    return NextResponse.json(
      { success: true, data: { message } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create message" },
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Add getFamilyMemberByUserId to family-service if missing**

Check if this function exists in `src/server/services/family-service.ts`. If not, add:

```typescript
export async function getFamilyMemberByUserId(
  userId: string,
  familyId: string
) {
  const members = await db
    .select()
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.userId, userId),
        eq(familyMembers.familyId, familyId)
      )
    )
    .limit(1);

  return members[0] ?? null;
}
```

**Step 3: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/reward-charts/\[chartId\]/messages/route.ts src/server/services/family-service.ts
git commit -m "feat(reward-chart): add GET/POST API routes for messages"
```

---

## Phase 5: TypeScript Interfaces & Types

### Task 5.1: Create Reward Chart Interfaces

**Files:**

- Create: `src/components/reward-chart/interfaces.ts`

**Step 1: Create the interfaces file**

```typescript
import type { FamilyMember } from "@/server/schema";

// =============================================================================
// CORE TYPES
// =============================================================================

export type CompletionStatus = "completed" | "missed" | "skipped";
export type GoalStatus = "active" | "achieved" | "cancelled";
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type CellStatus =
  | "completed"
  | "pending"
  | "missed"
  | "future"
  | "not_applicable";

// =============================================================================
// ENTITIES
// =============================================================================

export interface IRewardChart {
  id: string;
  familyId: string;
  memberId: string;
  member: FamilyMember | null;
  isActive: boolean;
  tasks: IRewardChartTask[];
  activeGoal: IRewardChartGoal | null;
  currentMessage: IRewardChartMessage | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRewardChartTask {
  id: string;
  chartId: string;
  title: string;
  icon: string;
  iconColor: string;
  starValue: number;
  daysOfWeek: DayOfWeek[];
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}

export interface IRewardChartCompletion {
  id: string;
  taskId: string;
  date: string;
  status: CompletionStatus;
  completedAt: Date | null;
  createdAt: Date;
}

export interface IRewardChartGoal {
  id: string;
  chartId: string;
  title: string;
  description?: string | null;
  emoji: string;
  starTarget: number;
  starsCurrent: number;
  status: GoalStatus;
  achievedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRewardChartMessage {
  id: string;
  chartId: string;
  content: string;
  authorId: string;
  author?: FamilyMember | null;
  isActive: boolean;
  createdAt: Date;
}

// =============================================================================
// VIEW MODELS
// =============================================================================

export interface WeekDay {
  date: string;
  dayOfWeek: DayOfWeek;
  dayName: string;
  dayNumber: number;
  isToday: boolean;
  isWeekend: boolean;
}

export interface TaskCell {
  date: string;
  status: CellStatus;
  completion: IRewardChartCompletion | null;
  isApplicable: boolean;
}

export interface TaskRow {
  task: IRewardChartTask;
  cells: TaskCell[];
}

export interface TodayStats {
  completed: number;
  total: number;
}

export interface WeeklyChartData {
  chart: IRewardChart;
  weekStart: string;
  weekEnd: string;
  days: WeekDay[];
  tasks: TaskRow[];
  todayStats: TodayStats;
}

// =============================================================================
// API RESPONSES
// =============================================================================

export interface GoalProgress {
  starsCurrent: number;
  starTarget: number;
  progressPercent: number;
  achieved?: boolean;
}

export interface CompleteTaskResponse {
  completion: IRewardChartCompletion;
  goalProgress: GoalProgress | null;
  starsEarned: number;
}

export interface UndoCompletionResponse {
  goalProgress: GoalProgress | null;
  starsRemoved: number;
}
```

**Step 2: Commit**

```bash
git add src/components/reward-chart/interfaces.ts
git commit -m "feat(reward-chart): add TypeScript interfaces"
```

### Task 5.2: Create Constants File

**Files:**

- Create: `src/components/reward-chart/constants.ts`

**Step 1: Create the constants file**

```typescript
export const ICON_COLORS = {
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    darkBg: "dark:bg-blue-950",
    darkText: "dark:text-blue-400",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    darkBg: "dark:bg-emerald-950",
    darkText: "dark:text-emerald-400",
  },
  purple: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    darkBg: "dark:bg-purple-950",
    darkText: "dark:text-purple-400",
  },
  orange: {
    bg: "bg-orange-50",
    text: "text-orange-600",
    darkBg: "dark:bg-orange-950",
    darkText: "dark:text-orange-400",
  },
  pink: {
    bg: "bg-pink-50",
    text: "text-pink-600",
    darkBg: "dark:bg-pink-950",
    darkText: "dark:text-pink-400",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    darkBg: "dark:bg-amber-950",
    darkText: "dark:text-amber-400",
  },
  teal: {
    bg: "bg-teal-50",
    text: "text-teal-600",
    darkBg: "dark:bg-teal-950",
    darkText: "dark:text-teal-400",
  },
  rose: {
    bg: "bg-rose-50",
    text: "text-rose-600",
    darkBg: "dark:bg-rose-950",
    darkText: "dark:text-rose-400",
  },
} as const;

export type IconColorKey = keyof typeof ICON_COLORS;

export const TASK_ICONS = [
  { icon: "dentistry", label: "Brush Teeth" },
  { icon: "bed", label: "Make Bed" },
  { icon: "restaurant", label: "Eat/Table" },
  { icon: "menu_book", label: "Reading" },
  { icon: "checkroom", label: "Clothes/PJs" },
  { icon: "music_note", label: "Practice Music" },
  { icon: "pets", label: "Pet Care" },
  { icon: "school", label: "Homework" },
  { icon: "shower", label: "Shower/Bath" },
  { icon: "backpack", label: "Pack Bag" },
  { icon: "fitness_center", label: "Exercise" },
  { icon: "cleaning_services", label: "Clean Room" },
] as const;

export const DEFAULT_TASKS = [
  {
    title: "Brush Teeth AM",
    icon: "dentistry",
    iconColor: "blue",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
  {
    title: "Brush Teeth PM",
    icon: "dentistry",
    iconColor: "blue",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
  {
    title: "Make Bed",
    icon: "bed",
    iconColor: "emerald",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
  {
    title: "Read 15 Minutes",
    icon: "menu_book",
    iconColor: "orange",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
  {
    title: "PJs On",
    icon: "checkroom",
    iconColor: "pink",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
] as const;
```

**Step 2: Commit**

```bash
git add src/components/reward-chart/constants.ts
git commit -m "feat(reward-chart): add constants for icons and colors"
```

---

## Phase 6: React Context & Hooks

### Task 6.1: Create Reward Chart Context

**Files:**

- Create: `src/components/reward-chart/contexts/reward-chart-context.tsx`

**Step 1: Create the context file**

```typescript
"use client";

import type React from "react";
import { createContext, useContext, useState, useCallback } from "react";
import type {
  WeeklyChartData,
  CompleteTaskResponse,
  UndoCompletionResponse,
} from "../interfaces";

interface RewardChartContextValue {
  weekData: WeeklyChartData | null;
  setWeekData: (data: WeeklyChartData | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  error: Error | null;
  setError: (error: Error | null) => void;
  completeTask: (taskId: string) => Promise<CompleteTaskResponse | null>;
  undoCompletion: (taskId: string) => Promise<UndoCompletionResponse | null>;
  refetch: () => Promise<void>;
  familyId: string;
  chartId: string;
}

const RewardChartContext = createContext<RewardChartContextValue | undefined>(undefined);

interface RewardChartProviderProps {
  children: React.ReactNode;
  familyId: string;
  chartId: string;
  initialData: WeeklyChartData | null;
}

export function RewardChartProvider({
  children,
  familyId,
  chartId,
  initialData,
}: RewardChartProviderProps) {
  const [weekData, setWeekData] = useState<WeeklyChartData | null>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/families/${familyId}/reward-charts/${chartId}/week`);
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message ?? "Failed to fetch chart data");
      }

      setWeekData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [familyId, chartId]);

  const completeTask = useCallback(
    async (taskId: string): Promise<CompleteTaskResponse | null> => {
      try {
        const res = await fetch(
          `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/${taskId}/complete`,
          { method: "POST" }
        );
        const json = await res.json();

        if (!json.success) {
          throw new Error(json.error?.message ?? "Failed to complete task");
        }

        // Refetch to update UI
        await refetch();

        return json.data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
        return null;
      }
    },
    [familyId, chartId, refetch]
  );

  const undoCompletion = useCallback(
    async (taskId: string): Promise<UndoCompletionResponse | null> => {
      try {
        const res = await fetch(
          `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/${taskId}/undo`,
          { method: "POST" }
        );
        const json = await res.json();

        if (!json.success) {
          throw new Error(json.error?.message ?? "Failed to undo completion");
        }

        // Refetch to update UI
        await refetch();

        return json.data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Unknown error"));
        return null;
      }
    },
    [familyId, chartId, refetch]
  );

  const value: RewardChartContextValue = {
    weekData,
    setWeekData,
    isLoading,
    setIsLoading,
    error,
    setError,
    completeTask,
    undoCompletion,
    refetch,
    familyId,
    chartId,
  };

  return (
    <RewardChartContext.Provider value={value}>
      {children}
    </RewardChartContext.Provider>
  );
}

export function useRewardChart() {
  const context = useContext(RewardChartContext);
  if (!context) {
    throw new Error("useRewardChart must be used within RewardChartProvider");
  }
  return context;
}
```

**Step 2: Commit**

```bash
git add src/components/reward-chart/contexts/reward-chart-context.tsx
git commit -m "feat(reward-chart): add React context for chart state"
```

---

## Phase 7: UI Components

### Task 7.1: Create Goal Progress Ring Component

**Files:**

- Create: `src/components/reward-chart/chart-header/goal-progress-ring.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { cn } from "@/lib/utils";
import type { IRewardChartGoal } from "../interfaces";

interface GoalProgressRingProps {
  goal: IRewardChartGoal | null;
  className?: string;
}

export function GoalProgressRing({ goal, className }: GoalProgressRingProps) {
  if (!goal) {
    return (
      <div className={cn("flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800", className)}>
        <div className="text-sm text-slate-500">No active goal</div>
      </div>
    );
  }

  const progressPercent = Math.min(100, Math.round((goal.starsCurrent / goal.starTarget) * 100));
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className={cn("flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800", className)}>
      {/* Progress Ring */}
      <div className="relative h-20 w-20">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
          {/* Track */}
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-slate-100 dark:text-slate-700"
          />
          {/* Progress */}
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-amber-400 transition-all duration-500 ease-out"
          />
        </svg>
        {/* Center Number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">
            {goal.starsCurrent}
          </span>
        </div>
      </div>

      {/* Goal Info */}
      <div className="flex-1">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Current Goal
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xl">{goal.emoji}</span>
          <span className="text-lg font-bold text-slate-900 dark:text-white">
            {goal.title}
          </span>
        </div>
        {/* Progress Bar */}
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-amber-400 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-slate-500">{goal.starsCurrent} / {goal.starTarget} stars</span>
          <span className="font-bold text-amber-500">{progressPercent}%</span>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/reward-chart/chart-header/goal-progress-ring.tsx
git commit -m "feat(reward-chart): add goal progress ring component"
```

### Task 7.2: Create Chart Header Component

**Files:**

- Create: `src/components/reward-chart/chart-header/chart-header.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { cn } from "@/lib/utils";
import { GoalProgressRing } from "./goal-progress-ring";
import type { IRewardChart } from "../interfaces";

interface ChartHeaderProps {
  chart: IRewardChart;
  className?: string;
}

export function ChartHeader({ chart, className }: ChartHeaderProps) {
  const memberName = chart.member?.displayName ?? "Friend";

  return (
    <div className={cn("flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between", className)}>
      <div>
        {/* Badge */}
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 dark:bg-amber-950">
          <span className="text-sm">⭐</span>
          <span className="text-xs font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Weekly Goals
          </span>
        </div>

        {/* Title */}
        <h1 className="font-display text-4xl font-bold text-slate-900 dark:text-white lg:text-5xl">
          Star Chart
        </h1>

        {/* Greeting */}
        <p className="mt-2 text-lg font-medium text-slate-500 dark:text-slate-400">
          Let&apos;s collect stars and earn that reward, {memberName}!
        </p>
      </div>

      {/* Goal Progress */}
      <GoalProgressRing goal={chart.activeGoal} className="lg:min-w-80" />
    </div>
  );
}
```

**Step 2: Create index export**

Create `src/components/reward-chart/chart-header/index.ts`:

```typescript
export { ChartHeader } from "./chart-header";
export { GoalProgressRing } from "./goal-progress-ring";
```

**Step 3: Commit**

```bash
git add src/components/reward-chart/chart-header/
git commit -m "feat(reward-chart): add chart header component"
```

### Task 7.3: Create Task Cell Component

**Files:**

- Create: `src/components/reward-chart/weekly-grid/task-cell.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { cn } from "@/lib/utils";
import { Check, X } from "lucide-react";
import type { TaskCell as TaskCellType } from "../interfaces";

interface TaskCellProps {
  cell: TaskCellType;
  isToday: boolean;
  onComplete: () => void;
  onUndo: () => void;
  disabled?: boolean;
}

export function TaskCell({ cell, isToday, onComplete, onUndo, disabled }: TaskCellProps) {
  const handleClick = () => {
    if (disabled) return;

    if (cell.status === "completed" && isToday) {
      onUndo();
    } else if (cell.status === "pending") {
      onComplete();
    }
  };

  const isInteractive = !disabled && (cell.status === "pending" || (cell.status === "completed" && isToday));

  return (
    <div
      className={cn(
        "flex h-12 items-center justify-center border-l border-slate-100 dark:border-slate-700/50",
        isToday && "bg-indigo-50/20 dark:bg-indigo-500/10",
        cell.status === "not_applicable" && "bg-slate-50/50 dark:bg-slate-800/50"
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
            !disabled && "hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-500",
            !disabled && "dark:hover:border-emerald-400 dark:hover:bg-emerald-950 dark:hover:text-emerald-400"
          )}
          aria-label="Pending - click to complete"
        >
          <Check className="h-4 w-4" />
        </button>
      )}

      {cell.status === "missed" && (
        <X className="h-5 w-5 text-slate-300 dark:text-slate-600" aria-label="Missed" />
      )}

      {cell.status === "not_applicable" && (
        <div className="h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" aria-label="Not scheduled" />
      )}

      {cell.status === "future" && null}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/reward-chart/weekly-grid/task-cell.tsx
git commit -m "feat(reward-chart): add task cell component"
```

### Task 7.4: Create Day Header Component

**Files:**

- Create: `src/components/reward-chart/weekly-grid/day-header.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { cn } from "@/lib/utils";
import type { WeekDay } from "../interfaces";

interface DayHeaderProps {
  day: WeekDay;
}

export function DayHeader({ day }: DayHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-3",
        day.isToday && "relative bg-indigo-50/50 dark:bg-indigo-500/10",
        day.isWeekend && "bg-slate-50/80 dark:bg-slate-800/80"
      )}
    >
      {/* Today indicator bar */}
      {day.isToday && (
        <div className="absolute inset-x-0 top-0 h-1 bg-indigo-500" />
      )}

      {/* Day name */}
      <span
        className={cn(
          "text-[10px] font-medium uppercase tracking-wide",
          day.isWeekend ? "text-rose-500/70" : "text-slate-400"
        )}
      >
        {day.dayName}
      </span>

      {/* Day number */}
      <span
        className={cn(
          "mt-1 flex h-8 w-8 items-center justify-center font-display text-lg font-bold",
          day.isToday
            ? "rounded-full bg-indigo-600 text-white"
            : "text-slate-600 dark:text-slate-300"
        )}
      >
        {day.dayNumber}
      </span>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/reward-chart/weekly-grid/day-header.tsx
git commit -m "feat(reward-chart): add day header component"
```

### Task 7.5: Create Task Row Component

**Files:**

- Create: `src/components/reward-chart/weekly-grid/task-row.tsx`

**Step 1: Create the component**

```typescript
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

export function TaskRow({ taskRow, days, onComplete, onUndo, disabled }: TaskRowProps) {
  const { task, cells } = taskRow;
  const colors = ICON_COLORS[task.iconColor as IconColorKey] ?? ICON_COLORS.blue;

  return (
    <div className="grid grid-cols-[1.8fr_repeat(7,1fr)] divide-x divide-slate-100 dark:divide-slate-700/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
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
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 md:text-base">
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
```

**Step 2: Commit**

```bash
git add src/components/reward-chart/weekly-grid/task-row.tsx
git commit -m "feat(reward-chart): add task row component"
```

### Task 7.6: Create Grid Footer Component

**Files:**

- Create: `src/components/reward-chart/weekly-grid/grid-footer.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { Info } from "lucide-react";
import type { TodayStats } from "../interfaces";

interface GridFooterProps {
  todayStats: TodayStats;
}

export function GridFooter({ todayStats }: GridFooterProps) {
  return (
    <div className="flex items-center justify-between border-t bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-800/50">
      {/* Info hint */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Info className="h-4 w-4" />
        <span>Tap cells to update status</span>
      </div>

      {/* Today's Stats */}
      <div className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 shadow-sm dark:bg-slate-800">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Today&apos;s Stars
        </span>
        <span className="text-lg font-bold text-slate-900 dark:text-white">
          {todayStats.completed}/{todayStats.total}
        </span>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/reward-chart/weekly-grid/grid-footer.tsx
git commit -m "feat(reward-chart): add grid footer component"
```

### Task 7.7: Create Weekly Grid Component

**Files:**

- Create: `src/components/reward-chart/weekly-grid/weekly-grid.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { cn } from "@/lib/utils";
import { DayHeader } from "./day-header";
import { TaskRow } from "./task-row";
import { GridFooter } from "./grid-footer";
import { useRewardChart } from "../contexts/reward-chart-context";

interface WeeklyGridProps {
  className?: string;
}

export function WeeklyGrid({ className }: WeeklyGridProps) {
  const { weekData, completeTask, undoCompletion, isLoading } = useRewardChart();

  if (!weekData) {
    return (
      <div className={cn("rounded-3xl bg-white p-8 shadow-sm dark:bg-slate-800", className)}>
        <p className="text-center text-slate-500">No chart data available</p>
      </div>
    );
  }

  const { days, tasks, todayStats } = weekData;

  return (
    <div className={cn("overflow-hidden rounded-3xl bg-white shadow-sm dark:bg-slate-800", className)}>
      {/* Header Row */}
      <div className="grid grid-cols-[1.8fr_repeat(7,1fr)] border-b bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50">
        {/* Task/Routine label */}
        <div className="flex items-center px-4 py-3">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
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
            />
          ))
        )}
      </div>

      {/* Footer */}
      <GridFooter todayStats={todayStats} />
    </div>
  );
}
```

**Step 2: Create index export**

Create `src/components/reward-chart/weekly-grid/index.ts`:

```typescript
export { WeeklyGrid } from "./weekly-grid";
export { DayHeader } from "./day-header";
export { TaskRow } from "./task-row";
export { TaskCell } from "./task-cell";
export { GridFooter } from "./grid-footer";
```

**Step 3: Commit**

```bash
git add src/components/reward-chart/weekly-grid/
git commit -m "feat(reward-chart): add weekly grid component"
```

### Task 7.8: Create Next Reward Card Component

**Files:**

- Create: `src/components/reward-chart/bottom-cards/next-reward-card.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { cn } from "@/lib/utils";
import { Medal, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { IRewardChartGoal } from "../interfaces";

interface NextRewardCardProps {
  goal: IRewardChartGoal | null;
  onViewRewards?: () => void;
  className?: string;
}

export function NextRewardCard({ goal, onViewRewards, className }: NextRewardCardProps) {
  if (!goal) {
    return (
      <div className={cn("relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800", className)}>
        <div className="text-center text-slate-500">
          No reward set yet
        </div>
      </div>
    );
  }

  const progressPercent = Math.min(100, Math.round((goal.starsCurrent / goal.starTarget) * 100));

  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm dark:bg-slate-800", className)}>
      {/* Glow effect */}
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-50 opacity-60 blur-3xl dark:bg-amber-900/20" />

      {/* Header */}
      <div className="relative flex items-center gap-2">
        <Medal className="h-5 w-5 text-amber-500" />
        <span className="font-display text-lg font-bold text-slate-900 dark:text-white">
          Next Reward
        </span>
        <span className="ml-auto rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-400 dark:bg-slate-700">
          {goal.starTarget} STARS
        </span>
      </div>

      {/* Reward Display */}
      <div className="relative mt-4 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30">
          <span className="text-3xl">{goal.emoji}</span>
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            {goal.title}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            You&apos;re getting closer!
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="relative mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">{goal.starsCurrent} / {goal.starTarget}</span>
          <span className="font-bold text-amber-500">{progressPercent}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Action Button */}
      {onViewRewards && (
        <Button
          variant="default"
          className="mt-4 w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600"
          onClick={onViewRewards}
        >
          View All Rewards
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/reward-chart/bottom-cards/next-reward-card.tsx
git commit -m "feat(reward-chart): add next reward card component"
```

### Task 7.9: Create Message Card Component

**Files:**

- Create: `src/components/reward-chart/bottom-cards/message-card.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { cn } from "@/lib/utils";
import { MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { IRewardChartMessage } from "../interfaces";

interface MessageCardProps {
  message: IRewardChartMessage | null;
  className?: string;
}

export function MessageCard({ message, className }: MessageCardProps) {
  if (!message) {
    return (
      <div className={cn("rounded-2xl bg-indigo-600 p-6 text-white shadow-lg", className)}>
        <div className="flex items-center gap-2 opacity-80">
          <MessageCircle className="h-5 w-5" />
          <span className="font-display font-bold">Message from Parents</span>
        </div>
        <p className="mt-4 text-indigo-100 italic">
          No messages yet
        </p>
      </div>
    );
  }

  const timeAgo = formatDistanceToNow(new Date(message.createdAt), { addSuffix: true });

  return (
    <div className={cn("rounded-2xl bg-indigo-600 p-6 text-white shadow-lg", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
          <MessageCircle className="h-4 w-4" />
        </div>
        <span className="font-display font-bold">Message from Mom & Dad</span>
      </div>

      {/* Message Box */}
      <div className="mt-4 rounded-xl bg-white/10 p-4 backdrop-blur-md">
        <p className="text-lg italic text-indigo-50">
          &ldquo;{message.content}&rdquo;
        </p>
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex -space-x-2">
          {/* Placeholder avatars */}
          <div className="h-8 w-8 rounded-full bg-indigo-400 ring-2 ring-indigo-600" />
          <div className="h-8 w-8 rounded-full bg-indigo-300 ring-2 ring-indigo-600" />
        </div>
        <span className="text-xs text-indigo-200">Sent {timeAgo}</span>
      </div>
    </div>
  );
}
```

**Step 2: Create index export**

Create `src/components/reward-chart/bottom-cards/index.ts`:

```typescript
export { NextRewardCard } from "./next-reward-card";
export { MessageCard } from "./message-card";
```

**Step 3: Commit**

```bash
git add src/components/reward-chart/bottom-cards/
git commit -m "feat(reward-chart): add bottom cards (reward & message)"
```

### Task 7.10: Create Main Page Component

**Files:**

- Create: `src/components/reward-chart/reward-chart-page.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { ChartHeader } from "./chart-header";
import { WeeklyGrid } from "./weekly-grid";
import { NextRewardCard, MessageCard } from "./bottom-cards";
import { useRewardChart } from "./contexts/reward-chart-context";

export function RewardChartPage() {
  const { weekData, isLoading, error } = useRewardChart();

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-red-600">Error loading chart</p>
          <p className="mt-1 text-sm text-slate-500">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!weekData) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-slate-600">No chart found</p>
          <p className="mt-1 text-sm text-slate-500">Ask a parent to set up your star chart!</p>
        </div>
      </div>
    );
  }

  const { chart } = weekData;

  return (
    <div className="space-y-6">
      {/* Header with Goal Progress */}
      <ChartHeader chart={chart} />

      {/* Weekly Grid */}
      <WeeklyGrid className={isLoading ? "pointer-events-none opacity-50" : ""} />

      {/* Bottom Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <NextRewardCard goal={chart.activeGoal} />
        <MessageCard message={chart.currentMessage} />
      </div>
    </div>
  );
}
```

**Step 2: Create main index export**

Create `src/components/reward-chart/index.ts`:

```typescript
export { RewardChartPage } from "./reward-chart-page";
export {
  RewardChartProvider,
  useRewardChart,
} from "./contexts/reward-chart-context";
export * from "./interfaces";
export * from "./constants";
```

**Step 3: Commit**

```bash
git add src/components/reward-chart/reward-chart-page.tsx src/components/reward-chart/index.ts
git commit -m "feat(reward-chart): add main page component and exports"
```

---

## Phase 8: Page Routes

### Task 8.1: Create Reward Chart Page Route

**Files:**

- Create: `src/app/[locale]/(app)/reward-chart/page.tsx`

**Note:** This uses the `(app)` route group structure. The `(app)/layout.tsx` already handles:
- Authentication check (redirects to `/login` if not authenticated)
- Family check (redirects to `/onboarding` if no family)
- AppShell wrapper with header/navigation
- InteractionModeProvider

**Step 1: Create the page**

```typescript
import { setRequestLocale } from "next-intl/server";
import { RewardChartPage, RewardChartProvider } from "@/components/reward-chart";
import { getChartByMemberId, getChartWithDetails } from "@/server/services/reward-chart-service";
import { getFamilyMemberByUserId } from "@/server/services/family-service";
import { getSession } from "@/lib/get-session";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isToday,
  isWeekend,
  isBefore,
  startOfDay,
} from "date-fns";
import { getCompletionsForDateRange } from "@/server/services/reward-chart-service";
import type { Locale } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function RewardChartRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  // Session and family are guaranteed by (app) layout
  const session = await getSession();
  const familyId = session!.session.familyId!;

  // Get member
  const member = await getFamilyMemberByUserId(session!.user.id, familyId);
  if (!member) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-lg font-medium text-slate-600">Member not found</p>
      </div>
    );
  }

  // Get chart for this member
  const chart = await getChartByMemberId(member.id);

  if (!chart) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-slate-600">No star chart found</p>
          <p className="mt-1 text-sm text-slate-500">Ask a family manager to create one for you!</p>
        </div>
      </div>
    );
  }

  // Get full chart data
  const chartDetails = await getChartWithDetails(chart.id);

  if (!chartDetails) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-lg font-medium text-slate-600">Chart not found</p>
      </div>
    );
  }

  // Build week data
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const startDateStr = format(weekStart, "yyyy-MM-dd");
  const endDateStr = format(weekEnd, "yyyy-MM-dd");

  const completions = await getCompletionsForDateRange(chart.id, startDateStr, endDateStr);

  const days = eachDayOfInterval({ start: weekStart, end: weekEnd }).map((date) => ({
    date: format(date, "yyyy-MM-dd"),
    dayOfWeek: date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    dayName: format(date, "EEE"),
    dayNumber: date.getDate(),
    isToday: isToday(date),
    isWeekend: isWeekend(date),
  }));

  const todayStr = format(now, "yyyy-MM-dd");
  const today = startOfDay(now);

  const tasks = chartDetails.tasks.map((task) => {
    const taskDays: number[] = JSON.parse(task.daysOfWeek);

    const cells = days.map((day) => {
      const dayDate = new Date(day.date);
      const isApplicable = taskDays.includes(day.dayOfWeek);
      const completion = completions.find(
        (c) => c.taskId === task.id && c.date === day.date
      );

      let status: "completed" | "pending" | "missed" | "future" | "not_applicable";
      if (!isApplicable) {
        status = "not_applicable";
      } else if (completion?.status === "completed") {
        status = "completed";
      } else if (day.date === todayStr) {
        status = "pending";
      } else if (isBefore(dayDate, today)) {
        status = "missed";
      } else {
        status = "future";
      }

      return {
        date: day.date,
        status,
        completion: completion ?? null,
        isApplicable,
      };
    });

    return {
      task: {
        ...task,
        daysOfWeek: taskDays as (0 | 1 | 2 | 3 | 4 | 5 | 6)[],
        createdAt: task.createdAt,
      },
      cells,
    };
  });

  const todayTasks = chartDetails.tasks.filter((task) => {
    const taskDays: number[] = JSON.parse(task.daysOfWeek);
    return taskDays.includes(now.getDay());
  });

  const todayCompletions = completions.filter(
    (c) => c.date === todayStr && c.status === "completed"
  );

  const todayStats = {
    completed: todayCompletions.length,
    total: todayTasks.length,
  };

  const weekData = {
    chart: {
      ...chartDetails,
      tasks: chartDetails.tasks.map((t) => ({
        ...t,
        daysOfWeek: JSON.parse(t.daysOfWeek) as (0 | 1 | 2 | 3 | 4 | 5 | 6)[],
        createdAt: t.createdAt,
      })),
      createdAt: chartDetails.createdAt,
      updatedAt: chartDetails.updatedAt,
    },
    weekStart: startDateStr,
    weekEnd: endDateStr,
    days,
    tasks,
    todayStats,
  };

  return (
    <RewardChartProvider familyId={familyId} chartId={chart.id} initialData={weekData}>
      <RewardChartPage />
    </RewardChartProvider>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/\[locale\]/\(app\)/reward-chart/page.tsx
git commit -m "feat(reward-chart): add page route for reward chart"
```

### Task 8.2: Add Material Symbols Font

**Files:**

- Modify: `src/app/[locale]/layout.tsx`

**Step 1: Add Material Symbols import**

Add to the head or imports section of the layout:

```typescript
// In the layout component, add this link to the head
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
/>
```

Or add via next/font if preferred.

**Step 2: Commit**

```bash
git add src/app/\[locale\]/layout.tsx
git commit -m "feat(reward-chart): add Material Symbols font"
```

---

## Phase 9: Navigation Integration

### Task 9.1: Add Navigation Link

**Files:**

- Modify: Navigation component (location varies by project)

**Step 1: Add reward chart to navigation**

Find the main navigation component and add a link:

```typescript
{
  href: "/reward-chart",
  label: "Star Chart",
  icon: "stars", // or use a Lucide icon
}
```

**Step 2: Add translations**

Add to `messages/nl.json` and `messages/en.json`:

```json
{
  "navigation": {
    "rewardChart": "Sterrenkaart"
  }
}
```

```json
{
  "navigation": {
    "rewardChart": "Star Chart"
  }
}
```

**Step 3: Commit**

```bash
git add src/components/ messages/
git commit -m "feat(reward-chart): add navigation link"
```

---

## Phase 10: Testing

### Task 10.1: Add E2E Test Fixtures

**Files:**

- Modify: `e2e/utils/test-data-factory.ts`
- Modify: `e2e/utils/db-seeder.ts`

**Step 1: Add test data factory functions**

```typescript
// In test-data-factory.ts
export interface TestRewardChart {
  id: string;
  familyId: string;
  memberId: string;
  isActive: boolean;
}

export interface TestRewardChartTask {
  id: string;
  chartId: string;
  title: string;
  icon: string;
  iconColor: string;
  starValue: number;
  daysOfWeek: string;
  sortOrder: number;
  isActive: boolean;
}

export interface TestRewardChartGoal {
  id: string;
  chartId: string;
  title: string;
  emoji: string;
  starTarget: number;
  starsCurrent: number;
  status: string;
}

export function createTestRewardChart(
  familyId: string,
  memberId: string,
  overrides: Partial<TestRewardChart> = {}
): TestRewardChart {
  return {
    id: overrides.id ?? randomUUID(),
    familyId,
    memberId,
    isActive: overrides.isActive ?? true,
  };
}

export function createTestRewardChartTask(
  chartId: string,
  overrides: Partial<TestRewardChartTask> = {}
): TestRewardChartTask {
  return {
    id: overrides.id ?? randomUUID(),
    chartId,
    title: overrides.title ?? "Test Task",
    icon: overrides.icon ?? "star",
    iconColor: overrides.iconColor ?? "blue",
    starValue: overrides.starValue ?? 1,
    daysOfWeek: overrides.daysOfWeek ?? "[1,2,3,4,5]",
    sortOrder: overrides.sortOrder ?? 0,
    isActive: overrides.isActive ?? true,
  };
}

export function createTestRewardChartGoal(
  chartId: string,
  overrides: Partial<TestRewardChartGoal> = {}
): TestRewardChartGoal {
  return {
    id: overrides.id ?? randomUUID(),
    chartId,
    title: overrides.title ?? "Test Goal",
    emoji: overrides.emoji ?? "🎁",
    starTarget: overrides.starTarget ?? 10,
    starsCurrent: overrides.starsCurrent ?? 0,
    status: overrides.status ?? "active",
  };
}
```

**Step 2: Add seeder methods**

```typescript
// In db-seeder.ts
async seedRewardChart(chart: TestRewardChart): Promise<void> {
  await this.db.insert(schema.rewardCharts).values({
    id: chart.id,
    familyId: chart.familyId,
    memberId: chart.memberId,
    isActive: chart.isActive,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async seedRewardChartTask(task: TestRewardChartTask): Promise<void> {
  await this.db.insert(schema.rewardChartTasks).values({
    id: task.id,
    chartId: task.chartId,
    title: task.title,
    icon: task.icon,
    iconColor: task.iconColor,
    starValue: task.starValue,
    daysOfWeek: task.daysOfWeek,
    sortOrder: task.sortOrder,
    isActive: task.isActive,
    createdAt: new Date(),
  });
}

async seedRewardChartGoal(goal: TestRewardChartGoal): Promise<void> {
  await this.db.insert(schema.rewardChartGoals).values({
    id: goal.id,
    chartId: goal.chartId,
    title: goal.title,
    description: null,
    emoji: goal.emoji,
    starTarget: goal.starTarget,
    starsCurrent: goal.starsCurrent,
    status: goal.status,
    achievedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}
```

**Step 3: Commit**

```bash
git add e2e/utils/
git commit -m "test(reward-chart): add E2E test fixtures and seeders"
```

### Task 10.2: Add E2E Tests

**Files:**

- Create: `e2e/tests/reward-chart/view-chart.spec.ts`

**Step 1: Create the test file**

```typescript
import { test, expect } from "../../fixtures";
import {
  createTestRewardChart,
  createTestRewardChartTask,
  createTestRewardChartGoal,
} from "../../utils/test-data-factory";

test.describe("Reward Chart", () => {
  test("displays chart with tasks and goal", async ({
    page,
    context,
    familyWithMembers,
    applyAuth,
    seeder,
  }) => {
    // Apply authentication
    await applyAuth(context, [
      familyWithMembers.sessionCookie,
      familyWithMembers.familyCookie,
    ]);

    // Create test chart
    const chart = createTestRewardChart(
      familyWithMembers.family.id,
      familyWithMembers.member.id
    );
    await seeder.seedRewardChart(chart);

    // Create test task
    const task = createTestRewardChartTask(chart.id, {
      title: "Brush Teeth",
      icon: "dentistry",
      iconColor: "blue",
    });
    await seeder.seedRewardChartTask(task);

    // Create test goal
    const goal = createTestRewardChartGoal(chart.id, {
      title: "Ice Cream Trip",
      emoji: "🍦",
      starTarget: 10,
      starsCurrent: 3,
    });
    await seeder.seedRewardChartGoal(goal);

    // Navigate to chart
    await page.goto("/reward-chart");

    // Verify chart elements are visible
    await expect(page.getByText("Star Chart")).toBeVisible();
    await expect(page.getByText("Brush Teeth")).toBeVisible();
    await expect(page.getByText("Ice Cream Trip")).toBeVisible();
    await expect(page.getByText("3 / 10")).toBeVisible();
  });

  test("can complete a task", async ({
    page,
    context,
    familyWithMembers,
    applyAuth,
    seeder,
  }) => {
    await applyAuth(context, [
      familyWithMembers.sessionCookie,
      familyWithMembers.familyCookie,
    ]);

    const chart = createTestRewardChart(
      familyWithMembers.family.id,
      familyWithMembers.member.id
    );
    await seeder.seedRewardChart(chart);

    // Create task for today
    const today = new Date().getDay();
    const task = createTestRewardChartTask(chart.id, {
      title: "Test Task",
      daysOfWeek: JSON.stringify([today]),
    });
    await seeder.seedRewardChartTask(task);

    await page.goto("/reward-chart");

    // Find and click pending cell
    const pendingButton = page.getByLabel("Pending - click to complete");
    await pendingButton.click();

    // Verify star appears
    await expect(page.getByText("⭐")).toBeVisible();
  });
});
```

**Step 2: Run tests to verify**

Run: `pnpm e2e e2e/tests/reward-chart/`
Expected: Tests pass

**Step 3: Commit**

```bash
git add e2e/tests/reward-chart/
git commit -m "test(reward-chart): add E2E tests for chart viewing and completion"
```

---

## Final Checklist

- [ ] Database schema added and migrations applied
- [ ] Validation schemas created
- [ ] Service layer implemented
- [ ] API routes created (charts, tasks, completions, goals, messages)
- [ ] TypeScript interfaces defined
- [ ] React context and hooks created
- [ ] UI components built (header, grid, cards)
- [ ] Page route created
- [ ] Material Symbols font added
- [ ] Navigation link added
- [ ] Translations added
- [ ] E2E tests written and passing
- [ ] All commits made with conventional commit format

---

## Future Enhancements (Not in Scope)

- Management UI for parents to configure tasks/goals
- Wall display mode with simplified interface
- Historical data viewing (past weeks)
- Star transaction integration with Reward Store
- Animations with Framer Motion
- Push notifications for goal achievements
