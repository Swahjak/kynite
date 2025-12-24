# Timer Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement timer functionality with templates, active timers, rewards integration, and multi-device sync.

**Architecture:** Two-table design with `timer_templates` (reusable definitions) and `active_timers` (running instances). Services follow existing patterns (star-service, chore-service). Device ownership model with 60s sync polling.

**Tech Stack:** Drizzle ORM, Next.js API routes, React Query, Zod validation, existing star-service integration.

---

## Phase 1: Database Schema

> **Parallel execution:** Task 1.1 and 1.2 can run in parallel.

### Task 1.1: Create Timer Templates Table

**Files:**

- Modify: `src/server/schema.ts`

**Step 1: Add timer_templates table after chores section**

Add to `src/server/schema.ts` after the Chores section (around line 243):

```typescript
// ============================================================================
// Timers
// ============================================================================

/**
 * Timer Templates table - Reusable timer definitions
 */
export const timerTemplates = pgTable("timer_templates", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("chore"), // "screen" | "chore" | "activity"
  durationSeconds: integer("duration_seconds").notNull(),
  starReward: integer("star_reward").notNull().default(0),
  controlMode: text("control_mode").notNull().default("anyone"), // "parents_only" | "anyone"
  alertMode: text("alert_mode").notNull().default("completion"), // "none" | "completion" | "escalating"
  cooldownSeconds: integer("cooldown_seconds"), // time to confirm for reward
  showAsQuickAction: boolean("show_as_quick_action").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 2: Add relations for timer_templates**

Add after `choresRelations`:

```typescript
export const timerTemplatesRelations = relations(timerTemplates, ({ one }) => ({
  family: one(families, {
    fields: [timerTemplates.familyId],
    references: [families.id],
  }),
}));
```

**Step 3: Add type exports**

Add to type exports section:

```typescript
export type TimerTemplate = typeof timerTemplates.$inferSelect;
export type NewTimerTemplate = typeof timerTemplates.$inferInsert;
```

**Step 4: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/server/schema.ts
git commit -m "feat(timer): add timer_templates table schema"
```

---

### Task 1.2: Create Active Timers Table

**Files:**

- Modify: `src/server/schema.ts`

**Step 1: Add active_timers table after timer_templates**

```typescript
/**
 * Active Timers table - Running timer instances
 */
export const activeTimers = pgTable("active_timers", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  templateId: text("template_id").references(() => timerTemplates.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  assignedToId: text("assigned_to_id").references(() => familyMembers.id, {
    onDelete: "set null",
  }),
  category: text("category").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  starReward: integer("star_reward").notNull().default(0),
  alertMode: text("alert_mode").notNull(),
  cooldownSeconds: integer("cooldown_seconds"),
  status: text("status").notNull().default("running"), // "running" | "paused" | "completed" | "expired" | "cancelled"
  remainingSeconds: integer("remaining_seconds").notNull(),
  startedAt: timestamp("started_at", { mode: "date" }).notNull(),
  pausedAt: timestamp("paused_at", { mode: "date" }),
  completedAt: timestamp("completed_at", { mode: "date" }),
  startedById: text("started_by_id").references(() => familyMembers.id, {
    onDelete: "set null",
  }),
  confirmedById: text("confirmed_by_id").references(() => familyMembers.id, {
    onDelete: "set null",
  }),
  ownerDeviceId: text("owner_device_id"),
  lastSyncAt: timestamp("last_sync_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 2: Add relations for active_timers**

```typescript
export const activeTimersRelations = relations(activeTimers, ({ one }) => ({
  family: one(families, {
    fields: [activeTimers.familyId],
    references: [families.id],
  }),
  template: one(timerTemplates, {
    fields: [activeTimers.templateId],
    references: [timerTemplates.id],
  }),
  assignedTo: one(familyMembers, {
    fields: [activeTimers.assignedToId],
    references: [familyMembers.id],
    relationName: "assignedTimers",
  }),
  startedBy: one(familyMembers, {
    fields: [activeTimers.startedById],
    references: [familyMembers.id],
    relationName: "startedTimers",
  }),
  confirmedBy: one(familyMembers, {
    fields: [activeTimers.confirmedById],
    references: [familyMembers.id],
    relationName: "confirmedTimers",
  }),
}));
```

**Step 3: Add type exports**

```typescript
export type ActiveTimer = typeof activeTimers.$inferSelect;
export type NewActiveTimer = typeof activeTimers.$inferInsert;
```

**Step 4: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/server/schema.ts
git commit -m "feat(timer): add active_timers table schema"
```

---

### Task 1.3: Generate and Run Migration

**Files:**

- Create: `drizzle/XXXX_*.sql` (auto-generated)

**Step 1: Generate migration**

Run: `pnpm db:generate`
Expected: Migration file created in `drizzle/` directory

**Step 2: Review generated migration**

Verify the SQL creates both tables with correct columns and constraints.

**Step 3: Run migration**

Run: `pnpm db:push`
Expected: Tables created successfully

**Step 4: Commit migration**

```bash
git add drizzle/
git commit -m "feat(timer): add database migration for timer tables"
```

---

## Phase 2: Validation Schemas

> **Parallel execution:** Task 2.1 can run in parallel with Phase 1 after schema types are defined.

### Task 2.1: Create Timer Validation Schemas

**Files:**

- Create: `src/lib/validations/timer.ts`

**Step 1: Create validation file**

