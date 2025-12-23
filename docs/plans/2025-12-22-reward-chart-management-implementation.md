# Reward Chart Management Interface - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add inline management controls to the reward chart page, allowing parents to configure charts, tasks, goals, and messages for their children.

**Architecture:** Extend existing reward chart components with conditional edit controls visible in "manage" mode (via InteractionModeContext). Use shadcn Dialog modals for add/edit forms. Follow existing calendar patterns for drag-and-drop task reordering. All mutations go through API routes with optimistic UI updates.

**Tech Stack:** React 19, TypeScript, shadcn/ui (Dialog, Form), react-hook-form + Zod, HTML5 DnD, sonner toast

---

## Phase 1: Foundation & API Routes

### Task 1.1: Add Task CRUD API Routes

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/tasks/route.ts`
- Create: `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/tasks/[taskId]/route.ts`
- Create: `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/tasks/reorder/route.ts`

**Step 1: Add PUT/DELETE to existing task route**

Modify `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/tasks/[taskId]/route.ts`:

```typescript
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { rewardChartTasks, rewardCharts, familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateTaskSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  icon: z.string().optional(),
  iconColor: z
    .enum([
      "blue",
      "emerald",
      "purple",
      "orange",
      "pink",
      "amber",
      "teal",
      "rose",
    ])
    .optional(),
  starValue: z.number().int().min(1).max(10).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).optional(),
});