```typescript
import { z } from "zod";

// =============================================================================
// ENUMS
// =============================================================================

export const timerCategorySchema = z.enum(["screen", "chore", "activity"]);
export const timerControlModeSchema = z.enum(["parents_only", "anyone"]);
export const timerAlertModeSchema = z.enum([
  "none",
  "completion",
  "escalating",
]);
export const timerStatusSchema = z.enum([
  "running",
  "paused",
  "completed",
  "expired",
  "cancelled",
]);

export type TimerCategory = z.infer<typeof timerCategorySchema>;
export type TimerControlMode = z.infer<typeof timerControlModeSchema>;
export type TimerAlertMode = z.infer<typeof timerAlertModeSchema>;
export type TimerStatus = z.infer<typeof timerStatusSchema>;

// =============================================================================
// TEMPLATE SCHEMAS
// =============================================================================

export const createTimerTemplateSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: timerCategorySchema.default("chore"),
  durationSeconds: z.number().int().min(30).max(86400), // 30s to 24h
  starReward: z.number().int().min(0).max(1000).default(0),
  controlMode: timerControlModeSchema.default("anyone"),
  alertMode: timerAlertModeSchema.default("completion"),
  cooldownSeconds: z.number().int().min(0).max(3600).optional(), // up to 1h
  showAsQuickAction: z.boolean().default(false),
});

export const updateTimerTemplateSchema = createTimerTemplateSchema.partial();

export type CreateTimerTemplateInput = z.infer<
  typeof createTimerTemplateSchema
>;
export type UpdateTimerTemplateInput = z.infer<
  typeof updateTimerTemplateSchema
>;

// =============================================================================
// ACTIVE TIMER SCHEMAS
// =============================================================================

export const startTimerFromTemplateSchema = z.object({
  templateId: z.string().min(1),
  assignedToId: z.string().min(1),
  deviceId: z.string().min(1),
});

export const startOneOffTimerSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: timerCategorySchema.default("chore"),
  durationSeconds: z.number().int().min(30).max(86400),
  starReward: z.number().int().min(0).max(1000).default(0),
  alertMode: timerAlertModeSchema.default("completion"),
  cooldownSeconds: z.number().int().min(0).max(3600).optional(),
  assignedToId: z.string().min(1),
  deviceId: z.string().min(1),
});

export const syncTimerSchema = z.object({
  remainingSeconds: z.number().int().min(0),
  deviceId: z.string().min(1),
});

export const extendTimerSchema = z.object({
  seconds: z.number().int().min(60).max(3600), // 1min to 1h
});

export const confirmTimerSchema = z.object({
  confirmedById: z.string().min(1),
});

export type StartTimerFromTemplateInput = z.infer<
  typeof startTimerFromTemplateSchema
>;
export type StartOneOffTimerInput = z.infer<typeof startOneOffTimerSchema>;
export type SyncTimerInput = z.infer<typeof syncTimerSchema>;
export type ExtendTimerInput = z.infer<typeof extendTimerSchema>;
export type ConfirmTimerInput = z.infer<typeof confirmTimerSchema>;
```

**Step 2: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/validations/timer.ts
git commit -m "feat(timer): add Zod validation schemas"
```

---

## Phase 3: Backend Services

> **Parallel execution:** Task 3.1 and 3.2 can run in parallel.

### Task 3.1: Create Timer Template Service

**Files:**

- Create: `src/server/services/timer-template-service.ts`

**Step 1: Create service file**

```typescript
import { db } from "@/server/db";
import { timerTemplates } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type {
  CreateTimerTemplateInput,
  UpdateTimerTemplateInput,
} from "@/lib/validations/timer";
import type { TimerTemplate } from "@/server/schema";

// =============================================================================
// QUERY OPERATIONS
// =============================================================================

/**
 * Get all timer templates for a family
 */
export async function getTemplatesForFamily(
  familyId: string
): Promise<TimerTemplate[]> {
  return await db
    .select()
    .from(timerTemplates)
    .where(
      and(
        eq(timerTemplates.familyId, familyId),
        eq(timerTemplates.isActive, true)
      )
    );
}

/**
 * Get quick action templates for a family
 */
export async function getQuickActionTemplates(
  familyId: string
): Promise<TimerTemplate[]> {
  return await db
    .select()
    .from(timerTemplates)
    .where(
      and(
        eq(timerTemplates.familyId, familyId),
        eq(timerTemplates.isActive, true),
        eq(timerTemplates.showAsQuickAction, true)
      )
    );
}

/**
 * Get a single template by ID
 */
export async function getTemplateById(
  templateId: string,
  familyId: string
): Promise<TimerTemplate | null> {
  const results = await db
    .select()
    .from(timerTemplates)
    .where(
      and(
        eq(timerTemplates.id, templateId),
        eq(timerTemplates.familyId, familyId)
      )
    )
    .limit(1);

  return results[0] ?? null;
}

// =============================================================================
// MUTATION OPERATIONS
// =============================================================================

/**
 * Create a new timer template
 */
export async function createTemplate(
  familyId: string,
  input: CreateTimerTemplateInput
): Promise<TimerTemplate> {
  const templateId = createId();
  const now = new Date();

  const [template] = await db
    .insert(timerTemplates)
    .values({
      id: templateId,
      familyId,
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      durationSeconds: input.durationSeconds,
      starReward: input.starReward,
      controlMode: input.controlMode,
      alertMode: input.alertMode,
      cooldownSeconds: input.cooldownSeconds ?? null,
      showAsQuickAction: input.showAsQuickAction,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return template;
}

/**
 * Update an existing timer template
 */
export async function updateTemplate(
  templateId: string,
  familyId: string,
  input: UpdateTimerTemplateInput
): Promise<TimerTemplate> {
  const existing = await getTemplateById(templateId, familyId);
  if (!existing) throw new Error("Template not found");

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.category !== undefined) updates.category = input.category;
  if (input.durationSeconds !== undefined)
    updates.durationSeconds = input.durationSeconds;
  if (input.starReward !== undefined) updates.starReward = input.starReward;
  if (input.controlMode !== undefined) updates.controlMode = input.controlMode;
  if (input.alertMode !== undefined) updates.alertMode = input.alertMode;
  if (input.cooldownSeconds !== undefined)
    updates.cooldownSeconds = input.cooldownSeconds;
  if (input.showAsQuickAction !== undefined)
    updates.showAsQuickAction = input.showAsQuickAction;

  const [template] = await db
    .update(timerTemplates)
    .set(updates)
    .where(eq(timerTemplates.id, templateId))
    .returning();

  return template;
}

/**
 * Soft delete a timer template
 */
export async function deleteTemplate(
  templateId: string,
  familyId: string
): Promise<void> {
  const existing = await getTemplateById(templateId, familyId);
  if (!existing) throw new Error("Template not found");

  await db
    .update(timerTemplates)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(timerTemplates.id, templateId));
}
```

**Step 2: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/timer-template-service.ts
git commit -m "feat(timer): add timer template service"
```

---

### Task 3.2: Create Active Timer Service

**Files:**

- Create: `src/server/services/active-timer-service.ts`

**Step 1: Create service file**