type RouteContext = {
  params: Promise<{ familyId: string; chartId: string; taskId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { familyId, chartId, taskId } = await context.params;

  // Verify manager role
  const member = await db.query.familyMembers.findFirst({
    where: and(
      eq(familyMembers.familyId, familyId),
      eq(familyMembers.userId, session.user.id)
    ),
  });

  if (!member || member.role !== "manager") {
    return NextResponse.json(
      { success: false, error: { message: "Forbidden" } },
      { status: 403 }
    );
  }

  // Verify chart belongs to family
  const chart = await db.query.rewardCharts.findFirst({
    where: and(
      eq(rewardCharts.id, chartId),
      eq(rewardCharts.familyId, familyId)
    ),
  });

  if (!chart) {
    return NextResponse.json(
      { success: false, error: { message: "Chart not found" } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = updateTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: parsed.error.message } },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.icon !== undefined) updateData.icon = parsed.data.icon;
  if (parsed.data.iconColor !== undefined)
    updateData.iconColor = parsed.data.iconColor;
  if (parsed.data.starValue !== undefined)
    updateData.starValue = parsed.data.starValue;
  if (parsed.data.daysOfWeek !== undefined)
    updateData.daysOfWeek = JSON.stringify(parsed.data.daysOfWeek);

  const [updated] = await db
    .update(rewardChartTasks)
    .set(updateData)
    .where(
      and(
        eq(rewardChartTasks.id, taskId),
        eq(rewardChartTasks.chartId, chartId)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json(
      { success: false, error: { message: "Task not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: { task: updated } });
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { familyId, chartId, taskId } = await context.params;

  // Verify manager role
  const member = await db.query.familyMembers.findFirst({
    where: and(
      eq(familyMembers.familyId, familyId),
      eq(familyMembers.userId, session.user.id)
    ),
  });

  if (!member || member.role !== "manager") {
    return NextResponse.json(
      { success: false, error: { message: "Forbidden" } },
      { status: 403 }
    );
  }

  // Soft delete via isActive flag
  const [deleted] = await db
    .update(rewardChartTasks)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(rewardChartTasks.id, taskId),
        eq(rewardChartTasks.chartId, chartId)
      )
    )
    .returning();

  if (!deleted) {
    return NextResponse.json(
      { success: false, error: { message: "Task not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: { taskId } });
}
```

**Step 2: Create reorder endpoint**

Create `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/tasks/reorder/route.ts`:

```typescript
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { rewardChartTasks, rewardCharts, familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const reorderSchema = z.object({
  taskIds: z.array(z.string().uuid()),
});

type RouteContext = {
  params: Promise<{ familyId: string; chartId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { familyId, chartId } = await context.params;

  // Verify manager role
  const member = await db.query.familyMembers.findFirst({
    where: and(
      eq(familyMembers.familyId, familyId),
      eq(familyMembers.userId, session.user.id)
    ),
  });

  if (!member || member.role !== "manager") {
    return NextResponse.json(
      { success: false, error: { message: "Forbidden" } },
      { status: 403 }
    );
  }

  // Verify chart belongs to family
  const chart = await db.query.rewardCharts.findFirst({
    where: and(
      eq(rewardCharts.id, chartId),
      eq(rewardCharts.familyId, familyId)
    ),
  });

  if (!chart) {
    return NextResponse.json(
      { success: false, error: { message: "Chart not found" } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = reorderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: parsed.error.message } },
      { status: 400 }
    );
  }

  // Update sortOrder for each task
  await db.transaction(async (tx) => {
    for (let i = 0; i < parsed.data.taskIds.length; i++) {
      await tx
        .update(rewardChartTasks)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(
          and(
            eq(rewardChartTasks.id, parsed.data.taskIds[i]),
            eq(rewardChartTasks.chartId, chartId)
          )
        );
    }
  });

  return NextResponse.json({
    success: true,
    data: { taskIds: parsed.data.taskIds },
  });
}
```

**Step 3: Run linting to verify**

```bash
pnpm lint src/app/api/v1/families/\[familyId\]/reward-charts/\[chartId\]/tasks/
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/reward-charts/\[chartId\]/tasks/
git commit -m "feat(reward-chart): add task update, delete, and reorder API routes"
```

---

### Task 1.2: Add Goal Update API Route

**Files:**

- Create: `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/goals/[goalId]/route.ts`

**Step 1: Create goal CRUD route**

Create `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/goals/[goalId]/route.ts`:

```typescript
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { rewardChartGoals, rewardCharts, familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateGoalSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  emoji: z.string().optional(),
  starTarget: z.number().int().min(5).max(100).optional(),
  status: z.enum(["active", "achieved", "cancelled"]).optional(),
});

type RouteContext = {
  params: Promise<{ familyId: string; chartId: string; goalId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: { message: "Unauthorized" } },
      { status: 401 }
    );
  }

  const { familyId, chartId, goalId } = await context.params;

  // Verify manager role
  const member = await db.query.familyMembers.findFirst({
    where: and(
      eq(familyMembers.familyId, familyId),
      eq(familyMembers.userId, session.user.id)
    ),
  });

  if (!member || member.role !== "manager") {
    return NextResponse.json(
      { success: false, error: { message: "Forbidden" } },
      { status: 403 }
    );
  }

  // Verify chart belongs to family
  const chart = await db.query.rewardCharts.findFirst({
    where: and(
      eq(rewardCharts.id, chartId),
      eq(rewardCharts.familyId, familyId)
    ),
  });

  if (!chart) {
    return NextResponse.json(
      { success: false, error: { message: "Chart not found" } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const parsed = updateGoalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: parsed.error.message } },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
  if (parsed.data.description !== undefined)
    updateData.description = parsed.data.description;
  if (parsed.data.emoji !== undefined) updateData.emoji = parsed.data.emoji;
  if (parsed.data.starTarget !== undefined)
    updateData.starTarget = parsed.data.starTarget;
  if (parsed.data.status !== undefined) {
    updateData.status = parsed.data.status;
    if (parsed.data.status === "achieved") {
      updateData.achievedAt = new Date();
    }
  }

  const [updated] = await db
    .update(rewardChartGoals)
    .set(updateData)
    .where(
      and(
        eq(rewardChartGoals.id, goalId),
        eq(rewardChartGoals.chartId, chartId)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json(
      { success: false, error: { message: "Goal not found" } },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: { goal: updated } });
}
```

**Step 2: Run linting**

```bash
pnpm lint src/app/api/v1/families/\[familyId\]/reward-charts/\[chartId\]/goals/
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/reward-charts/\[chartId\]/goals/
git commit -m "feat(reward-chart): add goal update API route"
```

---

### Task 1.3: Extend RewardChartContext with Mutations

**Files:**

- Modify: `src/components/reward-chart/contexts/reward-chart-context.tsx`

**Step 1: Add mutation types to context interface**

Add to the `RewardChartContextValue` interface in `reward-chart-context.tsx`:

```typescript
// Add these imports at top
import type {
  CreateTaskInput,
  UpdateTaskInput,
  CreateGoalInput,
  UpdateGoalInput,
} from "../interfaces";

// Add to RewardChartContextValue interface (after existing methods):
// Task mutations
createTask: (input: CreateTaskInput) => Promise<void>;
updateTask: (taskId: string, input: UpdateTaskInput) => Promise<void>;
deleteTask: (taskId: string) => Promise<void>;
reorderTasks: (taskIds: string[]) => Promise<void>;
// Goal mutations
createGoal: (input: CreateGoalInput) => Promise<void>;
updateGoal: (goalId: string, input: UpdateGoalInput) => Promise<void>;
// Message mutation
sendMessage: (content: string) => Promise<void>;
```

**Step 2: Add input types to interfaces.ts**

Add to `src/components/reward-chart/interfaces.ts`:

```typescript
export interface CreateTaskInput {
  title: string;
  icon: string;
  iconColor: string;
  starValue: number;
  daysOfWeek: number[];
}

export interface UpdateTaskInput {
  title?: string;
  icon?: string;
  iconColor?: string;
  starValue?: number;
  daysOfWeek?: number[];
}

export interface CreateGoalInput {
  title: string;
  emoji: string;
  starTarget: number;
  description?: string;
}

export interface UpdateGoalInput {
  title?: string;
  emoji?: string;
  starTarget?: number;
  description?: string | null;
  status?: "active" | "achieved" | "cancelled";
}
```

**Step 3: Implement mutation functions in context**

Add these functions inside `RewardChartProvider` in `reward-chart-context.tsx`:

```typescript
const createTask = useCallback(
  async (input: CreateTaskInput) => {
    const response = await fetch(
      `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || "Failed to create task");
    }
    await refetch();
  },
  [familyId, chartId, refetch]
);

const updateTask = useCallback(
  async (taskId: string, input: UpdateTaskInput) => {
    const response = await fetch(
      `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/${taskId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || "Failed to update task");
    }
    await refetch();
  },
  [familyId, chartId, refetch]
);

const deleteTask = useCallback(
  async (taskId: string) => {
    const response = await fetch(
      `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/${taskId}`,
      {
        method: "DELETE",
      }
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || "Failed to delete task");
    }
    await refetch();
  },
  [familyId, chartId, refetch]
);

const reorderTasks = useCallback(
  async (taskIds: string[]) => {
    const response = await fetch(
      `/api/v1/families/${familyId}/reward-charts/${chartId}/tasks/reorder`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds }),
      }
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || "Failed to reorder tasks");
    }
    await refetch();
  },
  [familyId, chartId, refetch]
);

const createGoal = useCallback(
  async (input: CreateGoalInput) => {
    const response = await fetch(
      `/api/v1/families/${familyId}/reward-charts/${chartId}/goals`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || "Failed to create goal");
    }
    await refetch();
  },
  [familyId, chartId, refetch]
);

const updateGoal = useCallback(
  async (goalId: string, input: UpdateGoalInput) => {
    const response = await fetch(
      `/api/v1/families/${familyId}/reward-charts/${chartId}/goals/${goalId}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || "Failed to update goal");
    }
    await refetch();
  },
  [familyId, chartId, refetch]
);

const sendMessage = useCallback(
  async (content: string) => {
    const response = await fetch(
      `/api/v1/families/${familyId}/reward-charts/${chartId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }
    );
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || "Failed to send message");
    }
    await refetch();
  },
  [familyId, chartId, refetch]
);
```

**Step 4: Add to context value**

Update the `value` object in `RewardChartProvider`:

```typescript
const value: RewardChartContextValue = useMemo(
  () => ({
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
    // New mutations
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    createGoal,
    updateGoal,
    sendMessage,
  }),
  [
    weekData,
    isLoading,
    error,
    completeTask,
    undoCompletion,
    refetch,
    familyId,
    chartId,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    createGoal,
    updateGoal,
    sendMessage,
  ]
);
```

**Step 5: Run type check**

```bash
pnpm tsc --noEmit
```

Expected: No errors

**Step 6: Commit**

```bash
git add src/components/reward-chart/contexts/reward-chart-context.tsx src/components/reward-chart/interfaces.ts
git commit -m "feat(reward-chart): add mutation methods to context"
```

---

## Phase 2: Task Management UI

### Task 2.1: Create TaskDialog Component

**Files:**

- Create: `src/components/reward-chart/dialogs/task-dialog.tsx`

**Step 1: Create the dialog component**

Create `src/components/reward-chart/dialogs/task-dialog.tsx`:

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { TASK_ICONS, ICON_COLORS } from "../constants";
import type { IRewardChartTask } from "../interfaces";
import { useTranslations } from "next-intl";

const taskFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  icon: z.string().min(1),
  iconColor: z.enum(["blue", "emerald", "purple", "orange", "pink", "amber", "teal", "rose"]),
  starValue: z.coerce.number().int().min(1).max(10),
  daysOfWeek: z.array(z.number()).min(1, "Select at least one day"),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: IRewardChartTask;
  onSubmit: (values: TaskFormValues) => Promise<void>;
}

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

export function TaskDialog({ open, onOpenChange, task, onSubmit }: TaskDialogProps) {
  const t = useTranslations("rewardChart");
  const isEditing = !!task;

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: task
      ? {
          title: task.title,
          icon: task.icon,
          iconColor: task.iconColor as TaskFormValues["iconColor"],
          starValue: task.starValue,
          daysOfWeek: JSON.parse(task.daysOfWeek),
        }
      : {
          title: "",
          icon: "star",
          iconColor: "blue",
          starValue: 1,
          daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri default
        },
  });

  const handleSubmit = async (values: TaskFormValues) => {
    await onSubmit(values);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("editTask") : t("addTask")}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("taskTitle")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("taskTitlePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("icon")}</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-6 gap-2">
                      {Object.entries(TASK_ICONS).map(([key, Icon]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => field.onChange(key)}
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-lg border-2 transition-colors",
                            field.value === key
                              ? "border-primary bg-primary/10"
                              : "border-muted hover:border-muted-foreground/50"
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="iconColor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("color")}</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(ICON_COLORS).map(([key, colors]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => field.onChange(key)}
                          className={cn(
                            "h-8 w-8 rounded-full transition-transform",
                            colors.bg,
                            field.value === key && "ring-2 ring-primary ring-offset-2 scale-110"
                          )}
                        />
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="starValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("starValue")}</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        className="w-20"
                        {...field}
                      />
                      <span className="text-muted-foreground">⭐</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="daysOfWeek"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("daysOfWeek")}</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map((day) => (
                        <label
                          key={day.value}
                          className={cn(
                            "flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border-2 text-sm font-medium transition-colors",
                            field.value.includes(day.value)
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted hover:border-muted-foreground/50"
                          )}
                        >
                          <Checkbox
                            checked={field.value.includes(day.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...field.value, day.value].sort());
                              } else {
                                field.onChange(field.value.filter((d) => d !== day.value));
                              }
                            }}
                            className="sr-only"
                          />
                          {day.label.charAt(0)}
                        </label>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t("saving") : isEditing ? t("save") : t("add")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Add translations**

Add to `messages/en.json` under `rewardChart`:

```json
"editTask": "Edit Task",
"addTask": "Add Task",
"taskTitle": "Task Title",
"taskTitlePlaceholder": "e.g., Brush teeth",
"icon": "Icon",
"color": "Color",
"starValue": "Stars",
"daysOfWeek": "Days",
"cancel": "Cancel",
"saving": "Saving...",
"save": "Save",
"add": "Add"
```

Add to `messages/nl.json` under `rewardChart`:

```json
"editTask": "Taak bewerken",
"addTask": "Taak toevoegen",
"taskTitle": "Taaknaam",
"taskTitlePlaceholder": "bijv. Tanden poetsen",
"icon": "Icoon",
"color": "Kleur",
"starValue": "Sterren",
"daysOfWeek": "Dagen",
"cancel": "Annuleren",
"saving": "Opslaan...",
"save": "Opslaan",
"add": "Toevoegen"
```

**Step 3: Run type check**

```bash
pnpm tsc --noEmit
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/components/reward-chart/dialogs/task-dialog.tsx messages/
git commit -m "feat(reward-chart): add TaskDialog component"
```

---

### Task 2.2: Add Task Management Controls to TaskRow

**Files:**

- Modify: `src/components/reward-chart/weekly-grid/task-row.tsx`

**Design Note:** Use tap-to-expand pattern instead of hover (mobile-friendly). Tapping a task row in manage mode expands it to reveal edit/delete actions.

**Step 1: Add edit/delete buttons to task row with tap-to-expand**

Update `task-row.tsx` to include management controls:

```typescript
"use client";