```typescript
import { db } from "@/server/db";
import { activeTimers, timerTemplates, familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { addStars } from "./star-service";
import type {
  StartTimerFromTemplateInput,
  StartOneOffTimerInput,
  SyncTimerInput,
  ExtendTimerInput,
  ConfirmTimerInput,
} from "@/lib/validations/timer";
import type { ActiveTimer } from "@/server/schema";

// =============================================================================
// QUERY OPERATIONS
// =============================================================================

/**
 * Get all active timers for a family
 */
export async function getActiveTimersForFamily(
  familyId: string
): Promise<ActiveTimer[]> {
  return await db
    .select()
    .from(activeTimers)
    .where(
      and(
        eq(activeTimers.familyId, familyId),
        eq(activeTimers.status, "running")
      )
    );
}

/**
 * Get all timers for a family (including paused)
 */
export async function getAllTimersForFamily(
  familyId: string
): Promise<ActiveTimer[]> {
  return await db
    .select()
    .from(activeTimers)
    .where(eq(activeTimers.familyId, familyId));
}

/**
 * Get a single timer by ID
 */
export async function getTimerById(
  timerId: string,
  familyId: string
): Promise<ActiveTimer | null> {
  const results = await db
    .select()
    .from(activeTimers)
    .where(
      and(eq(activeTimers.id, timerId), eq(activeTimers.familyId, familyId))
    )
    .limit(1);

  return results[0] ?? null;
}

// =============================================================================
// START OPERATIONS
// =============================================================================

/**
 * Start a timer from a template
 */
export async function startTimerFromTemplate(
  familyId: string,
  input: StartTimerFromTemplateInput
): Promise<ActiveTimer> {
  // Get template
  const template = await db
    .select()
    .from(timerTemplates)
    .where(
      and(
        eq(timerTemplates.id, input.templateId),
        eq(timerTemplates.familyId, familyId)
      )
    )
    .limit(1);

  if (template.length === 0) throw new Error("Template not found");
  const t = template[0];

  const timerId = createId();
  const now = new Date();

  const [timer] = await db
    .insert(activeTimers)
    .values({
      id: timerId,
      familyId,
      templateId: t.id,
      title: t.title,
      description: t.description,
      assignedToId: input.assignedToId,
      category: t.category,
      durationSeconds: t.durationSeconds,
      starReward: t.starReward,
      alertMode: t.alertMode,
      cooldownSeconds: t.cooldownSeconds,
      status: "running",
      remainingSeconds: t.durationSeconds,
      startedAt: now,
      startedById: input.assignedToId, // Could be different, but using assignee for now
      ownerDeviceId: input.deviceId,
      lastSyncAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return timer;
}

/**
 * Start a one-off timer
 */
export async function startOneOffTimer(
  familyId: string,
  input: StartOneOffTimerInput
): Promise<ActiveTimer> {
  const timerId = createId();
  const now = new Date();

  const [timer] = await db
    .insert(activeTimers)
    .values({
      id: timerId,
      familyId,
      templateId: null,
      title: input.title,
      description: input.description ?? null,
      assignedToId: input.assignedToId,
      category: input.category,
      durationSeconds: input.durationSeconds,
      starReward: input.starReward,
      alertMode: input.alertMode,
      cooldownSeconds: input.cooldownSeconds ?? null,
      status: "running",
      remainingSeconds: input.durationSeconds,
      startedAt: now,
      startedById: input.assignedToId,
      ownerDeviceId: input.deviceId,
      lastSyncAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return timer;
}

// =============================================================================
// CONTROL OPERATIONS
// =============================================================================

/**
 * Pause a running timer
 */
export async function pauseTimer(
  timerId: string,
  familyId: string,
  deviceId: string
): Promise<ActiveTimer> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) throw new Error("Timer not found");
  if (timer.status !== "running") throw new Error("Timer is not running");
  if (timer.ownerDeviceId !== deviceId) throw new Error("Not the owner device");

  const [updated] = await db
    .update(activeTimers)
    .set({
      status: "paused",
      pausedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId))
    .returning();

  return updated;
}

/**
 * Resume a paused timer
 */
export async function resumeTimer(
  timerId: string,
  familyId: string,
  deviceId: string
): Promise<ActiveTimer> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) throw new Error("Timer not found");
  if (timer.status !== "paused") throw new Error("Timer is not paused");
  if (timer.ownerDeviceId !== deviceId) throw new Error("Not the owner device");

  const [updated] = await db
    .update(activeTimers)
    .set({
      status: "running",
      pausedAt: null,
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId))
    .returning();

  return updated;
}

/**
 * Extend a timer's duration
 */
export async function extendTimer(
  timerId: string,
  familyId: string,
  input: ExtendTimerInput
): Promise<ActiveTimer> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) throw new Error("Timer not found");
  if (timer.status === "completed" || timer.status === "cancelled") {
    throw new Error("Cannot extend a finished timer");
  }

  const [updated] = await db
    .update(activeTimers)
    .set({
      remainingSeconds: timer.remainingSeconds + input.seconds,
      durationSeconds: timer.durationSeconds + input.seconds,
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId))
    .returning();

  return updated;
}

/**
 * Cancel a timer
 */
export async function cancelTimer(
  timerId: string,
  familyId: string
): Promise<void> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) throw new Error("Timer not found");

  await db
    .update(activeTimers)
    .set({
      status: "cancelled",
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId));
}

// =============================================================================
// SYNC OPERATIONS
// =============================================================================

/**
 * Sync timer state from owner device
 */
export async function syncTimerState(
  timerId: string,
  familyId: string,
  input: SyncTimerInput
): Promise<ActiveTimer> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) throw new Error("Timer not found");
  if (timer.ownerDeviceId !== input.deviceId)
    throw new Error("Not the owner device");

  const updates: Record<string, unknown> = {
    remainingSeconds: input.remainingSeconds,
    lastSyncAt: new Date(),
    updatedAt: new Date(),
  };

  // If timer reached zero, mark as waiting for confirmation or completed
  if (input.remainingSeconds <= 0 && timer.status === "running") {
    if (timer.cooldownSeconds && timer.cooldownSeconds > 0) {
      // Has cooldown - wait for confirmation
      updates.status = "expired";
      updates.completedAt = new Date();
    } else {
      // No cooldown - just complete
      updates.status = "completed";
      updates.completedAt = new Date();
    }
  }

  const [updated] = await db
    .update(activeTimers)
    .set(updates)
    .where(eq(activeTimers.id, timerId))
    .returning();

  return updated;
}

/**
 * Claim an orphaned timer
 */
export async function claimOrphanedTimer(
  timerId: string,
  familyId: string,
  deviceId: string
): Promise<ActiveTimer | null> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) return null;
  if (timer.status !== "running" && timer.status !== "paused") return null;

  // Check if orphaned (no sync in 60+ seconds)
  const orphanThreshold = new Date(Date.now() - 60000);
  if (timer.lastSyncAt && timer.lastSyncAt > orphanThreshold) {
    return null; // Not orphaned
  }

  const [updated] = await db
    .update(activeTimers)
    .set({
      ownerDeviceId: deviceId,
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId))
    .returning();

  return updated;
}

// =============================================================================
// COMPLETION OPERATIONS
// =============================================================================

/**
 * Confirm timer completion (for reward)
 */
export async function confirmTimer(
  timerId: string,
  familyId: string,
  input: ConfirmTimerInput
): Promise<{ timer: ActiveTimer; starsAwarded: number }> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) throw new Error("Timer not found");
  if (timer.status !== "expired") {
    throw new Error("Timer is not awaiting confirmation");
  }

  // Check if within cooldown period
  if (timer.completedAt && timer.cooldownSeconds) {
    const cooldownEnd = new Date(
      timer.completedAt.getTime() + timer.cooldownSeconds * 1000
    );
    if (new Date() > cooldownEnd) {
      throw new Error("Confirmation period has expired");
    }
  }

  const [updated] = await db
    .update(activeTimers)
    .set({
      status: "completed",
      confirmedById: input.confirmedById,
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId))
    .returning();

  // Award stars if applicable
  let starsAwarded = 0;
  if (timer.starReward > 0 && timer.assignedToId) {
    await addStars({
      memberId: timer.assignedToId,
      amount: timer.starReward,
      type: "timer",
      referenceId: timerId,
      description: timer.title,
    });
    starsAwarded = timer.starReward;
  }

  return { timer: updated, starsAwarded };
}

/**
 * Complete timer without reward (missed cooldown)
 */
export async function expireTimer(
  timerId: string,
  familyId: string
): Promise<ActiveTimer> {
  const timer = await getTimerById(timerId, familyId);
  if (!timer) throw new Error("Timer not found");

  const [updated] = await db
    .update(activeTimers)
    .set({
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId))
    .returning();

  return updated;
}
```

**Step 2: Update star-service transaction type**

In `src/lib/validations/star.ts`, add "timer" to the transaction type if not already present:

```typescript
type: z.enum(["reward_chart", "chore", "bonus", "redemption", "timer"]),
```

**Step 3: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/services/active-timer-service.ts src/lib/validations/star.ts
git commit -m "feat(timer): add active timer service with star integration"
```

---

### Task 3.3: Create Service Tests

**Files:**

- Create: `src/server/services/__tests__/timer-template-service.test.ts`
- Create: `src/server/services/__tests__/active-timer-service.test.ts`

**Step 1: Create template service tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as timerTemplateService from "../timer-template-service";

// Mock database
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([
      {
        id: "test-id",
        familyId: "family-1",
        title: "Test Timer",
        category: "chore",
        durationSeconds: 900,
        starReward: 5,
        controlMode: "anyone",
        alertMode: "completion",
        showAsQuickAction: false,
        isActive: true,
      },
    ]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

describe("timer-template-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTemplate", () => {
    it("creates a new timer template", async () => {
      const result = await timerTemplateService.createTemplate("family-1", {
        title: "Test Timer",
        category: "chore",
        durationSeconds: 900,
        starReward: 5,
      });

      expect(result).toBeDefined();
      expect(result.title).toBe("Test Timer");
    });
  });
});
```

**Step 2: Run tests**

Run: `pnpm test:run src/server/services/__tests__/timer-template-service.test.ts`
Expected: Tests pass

**Step 3: Commit**

```bash
git add src/server/services/__tests__/
git commit -m "test(timer): add timer service unit tests"
```

---

## Phase 4: API Routes

> **Parallel execution:** Task 4.1 and 4.2 can run in parallel.

### Task 4.1: Create Template API Routes

**Files:**

- Create: `src/app/api/v1/timers/templates/route.ts`
- Create: `src/app/api/v1/timers/templates/[id]/route.ts`

**Step 1: Create templates list/create route**

Create `src/app/api/v1/timers/templates/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import {
  getTemplatesForFamily,
  createTemplate,
} from "@/server/services/timer-template-service";
import { createTimerTemplateSchema } from "@/lib/validations/timer";

// GET /api/v1/timers/templates
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    // Get user's family
    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "No family found" },
        },
        { status: 404 }
      );
    }

    const templates = await getTemplatesForFamily(members[0].familyId);

    return NextResponse.json({ success: true, data: { templates } });
  } catch (error) {
    console.error("Error fetching timer templates:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch templates" },
      },
      { status: 500 }
    );
  }
}

// POST /api/v1/timers/templates
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "No family found" },
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = createTimerTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        },
        { status: 400 }
      );
    }

    const template = await createTemplate(members[0].familyId, parsed.data);

    return NextResponse.json(
      { success: true, data: { template } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating timer template:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create template" },
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Create template PATCH/DELETE route**

Create `src/app/api/v1/timers/templates/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import {
  getTemplateById,
  updateTemplate,
  deleteTemplate,
} from "@/server/services/timer-template-service";
import { updateTimerTemplateSchema } from "@/lib/validations/timer";

type Params = Promise<{ id: string }>;

// GET /api/v1/timers/templates/[id]
export async function GET(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "No family found" },
        },
        { status: 404 }
      );
    }

    const template = await getTemplateById(id, members[0].familyId);

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Template not found" },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { template } });
  } catch (error) {
    console.error("Error fetching timer template:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch template" },
      },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/timers/templates/[id]
export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "No family found" },
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = updateTimerTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        },
        { status: 400 }
      );
    }

    const template = await updateTemplate(id, members[0].familyId, parsed.data);

    return NextResponse.json({ success: true, data: { template } });
  } catch (error) {
    console.error("Error updating timer template:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to update template" },
      },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/timers/templates/[id]
export async function DELETE(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "No family found" },
        },
        { status: 404 }
      );
    }

    await deleteTemplate(id, members[0].familyId);

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    console.error("Error deleting timer template:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to delete template" },
      },
      { status: 500 }
    );
  }
}
```

**Step 3: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/v1/timers/
git commit -m "feat(timer): add timer template API routes"
```

---

### Task 4.2: Create Active Timer API Routes

**Files:**

- Create: `src/app/api/v1/timers/active/route.ts`
- Create: `src/app/api/v1/timers/active/[id]/route.ts`
- Create: `src/app/api/v1/timers/active/[id]/confirm/route.ts`

**Step 1: Create active timers list/create route**

Create `src/app/api/v1/timers/active/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import {
  getActiveTimersForFamily,
  startTimerFromTemplate,
  startOneOffTimer,
} from "@/server/services/active-timer-service";
import {
  startTimerFromTemplateSchema,
  startOneOffTimerSchema,
} from "@/lib/validations/timer";

// GET /api/v1/timers/active
export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "No family found" },
        },
        { status: 404 }
      );
    }

    const timers = await getActiveTimersForFamily(members[0].familyId);

    return NextResponse.json({ success: true, data: { timers } });
  } catch (error) {
    console.error("Error fetching active timers:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch timers" },
      },
      { status: 500 }
    );
  }
}

// POST /api/v1/timers/active
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "No family found" },
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const familyId = members[0].familyId;

    // Try template-based first
    const templateParsed = startTimerFromTemplateSchema.safeParse(body);
    if (templateParsed.success) {
      const timer = await startTimerFromTemplate(familyId, templateParsed.data);
      return NextResponse.json(
        { success: true, data: { timer } },
        { status: 201 }
      );
    }

    // Try one-off timer
    const oneOffParsed = startOneOffTimerSchema.safeParse(body);
    if (oneOffParsed.success) {
      const timer = await startOneOffTimer(familyId, oneOffParsed.data);
      return NextResponse.json(
        { success: true, data: { timer } },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid timer data" },
      },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error starting timer:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to start timer" },
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Create active timer operations route**

Create `src/app/api/v1/timers/active/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import {
  getTimerById,
  pauseTimer,
  resumeTimer,
  extendTimer,
  cancelTimer,
  syncTimerState,
} from "@/server/services/active-timer-service";
import { syncTimerSchema, extendTimerSchema } from "@/lib/validations/timer";