import { useState } from "react";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { GripVertical, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TaskRow as TaskRowType } from "../interfaces";

interface TaskRowProps {
  task: TaskRowType;
  onComplete: (taskId: string) => void;
  onUndo: (taskId: string) => void;
  onEdit?: (task: TaskRowType) => void;
  onDelete?: (taskId: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, taskId: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, taskId: string) => void;
}

export function TaskRow({
  task,
  onComplete,
  onUndo,
  onEdit,
  onDelete,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
}: TaskRowProps) {
  const { mode } = useInteractionMode();
  const isManageMode = mode === "manage";
  const [isExpanded, setIsExpanded] = useState(false);

  // Toggle expanded state on tap (mobile-friendly)
  const handleRowClick = () => {
    if (isManageMode) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl bg-white p-2 shadow-sm dark:bg-gray-800",
          draggable && isManageMode && "cursor-grab",
          isManageMode && "cursor-pointer"
        )}
        draggable={draggable && isManageMode && !isExpanded}
        onDragStart={(e) => onDragStart?.(e, task.id)}
        onDragOver={onDragOver}
        onDrop={(e) => onDrop?.(e, task.id)}
        onClick={handleRowClick}
      >
        {/* Drag handle - only in manage mode */}
        {isManageMode && (
          <div className="flex-shrink-0 cursor-grab">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        {/* Task icon and title */}
        <div className="flex min-w-[140px] items-center gap-2">
          {/* ... existing icon/title code ... */}
        </div>

        {/* Day cells */}
        <div className="flex flex-1 gap-1" onClick={(e) => e.stopPropagation()}>
          {/* ... existing cells code ... */}
        </div>

        {/* Expand indicator - only in manage mode */}
        {isManageMode && (
          <div className="flex-shrink-0">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {/* Expanded action buttons - tap to reveal (mobile-friendly) */}
      {isManageMode && isExpanded && (
        <div className="flex items-center justify-end gap-2 px-2 py-1 animate-in slide-in-from-top-2 duration-200">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(task);
            }}
          >
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(task.id);
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Run type check**

```bash
pnpm tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/reward-chart/weekly-grid/task-row.tsx
git commit -m "feat(reward-chart): add management controls to TaskRow"
```

---

### Task 2.3: Add AddTaskRow Component

**Files:**

- Create: `src/components/reward-chart/weekly-grid/add-task-row.tsx`

**Step 1: Create the add task row**

Create `src/components/reward-chart/weekly-grid/add-task-row.tsx`:

```typescript
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
        "flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed",
        "border-muted-foreground/25 p-4 text-muted-foreground",
        "transition-colors hover:border-primary hover:text-primary"
      )}
    >
      <Plus className="h-5 w-5" />
      <span className="font-medium">{t("addTask")}</span>
    </button>
  );
}
```

**Step 2: Export from index**

Add to `src/components/reward-chart/weekly-grid/index.ts`:

```typescript
export { AddTaskRow } from "./add-task-row";
```

**Step 3: Commit**

```bash
git add src/components/reward-chart/weekly-grid/add-task-row.tsx src/components/reward-chart/weekly-grid/index.ts
git commit -m "feat(reward-chart): add AddTaskRow component"
```

---

### Task 2.4: Integrate Task Management in WeeklyGrid

**Files:**

- Modify: `src/components/reward-chart/weekly-grid/weekly-grid.tsx`

**Step 1: Add state and handlers for task management**

Update `weekly-grid.tsx`:

```typescript
"use client";

import { useState, useCallback } from "react";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { useRewardChart } from "../contexts/reward-chart-context";
import { TaskRow } from "./task-row";
import { AddTaskRow } from "./add-task-row";
import { TaskDialog } from "../dialogs/task-dialog";
import { DayHeader } from "./day-header";
import { GridFooter } from "./grid-footer";
import { toast } from "sonner";
import type { TaskRow as TaskRowType, CreateTaskInput, UpdateTaskInput } from "../interfaces";

export function WeeklyGrid() {
  const { mode } = useInteractionMode();
  const isManageMode = mode === "manage";
  const {
    weekData,
    completeTask,
    undoCompletion,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
  } = useRewardChart();

  // Task dialog state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRowType | undefined>();

  // Drag state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const handleAddTask = () => {
    setEditingTask(undefined);
    setTaskDialogOpen(true);
  };

  const handleEditTask = (task: TaskRowType) => {
    setEditingTask(task);
    setTaskDialogOpen(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      toast.success("Task deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete task");
    }
  };

  const handleTaskSubmit = async (values: CreateTaskInput | UpdateTaskInput) => {
    try {
      if (editingTask) {
        await updateTask(editingTask.id, values as UpdateTaskInput);
        toast.success("Task updated");
      } else {
        await createTask(values as CreateTaskInput);
        toast.success("Task created");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save task");
      throw error;
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetTaskId: string) => {
    e.preventDefault();
    if (!draggedTaskId || draggedTaskId === targetTaskId || !weekData) return;

    const tasks = weekData.tasks;
    const draggedIndex = tasks.findIndex((t) => t.id === draggedTaskId);
    const targetIndex = tasks.findIndex((t) => t.id === targetTaskId);

    if (draggedIndex === -1 || targetIndex === -1) return;

    // Reorder locally first for immediate feedback
    const newOrder = [...tasks];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    try {
      await reorderTasks(newOrder.map((t) => t.id));
    } catch (error) {
      toast.error("Failed to reorder tasks");
    }

    setDraggedTaskId(null);
  };

  if (!weekData) return null;

  return (
    <div className="space-y-2">
      <DayHeader days={weekData.days} />

      {weekData.tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onComplete={completeTask}
          onUndo={undoCompletion}
          onEdit={handleEditTask}
          onDelete={handleDeleteTask}
          draggable={isManageMode}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        />
      ))}

      {isManageMode && <AddTaskRow onClick={handleAddTask} />}

      <GridFooter />

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        task={editingTask}
        onSubmit={handleTaskSubmit}
      />
    </div>
  );
}
```

**Step 2: Run type check and lint**

```bash
pnpm tsc --noEmit && pnpm lint src/components/reward-chart/
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/components/reward-chart/weekly-grid/weekly-grid.tsx
git commit -m "feat(reward-chart): integrate task management in WeeklyGrid"
```

---

## Phase 3: Goal Management UI

### Task 3.1: Create GoalDialog Component

**Files:**

- Create: `src/components/reward-chart/dialogs/goal-dialog.tsx`

**Step 1: Create the dialog component**

Create `src/components/reward-chart/dialogs/goal-dialog.tsx`:

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { IRewardChartGoal } from "../interfaces";
import { useTranslations } from "next-intl";

const goalFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  emoji: z.string().min(1),
  starTarget: z.number().int().min(5).max(100),
  description: z.string().max(500).optional(),
});

type GoalFormValues = z.infer<typeof goalFormSchema>;

interface GoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: IRewardChartGoal;
  onSubmit: (values: GoalFormValues) => Promise<void>;
}

const REWARD_EMOJIS = ["🎁", "🎮", "🍦", "🎬", "🏊", "🎢", "🧸", "📱", "🎨", "⚽", "🎪", "🍕"];

export function GoalDialog({ open, onOpenChange, goal, onSubmit }: GoalDialogProps) {
  const t = useTranslations("rewardChart");
  const isEditing = !!goal;

  const form = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: goal
      ? {
          title: goal.title,
          emoji: goal.emoji,
          starTarget: goal.starTarget,
          description: goal.description || "",
        }
      : {
          title: "",
          emoji: "🎁",
          starTarget: 20,
          description: "",
        },
  });

  const handleSubmit = async (values: GoalFormValues) => {
    await onSubmit(values);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("editGoal") : t("setGoal")}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="emoji"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rewardEmoji")}</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {REWARD_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => field.onChange(emoji)}
                          className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-xl border-2 text-2xl transition-colors",
                            field.value === emoji
                              ? "border-primary bg-primary/10"
                              : "border-muted hover:border-muted-foreground/50"
                          )}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("goalTitle")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("goalTitlePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="starTarget"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("starTarget")}: {field.value} ⭐
                  </FormLabel>
                  <FormControl>
                    <Slider
                      min={5}
                      max={100}
                      step={5}
                      value={[field.value]}
                      onValueChange={([value]) => field.onChange(value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("description")} ({t("optional")})</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("goalDescriptionPlaceholder")}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t("saving") : isEditing ? t("save") : t("setGoal")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Add translations**

Add to `messages/en.json` under `rewardChart`:

```json
"editGoal": "Edit Goal",
"setGoal": "Set Goal",
"rewardEmoji": "Reward Emoji",
"goalTitle": "Goal Title",
"goalTitlePlaceholder": "e.g., Trip to the zoo",
"starTarget": "Stars needed",
"description": "Description",
"optional": "optional",
"goalDescriptionPlaceholder": "Describe the reward..."
```

Add to `messages/nl.json` under `rewardChart`:

```json
"editGoal": "Doel bewerken",
"setGoal": "Doel instellen",
"rewardEmoji": "Beloning emoji",
"goalTitle": "Doel titel",
"goalTitlePlaceholder": "bijv. Uitje naar de dierentuin",
"starTarget": "Sterren nodig",
"description": "Beschrijving",
"optional": "optioneel",
"goalDescriptionPlaceholder": "Beschrijf de beloning..."
```

**Step 3: Run type check**

```bash
pnpm tsc --noEmit
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/components/reward-chart/dialogs/goal-dialog.tsx messages/
git commit -m "feat(reward-chart): add GoalDialog component"
```

---

### Task 3.2: Add Goal Management to NextRewardCard

**Files:**

- Modify: `src/components/reward-chart/bottom-cards/next-reward-card.tsx`

**Step 1: Add goal management controls**

Update `next-reward-card.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { useRewardChart } from "../contexts/reward-chart-context";
import { GoalDialog } from "../dialogs/goal-dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Target, Check, X } from "lucide-react";
import { GoalProgressRing } from "../chart-header/goal-progress-ring";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { CreateGoalInput, UpdateGoalInput } from "../interfaces";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function NextRewardCard() {
  const t = useTranslations("rewardChart");
  const { mode } = useInteractionMode();
  const isManageMode = mode === "manage";
  const { weekData, createGoal, updateGoal } = useRewardChart();

  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"achieved" | "cancelled" | null>(null);

  const activeGoal = weekData?.chart.goals?.find((g) => g.status === "active");

  const handleGoalSubmit = async (values: CreateGoalInput | UpdateGoalInput) => {
    try {
      if (activeGoal) {
        await updateGoal(activeGoal.id, values as UpdateGoalInput);
        toast.success(t("goalUpdated"));
      } else {
        await createGoal(values as CreateGoalInput);
        toast.success(t("goalCreated"));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("goalError"));
      throw error;
    }
  };

  const handleMarkGoal = async () => {
    if (!activeGoal || !confirmAction) return;

    try {
      await updateGoal(activeGoal.id, { status: confirmAction });
      toast.success(confirmAction === "achieved" ? t("goalAchieved") : t("goalCancelled"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("goalError"));
    } finally {
      setConfirmDialogOpen(false);
      setConfirmAction(null);
    }
  };

  const openConfirmDialog = (action: "achieved" | "cancelled") => {
    setConfirmAction(action);
    setConfirmDialogOpen(true);
  };

  if (!weekData) return null;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {t("nextReward")}
        </h3>
        {isManageMode && activeGoal && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setGoalDialogOpen(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600 hover:text-green-700"
              onClick={() => openConfirmDialog("achieved")}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => openConfirmDialog("cancelled")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {activeGoal ? (
        <div className="flex items-center gap-4">
          <GoalProgressRing
            current={activeGoal.starsCurrent}
            target={activeGoal.starTarget}
            emoji={activeGoal.emoji}
          />
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {activeGoal.title}
            </p>
            <p className="text-sm text-muted-foreground">
              {activeGoal.starsCurrent} / {activeGoal.starTarget} ⭐
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center py-4">
          {isManageMode ? (
            <Button onClick={() => setGoalDialogOpen(true)}>
              <Target className="mr-2 h-4 w-4" />
              {t("setGoal")}
            </Button>
          ) : (
            <p className="text-muted-foreground">{t("noGoalSet")}</p>
          )}
        </div>
      )}

      <GoalDialog
        open={goalDialogOpen}
        onOpenChange={setGoalDialogOpen}
        goal={activeGoal}
        onSubmit={handleGoalSubmit}
      />

      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "achieved" ? t("markAchievedTitle") : t("markCancelledTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "achieved" ? t("markAchievedDescription") : t("markCancelledDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleMarkGoal}>
              {confirmAction === "achieved" ? t("markAchieved") : t("markCancelled")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

**Step 2: Add translations**

Add to `messages/en.json` under `rewardChart`:

```json
"nextReward": "Next Reward",
"noGoalSet": "No goal set yet",
"goalUpdated": "Goal updated",
"goalCreated": "Goal created",
"goalAchieved": "Goal achieved! 🎉",
"goalCancelled": "Goal cancelled",
"goalError": "Failed to update goal",
"markAchievedTitle": "Mark goal as achieved?",
"markAchievedDescription": "This will mark the goal as complete. You can then set a new goal.",
"markCancelledTitle": "Cancel this goal?",
"markCancelledDescription": "This will cancel the current goal. Progress will be saved.",
"markAchieved": "Mark Achieved",
"markCancelled": "Cancel Goal"
```

Add to `messages/nl.json` under `rewardChart`:

```json
"nextReward": "Volgende beloning",
"noGoalSet": "Nog geen doel ingesteld",
"goalUpdated": "Doel bijgewerkt",
"goalCreated": "Doel aangemaakt",
"goalAchieved": "Doel behaald! 🎉",
"goalCancelled": "Doel geannuleerd",
"goalError": "Doel bijwerken mislukt",
"markAchievedTitle": "Doel als behaald markeren?",
"markAchievedDescription": "Dit markeert het doel als voltooid. Je kunt daarna een nieuw doel instellen.",
"markCancelledTitle": "Dit doel annuleren?",
"markCancelledDescription": "Dit annuleert het huidige doel. De voortgang wordt bewaard.",
"markAchieved": "Markeer als behaald",
"markCancelled": "Annuleer doel"
```

**Step 3: Run type check and lint**

```bash
pnpm tsc --noEmit && pnpm lint src/components/reward-chart/
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/components/reward-chart/bottom-cards/next-reward-card.tsx messages/
git commit -m "feat(reward-chart): add goal management to NextRewardCard"
```

---

## Phase 4: Message Management UI

### Task 4.1: Create MessageDialog Component

**Files:**

- Create: `src/components/reward-chart/dialogs/message-dialog.tsx`

**Step 1: Create the dialog component**

Create `src/components/reward-chart/dialogs/message-dialog.tsx`:

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

const messageFormSchema = z.object({
  content: z.string().min(1, "Message is required").max(500),
});

type MessageFormValues = z.infer<typeof messageFormSchema>;

interface MessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (content: string) => Promise<void>;
}

export function MessageDialog({ open, onOpenChange, onSubmit }: MessageDialogProps) {
  const t = useTranslations("rewardChart");

  const form = useForm<MessageFormValues>({
    resolver: zodResolver(messageFormSchema),
    defaultValues: { content: "" },
  });

  const content = form.watch("content");

  const handleSubmit = async (values: MessageFormValues) => {
    await onSubmit(values.content);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("sendMessage")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder={t("messagePlaceholder")}
                      className="min-h-[120px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <FormMessage />
                    <span>{content.length}/500</span>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t("sending") : t("send")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Add translations**

Add to `messages/en.json` under `rewardChart`:

```json
"sendMessage": "Send Message",
"messagePlaceholder": "Write an encouraging message...",
"sending": "Sending...",
"send": "Send"
```

Add to `messages/nl.json` under `rewardChart`:

```json
"sendMessage": "Bericht sturen",
"messagePlaceholder": "Schrijf een aanmoedigend bericht...",
"sending": "Versturen...",
"send": "Versturen"
```

**Step 3: Commit**

```bash
git add src/components/reward-chart/dialogs/message-dialog.tsx messages/
git commit -m "feat(reward-chart): add MessageDialog component"
```

---

### Task 4.2: Add Message Management to MessageCard

**Files:**

- Modify: `src/components/reward-chart/bottom-cards/message-card.tsx`

**Step 1: Add message compose button**

Update `message-card.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { useRewardChart } from "../contexts/reward-chart-context";
import { MessageDialog } from "../dialogs/message-dialog";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function MessageCard() {
  const t = useTranslations("rewardChart");
  const { mode } = useInteractionMode();
  const isManageMode = mode === "manage";
  const { weekData, sendMessage } = useRewardChart();

  const [messageDialogOpen, setMessageDialogOpen] = useState(false);

  const activeMessage = weekData?.chart.messages?.find((m) => m.isActive);

  const handleSendMessage = async (content: string) => {
    try {
      await sendMessage(content);
      toast.success(t("messageSent"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("messageError"));
      throw error;
    }
  };

  if (!weekData) return null;

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          {t("parentMessage")}
        </h3>
        {isManageMode && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setMessageDialogOpen(true)}
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {activeMessage ? (
        <div className="rounded-xl bg-primary/5 p-3">
          <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {activeMessage.content}
          </p>
          {activeMessage.author && (
            <p className="mt-2 text-sm text-muted-foreground">
              — {activeMessage.author.name}
            </p>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-4">
          {t("noMessage")}
        </p>
      )}

      <MessageDialog
        open={messageDialogOpen}
        onOpenChange={setMessageDialogOpen}
        onSubmit={handleSendMessage}
      />
    </div>
  );
}
```

**Step 2: Add translations**

Add to `messages/en.json` under `rewardChart`:

```json
"parentMessage": "Message from Parents",
"noMessage": "No message yet",
"messageSent": "Message sent",
"messageError": "Failed to send message"
```

Add to `messages/nl.json` under `rewardChart`:

```json
"parentMessage": "Bericht van ouders",
"noMessage": "Nog geen bericht",
"messageSent": "Bericht verstuurd",
"messageError": "Bericht versturen mislukt"
```

**Step 3: Run type check and lint**

```bash
pnpm tsc --noEmit && pnpm lint src/components/reward-chart/
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/components/reward-chart/bottom-cards/message-card.tsx messages/
git commit -m "feat(reward-chart): add message management to MessageCard"
```

---

## Phase 5: Chart Selector (Multi-Child Support)

### Task 5.1: Create ChartSelector Component

**Files:**

- Create: `src/components/reward-chart/chart-selector/chart-selector.tsx`
- Create: `src/components/reward-chart/chart-selector/index.ts`

**Step 1: Create the chart selector component**

Create `src/components/reward-chart/chart-selector/chart-selector.tsx`:

```typescript
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FamilyAvatar } from "@/components/family/family-avatar";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface ChartOption {
  memberId: string;
  memberName: string;
  memberAvatar?: string | null;
  chartId: string | null;
  totalStars: number;
}

interface ChartSelectorProps {
  charts: ChartOption[];
  selectedMemberId: string | null;
  onCreateChart: (memberId: string) => void;
}

export function ChartSelector({
  charts,
  selectedMemberId,
  onCreateChart,
}: ChartSelectorProps) {
  const t = useTranslations("rewardChart");
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleSelect = (memberId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("child", memberId);
    router.push(`?${params.toString()}`);
  };

  if (charts.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800 text-center">
        <p className="text-muted-foreground mb-4">{t("noChartsMessage")}</p>
      </div>
    );
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {charts.map((option) => {
        const isSelected = option.memberId === selectedMemberId;
        const hasChart = !!option.chartId;

        return (
          <button
            key={option.memberId}
            onClick={() => hasChart ? handleSelect(option.memberId) : onCreateChart(option.memberId)}
            className={cn(
              "flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm transition-all duration-200",
              "dark:bg-gray-800 hover:scale-[1.02] flex-shrink-0",
              isSelected && "ring-2 ring-primary shadow-primary/20 shadow-lg",
              !hasChart && "border-2 border-dashed border-muted-foreground/25"
            )}
          >
            <FamilyAvatar
              name={option.memberName}
              image={option.memberAvatar}
              size="md"
            />
            <div className="text-left">
              <p className="font-bold text-gray-900 dark:text-white font-lexend">
                {option.memberName}
              </p>
              {hasChart ? (
                <p className="text-sm text-muted-foreground">
                  {option.totalStars} ⭐
                </p>
              ) : (
                <p className="text-sm text-primary flex items-center gap-1">
                  <Plus className="h-3 w-3" />
                  {t("createChart")}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

**Step 2: Create index export**

Create `src/components/reward-chart/chart-selector/index.ts`:

```typescript
export { ChartSelector } from "./chart-selector";
```

**Step 3: Add translations**

Add to `messages/en.json` under `rewardChart`:

```json
"noChartsMessage": "Set up Star Charts for your children",
"createChart": "Create Chart"
```

Add to `messages/nl.json` under `rewardChart`:

```json
"noChartsMessage": "Stel Sterrenkaarten in voor je kinderen",
"createChart": "Kaart maken"
```

**Step 4: Commit**

```bash
git add src/components/reward-chart/chart-selector/ messages/
git commit -m "feat(reward-chart): add ChartSelector component"
```

---

### Task 5.2: Add Chart Creation API Route

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/reward-charts/route.ts`

**Step 1: Verify POST route exists for chart creation**

Check the existing POST route in `reward-charts/route.ts`. If it creates charts correctly (with memberId), no changes needed. If missing, add:

```typescript
// Ensure POST handler creates chart for specific member
const createChartSchema = z.object({
  memberId: z.string().uuid(),
});

export async function POST(request: Request, context: RouteContext) {
  // ... auth and family validation ...

  const body = await request.json();
  const parsed = createChartSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { message: parsed.error.message } },
      { status: 400 }
    );
  }

  // Verify member belongs to family
  const targetMember = await db.query.familyMembers.findFirst({
    where: and(
      eq(familyMembers.id, parsed.data.memberId),
      eq(familyMembers.familyId, familyId)
    ),
  });

  if (!targetMember) {
    return NextResponse.json(
      { success: false, error: { message: "Member not found" } },
      { status: 404 }
    );
  }

  // Check if chart already exists
  const existingChart = await db.query.rewardCharts.findFirst({
    where: and(
      eq(rewardCharts.familyId, familyId),
      eq(rewardCharts.memberId, parsed.data.memberId)
    ),
  });

  if (existingChart) {
    return NextResponse.json(
      { success: false, error: { message: "Chart already exists" } },
      { status: 409 }
    );
  }

  // Create chart
  const [chart] = await db
    .insert(rewardCharts)
    .values({
      id: crypto.randomUUID(),
      familyId,
      memberId: parsed.data.memberId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return NextResponse.json({ success: true, data: { chart } }, { status: 201 });
}
```

**Step 2: Commit if changes made**

```bash
git add src/app/api/v1/families/\[familyId\]/reward-charts/route.ts
git commit -m "feat(reward-chart): add chart creation API route"
```

---

### Task 5.3: Integrate ChartSelector in RewardChartPage

**Files:**

- Modify: `src/components/reward-chart/reward-chart-page.tsx`

**Step 1: Add chart selector and multi-child support**

Update `reward-chart-page.tsx` to include `ChartSelector`:

```typescript
// Add imports
import { ChartSelector } from "./chart-selector";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Inside component, add chart selection logic:
const { mode } = useInteractionMode();
const isManageMode = mode === "manage";
const searchParams = useSearchParams();
const selectedMemberId = searchParams.get("child");

// Add chart creation handler
const handleCreateChart = async (memberId: string) => {
  try {
    const response = await fetch(`/api/v1/families/${familyId}/reward-charts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error?.message || "Failed to create chart");
    }

    toast.success(t("chartCreated"));
    // Refresh to show new chart
    window.location.href = `?child=${memberId}`;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : t("chartError"));
  }
};

// In JSX, add ChartSelector before the grid (only for managers):
{isManageMode && childCharts.length > 1 && (
  <ChartSelector
    charts={childCharts}
    selectedMemberId={selectedMemberId}
    onCreateChart={handleCreateChart}
  />
)}
```

**Step 2: Add translations**

Add to `messages/en.json` under `rewardChart`:

```json
"chartCreated": "Chart created",
"chartError": "Failed to create chart"
```

Add to `messages/nl.json` under `rewardChart`:

```json
"chartCreated": "Kaart aangemaakt",
"chartError": "Kaart aanmaken mislukt"
```

**Step 3: Run type check and lint**

```bash
pnpm tsc --noEmit && pnpm lint src/components/reward-chart/
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/components/reward-chart/reward-chart-page.tsx messages/
git commit -m "feat(reward-chart): integrate ChartSelector in page"
```

---

## Phase 6: Dialog Index & Final Integration

### Task 6.1: Create Dialogs Index Export

**Files:**

- Create: `src/components/reward-chart/dialogs/index.ts`

**Step 1: Create barrel export**

Create `src/components/reward-chart/dialogs/index.ts`:

```typescript
export { TaskDialog } from "./task-dialog";
export { GoalDialog } from "./goal-dialog";
export { MessageDialog } from "./message-dialog";
```

**Step 2: Update main index**

Update `src/components/reward-chart/index.ts` to export dialogs:

```typescript
export * from "./dialogs";
export * from "./chart-selector";
// ... existing exports
```

**Step 3: Commit**

```bash
git add src/components/reward-chart/dialogs/index.ts src/components/reward-chart/index.ts
git commit -m "feat(reward-chart): add dialog exports"
```

---

### Task 6.2: Final Type Check and Lint

**Step 1: Run full type check**

```bash
pnpm tsc --noEmit
```

Expected: No errors

**Step 2: Run full lint**

```bash
pnpm lint
```

Expected: No errors (or only pre-existing warnings)

**Step 3: Run build**

```bash
pnpm build
```

Expected: Build succeeds

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(reward-chart): complete management interface implementation"
```

---

## Testing Checklist

After implementation, manually verify:

1. **Task Management**
   - [ ] Add task dialog opens from dashed row in manage mode
   - [ ] Edit task dialog opens from pencil button
   - [ ] Delete task works with confirmation
   - [ ] Drag-and-drop reorders tasks
   - [ ] Tasks persist after refresh

2. **Goal Management**
   - [ ] Set goal button appears when no active goal
   - [ ] Edit goal dialog opens from pencil button
   - [ ] Mark achieved/cancelled works
   - [ ] Progress updates correctly

3. **Message Management**
   - [ ] Compose button opens message dialog
   - [ ] Character counter works
   - [ ] Message appears in card after send

4. **Chart Selector**
   - [ ] Shows all children for managers
   - [ ] URL updates on selection
   - [ ] Create chart works for children without charts

5. **Permissions**
   - [ ] Edit controls only visible in manage mode
   - [ ] Non-managers cannot see management UI
   - [ ] API rejects unauthorized mutations

---

## Summary

**Total Tasks:** 14 implementation tasks across 6 phases

**Files Created:**

- `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/tasks/[taskId]/route.ts`
- `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/tasks/reorder/route.ts`
- `src/app/api/v1/families/[familyId]/reward-charts/[chartId]/goals/[goalId]/route.ts`
- `src/components/reward-chart/dialogs/task-dialog.tsx`
- `src/components/reward-chart/dialogs/goal-dialog.tsx`
- `src/components/reward-chart/dialogs/message-dialog.tsx`
- `src/components/reward-chart/dialogs/index.ts`
- `src/components/reward-chart/weekly-grid/add-task-row.tsx`
- `src/components/reward-chart/chart-selector/chart-selector.tsx`
- `src/components/reward-chart/chart-selector/index.ts`

**Files Modified:**

- `src/components/reward-chart/contexts/reward-chart-context.tsx`
- `src/components/reward-chart/interfaces.ts`
- `src/components/reward-chart/weekly-grid/task-row.tsx`
- `src/components/reward-chart/weekly-grid/weekly-grid.tsx`
- `src/components/reward-chart/weekly-grid/index.ts`
- `src/components/reward-chart/bottom-cards/next-reward-card.tsx`
- `src/components/reward-chart/bottom-cards/message-card.tsx`
- `src/components/reward-chart/reward-chart-page.tsx`
- `src/components/reward-chart/index.ts`
- `messages/en.json`
- `messages/nl.json`