type Params = Promise<{ id: string }>;

// GET /api/v1/timers/active/[id]
export async function GET(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "No family found" },
        },
        { status: 404 }
      );
    }

    const timer = await getTimerById(id, members[0].familyId);

    if (!timer) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Timer not found" },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { timer } });
  } catch (error) {
    console.error("Error fetching timer:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch timer" },
      },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/timers/active/[id]
// Supports: pause, resume, extend, sync
export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "No family found" },
        },
        { status: 404 }
      );
    }

    const familyId = members[0].familyId;
    const body = await request.json();
    const { action, deviceId, ...data } = body;

    let timer;

    switch (action) {
      case "pause":
        timer = await pauseTimer(id, familyId, deviceId);
        break;
      case "resume":
        timer = await resumeTimer(id, familyId, deviceId);
        break;
      case "extend":
        const extendParsed = extendTimerSchema.safeParse(data);
        if (!extendParsed.success) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "VALIDATION_ERROR",
                message: "Invalid extend data",
              },
            },
            { status: 400 }
          );
        }
        timer = await extendTimer(id, familyId, extendParsed.data);
        break;
      case "sync":
        const syncParsed = syncTimerSchema.safeParse({ ...data, deviceId });
        if (!syncParsed.success) {
          return NextResponse.json(
            {
              success: false,
              error: { code: "VALIDATION_ERROR", message: "Invalid sync data" },
            },
            { status: 400 }
          );
        }
        timer = await syncTimerState(id, familyId, syncParsed.data);
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            error: { code: "BAD_REQUEST", message: "Unknown action" },
          },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, data: { timer } });
  } catch (error) {
    console.error("Error updating timer:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update timer";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/timers/active/[id]
export async function DELETE(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "No family found" },
        },
        { status: 404 }
      );
    }

    await cancelTimer(id, members[0].familyId);

    return NextResponse.json({ success: true, data: null });
  } catch (error) {
    console.error("Error cancelling timer:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to cancel timer" },
      },
      { status: 500 }
    );
  }
}
```

**Step 3: Create confirm endpoint**

Create `src/app/api/v1/timers/active/[id]/confirm/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq } from "drizzle-orm";
import { confirmTimer } from "@/server/services/active-timer-service";
import { confirmTimerSchema } from "@/lib/validations/timer";

type Params = Promise<{ id: string }>;

// POST /api/v1/timers/active/[id]/confirm
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { id } = await params;
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const members = await db
      .select()
      .from(familyMembers)
      .where(eq(familyMembers.userId, session.user.id))
      .limit(1);

    if (members.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "No family found" },
        },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = confirmTimerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: parsed.error.message },
        },
        { status: 400 }
      );
    }

    const result = await confirmTimer(id, members[0].familyId, parsed.data);

    return NextResponse.json({
      success: true,
      data: { timer: result.timer, starsAwarded: result.starsAwarded },
    });
  } catch (error) {
    console.error("Error confirming timer:", error);
    const message =
      error instanceof Error ? error.message : "Failed to confirm timer";
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
```

**Step 4: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/api/v1/timers/
git commit -m "feat(timer): add active timer API routes"
```

---

## Phase 5: Timer Management Page

### Task 5.1: Create Timers Page

**Files:**

- Create: `src/app/[locale]/(app)/timers/page.tsx`
- Create: `src/components/timers/timers-page.tsx`
- Create: `src/components/timers/timer-template-card.tsx`
- Create: `src/components/timers/timer-template-form.tsx`

**Step 1: Create page route**

Create `src/app/[locale]/(app)/timers/page.tsx`:

```typescript
import { TimersPage } from "@/components/timers/timers-page";

export default function Page() {
  return <TimersPage />;
}
```

**Step 2: Create TimersPage component**

Create `src/components/timers/timers-page.tsx`:

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { TimerTemplateCard } from "./timer-template-card";
import { TimerTemplateForm } from "./timer-template-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TimerTemplate } from "@/server/schema";

async function fetchTemplates(): Promise<TimerTemplate[]> {
  const res = await fetch("/api/v1/timers/templates");
  const data = await res.json();
  if (!data.success) throw new Error(data.error.message);
  return data.data.templates;
}

export function TimersPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TimerTemplate | null>(null);

  const { data: templates = [], refetch } = useQuery({
    queryKey: ["timerTemplates"],
    queryFn: fetchTemplates,
  });

  const handleCreateSuccess = () => {
    setIsCreateOpen(false);
    refetch();
  };

  const handleEditSuccess = () => {
    setEditingTemplate(null);
    refetch();
  };

  const handleDelete = async (templateId: string) => {
    await fetch(`/api/v1/timers/templates/${templateId}`, { method: "DELETE" });
    refetch();
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Timers</h1>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Timer
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <TimerTemplateCard
            key={template.id}
            template={template}
            onEdit={() => setEditingTemplate(template)}
            onDelete={() => handleDelete(template.id)}
          />
        ))}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No timer templates yet. Create one to get started!
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Timer Template</DialogTitle>
          </DialogHeader>
          <TimerTemplateForm onSuccess={handleCreateSuccess} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Timer Template</DialogTitle>
          </DialogHeader>
          {editingTemplate && (
            <TimerTemplateForm
              template={editingTemplate}
              onSuccess={handleEditSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Step 3: Create TimerTemplateCard component**

Create `src/components/timers/timer-template-card.tsx`:

```typescript
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Zap, Star } from "lucide-react";
import type { TimerTemplate } from "@/server/schema";

interface TimerTemplateCardProps {
  template: TimerTemplate;
  onEdit: () => void;
  onDelete: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

const categoryEmoji: Record<string, string> = {
  screen: "📺",
  chore: "🧹",
  activity: "📚",
};

export function TimerTemplateCard({
  template,
  onEdit,
  onDelete,
}: TimerTemplateCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg font-medium">
          {categoryEmoji[template.category] || "⏱"} {template.title}
        </CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span>{formatDuration(template.durationSeconds)}</span>
          {template.starReward > 0 && (
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3" />
              {template.starReward}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">{template.alertMode} alert</Badge>
          <Badge variant="secondary">{template.controlMode.replace("_", " ")}</Badge>
          {template.showAsQuickAction && (
            <Badge variant="default" className="flex items-center gap-1">
              <Zap className="h-3 w-3" /> Quick
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Create TimerTemplateForm component**

Create `src/components/timers/timer-template-form.tsx`:

```typescript
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTimerTemplateSchema,
  type CreateTimerTemplateInput,
} from "@/lib/validations/timer";
import type { TimerTemplate } from "@/server/schema";

interface TimerTemplateFormProps {
  template?: TimerTemplate;
  onSuccess: () => void;
}

export function TimerTemplateForm({ template, onSuccess }: TimerTemplateFormProps) {
  const isEditing = !!template;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateTimerTemplateInput>({
    resolver: zodResolver(createTimerTemplateSchema),
    defaultValues: template
      ? {
          title: template.title,
          description: template.description ?? undefined,
          category: template.category as "screen" | "chore" | "activity",
          durationSeconds: template.durationSeconds,
          starReward: template.starReward,
          controlMode: template.controlMode as "parents_only" | "anyone",
          alertMode: template.alertMode as "none" | "completion" | "escalating",
          cooldownSeconds: template.cooldownSeconds ?? undefined,
          showAsQuickAction: template.showAsQuickAction,
        }
      : {
          category: "chore",
          durationSeconds: 900, // 15 min
          starReward: 0,
          controlMode: "anyone",
          alertMode: "completion",
          showAsQuickAction: false,
        },
  });

  const onSubmit = async (data: CreateTimerTemplateInput) => {
    const url = isEditing
      ? `/api/v1/timers/templates/${template.id}`
      : "/api/v1/timers/templates";
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      onSuccess();
    }
  };

  const category = watch("category");
  const showAsQuickAction = watch("showAsQuickAction");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...register("title")} placeholder="Screen time" />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Select
          value={category}
          onValueChange={(v) => setValue("category", v as "screen" | "chore" | "activity")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="screen">📺 Screen</SelectItem>
            <SelectItem value="chore">🧹 Chore</SelectItem>
            <SelectItem value="activity">📚 Activity</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="durationSeconds">Duration (minutes)</Label>
          <Input
            id="durationSeconds"
            type="number"
            min={1}
            {...register("durationSeconds", {
              setValueAs: (v) => parseInt(v) * 60,
            })}
            defaultValue={template ? template.durationSeconds / 60 : 15}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="starReward">Stars</Label>
          <Input
            id="starReward"
            type="number"
            min={0}
            {...register("starReward", { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="alertMode">Alert Mode</Label>
        <Select
          value={watch("alertMode")}
          onValueChange={(v) =>
            setValue("alertMode", v as "none" | "completion" | "escalating")
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="completion">Completion</SelectItem>
            <SelectItem value="escalating">Escalating</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="showAsQuickAction"
          checked={showAsQuickAction}
          onCheckedChange={(v) => setValue("showAsQuickAction", v)}
        />
        <Label htmlFor="showAsQuickAction">Show as quick action on dashboard</Label>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : isEditing ? "Update" : "Create"}
      </Button>
    </form>
  );
}
```

**Step 5: Verify no TypeScript errors**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 6: Add translations**

Add to `messages/nl.json` and `messages/en.json`:

```json
{
  "timers": {
    "title": "Timers",
    "newTimer": "Nieuwe timer",
    "noTimers": "Nog geen timer templates. Maak er een om te beginnen!"
  }
}
```

**Step 7: Commit**

```bash
git add src/app/[locale]/(app)/timers/ src/components/timers/ messages/
git commit -m "feat(timer): add timer management page"
```

---

## Phase 6: Dashboard Integration

> **Parallel execution:** Task 6.1, 6.2, and 6.3 can run in parallel.

### Task 6.1: Update Dashboard Types

**Files:**

- Modify: `src/components/dashboard/types.ts`

**Step 1: Update Timer interface**

Replace the existing Timer interface with an expanded version:

```typescript
export interface Timer {
  id: string;
  title: string;
  subtitle: string;
  remainingSeconds: number;
  totalSeconds: number;
  category: string;
  status: "running" | "paused" | "completed" | "expired" | "cancelled";
  starReward: number;
  alertMode: "none" | "completion" | "escalating";
  cooldownSeconds: number | null;
  assignedToId: string | null;
  ownerDeviceId: string | null;
}
```

**Step 2: Commit**

```bash
git add src/components/dashboard/types.ts
git commit -m "feat(timer): update dashboard Timer type"
```

---

### Task 6.2: Update Dashboard Context

**Files:**

- Modify: `src/components/dashboard/contexts/dashboard-context.tsx`

**Step 1: Replace mock timer logic with real API calls**

Add to dashboard context:

```typescript
// Add to imports
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Add device ID generation
const getDeviceId = () => {
  if (typeof window === "undefined") return "";
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("deviceId", deviceId);
  }
  return deviceId;
};

// Replace mock timer functions with:
const { data: timers = [] } = useQuery({
  queryKey: ["activeTimers"],
  queryFn: async () => {
    const res = await fetch("/api/v1/timers/active");
    const data = await res.json();
    return data.success ? data.data.timers : [];
  },
  refetchInterval: 60000, // 60s polling
});

const extendTimerMutation = useMutation({
  mutationFn: async ({
    timerId,
    seconds,
  }: {
    timerId: string;
    seconds: number;
  }) => {
    await fetch(`/api/v1/timers/active/${timerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "extend", seconds }),
    });
  },
  onSuccess: () =>
    queryClient.invalidateQueries({ queryKey: ["activeTimers"] }),
});

const pauseTimer = (timerId: string) => {
  const deviceId = getDeviceId();
  fetch(`/api/v1/timers/active/${timerId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "pause", deviceId }),
  }).then(() => queryClient.invalidateQueries({ queryKey: ["activeTimers"] }));
};

const extendTimer = (timerId: string, seconds: number) => {
  extendTimerMutation.mutate({ timerId, seconds });
};
```

**Step 2: Commit**

```bash
git add src/components/dashboard/contexts/dashboard-context.tsx
git commit -m "feat(timer): integrate real timer API in dashboard context"
```

---

### Task 6.3: Add Countdown Logic

**Files:**

- Create: `src/hooks/use-timer-countdown.ts`
- Modify: `src/components/dashboard/active-timers/timer-card.tsx`

**Step 1: Create countdown hook**

Create `src/hooks/use-timer-countdown.ts`:

```typescript
import { useState, useEffect, useCallback } from "react";

interface UseTimerCountdownOptions {
  initialSeconds: number;
  isOwner: boolean;
  isRunning: boolean;
  timerId: string;
  onComplete?: () => void;
  onSync?: (remainingSeconds: number) => void;
}

export function useTimerCountdown({
  initialSeconds,
  isOwner,
  isRunning,
  timerId,
  onComplete,
  onSync,
}: UseTimerCountdownOptions) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const [lastSync, setLastSync] = useState(Date.now());

  // Update remaining when initialSeconds changes (from server)
  useEffect(() => {
    setRemaining(initialSeconds);
  }, [initialSeconds]);

  // Countdown logic (owner only)
  useEffect(() => {
    if (!isOwner || !isRunning) return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });

      // Sync every 60 seconds
      if (Date.now() - lastSync >= 60000) {
        setLastSync(Date.now());
        onSync?.(remaining - 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isOwner, isRunning, onComplete, onSync, remaining, lastSync]);

  return { remaining };
}
```

**Step 2: Update timer card to use countdown**

Modify `src/components/dashboard/active-timers/timer-card.tsx` to use the hook.

**Step 3: Commit**

```bash
git add src/hooks/use-timer-countdown.ts src/components/dashboard/active-timers/
git commit -m "feat(timer): add real-time countdown logic"
```

---

## Phase 7: Final Integration

### Task 7.1: Add Navigation Link

**Files:**

- Modify: `src/components/layout/navigation-menu.tsx` (or similar)

**Step 1: Add Timers link to navigation**

Add timer icon and link to the navigation menu.

**Step 2: Commit**

```bash
git add src/components/layout/
git commit -m "feat(timer): add timers link to navigation"
```

---

### Task 7.2: Run Full Test Suite

**Step 1: Run all tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Run linter**

Run: `pnpm lint`
Expected: No errors

---

### Task 7.3: Final Commit and PR

**Step 1: Ensure all changes committed**

Run: `git status`
Expected: Clean working directory

**Step 2: Push branch**

```bash
git push -u origin feature/timer
```

**Step 3: Create PR**

Use `gh pr create` with summary of all changes.

---

## Parallel Execution Summary

| Phase   | Tasks         | Can Run In Parallel  |
| ------- | ------------- | -------------------- |
| Phase 1 | 1.1, 1.2      | Yes                  |
| Phase 1 | 1.3           | Depends on 1.1+1.2   |
| Phase 2 | 2.1           | Can run with Phase 1 |
| Phase 3 | 3.1, 3.2      | Yes                  |
| Phase 3 | 3.3           | Depends on 3.1+3.2   |
| Phase 4 | 4.1, 4.2      | Yes                  |
| Phase 5 | 5.1           | Depends on Phase 4   |
| Phase 6 | 6.1, 6.2, 6.3 | Yes                  |
| Phase 7 | 7.1, 7.2, 7.3 | Sequential           |

**Optimal execution with 3 agents:**

- Agent A: 1.1 → 1.3 → 3.1 → 4.1 → 5.1
- Agent B: 1.2 → 2.1 → 3.2 → 4.2 → 6.2
- Agent C: 3.3 → 6.1 → 6.3 → 7.1 → 7.2 → 7.3
