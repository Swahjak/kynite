# Timers Data Model

## Overview

The Timers feature uses two primary tables: `timer_templates` for reusable timer definitions, and `active_timers` for running timer instances. Star rewards integrate with the existing Star Transaction system from the Reward Store feature.

## Database Schema

### timer_templates

Reusable timer definitions that families can start with one tap.

```typescript
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

| Column                 | Type      | Description                                         |
| ---------------------- | --------- | --------------------------------------------------- |
| `id`                   | text      | Primary key (CUID)                                  |
| `family_id`            | text      | FK to `families.id`                                 |
| `title`                | text      | Timer name (e.g., "Screen Time", "Homework")        |
| `description`          | text      | Optional details                                    |
| `category`             | text      | Timer category for grouping                         |
| `duration_seconds`     | integer   | Default duration (30s - 86400s / 24h)               |
| `star_reward`          | integer   | Stars earned on completion (0-1000)                 |
| `control_mode`         | text      | Who can control: `anyone` or `parents_only`         |
| `alert_mode`           | text      | Alert behavior on completion                        |
| `cooldown_seconds`     | integer   | Confirmation window after completion (0-3600s / 1h) |
| `show_as_quick_action` | boolean   | Display as quick action on dashboard                |
| `is_active`            | boolean   | Soft delete flag                                    |
| `created_at`           | timestamp | Creation date                                       |
| `updated_at`           | timestamp | Last modification                                   |

### active_timers

Running timer instances with real-time countdown state.

```typescript
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

| Column              | Type      | Description                                   |
| ------------------- | --------- | --------------------------------------------- |
| `id`                | text      | Primary key (CUID)                            |
| `family_id`         | text      | FK to `families.id`                           |
| `template_id`       | text      | FK to `timer_templates.id` (null for one-off) |
| `title`             | text      | Timer name (copied from template or custom)   |
| `description`       | text      | Optional details                              |
| `assigned_to_id`    | text      | FK to `family_members.id` who earns stars     |
| `category`          | text      | Timer category                                |
| `duration_seconds`  | integer   | Total duration                                |
| `star_reward`       | integer   | Stars to award on completion                  |
| `alert_mode`        | text      | Alert behavior                                |
| `cooldown_seconds`  | integer   | Confirmation window duration                  |
| `status`            | text      | Current timer state                           |
| `remaining_seconds` | integer   | Time left (decremented by owner device)       |
| `started_at`        | timestamp | When timer was started                        |
| `paused_at`         | timestamp | When timer was paused (null if running)       |
| `completed_at`      | timestamp | When timer finished (reached zero)            |
| `started_by_id`     | text      | FK to member who started timer                |
| `confirmed_by_id`   | text      | FK to member who confirmed completion         |
| `owner_device_id`   | text      | Device ID running the countdown               |
| `last_sync_at`      | timestamp | Last state sync from owner device             |
| `created_at`        | timestamp | Record creation                               |
| `updated_at`        | timestamp | Last modification                             |

## TypeScript Interfaces

```typescript
// Enums
type TimerCategory = "screen" | "chore" | "activity";
type TimerControlMode = "parents_only" | "anyone";
type TimerAlertMode = "none" | "completion" | "escalating";
type TimerStatus = "running" | "paused" | "completed" | "expired" | "cancelled";

// Timer template (reusable definition)
interface ITimerTemplate {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  category: TimerCategory;
  durationSeconds: number;
  starReward: number;
  controlMode: TimerControlMode;
  alertMode: TimerAlertMode;
  cooldownSeconds?: number;
  showAsQuickAction: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Active timer (running instance)
interface IActiveTimer {
  id: string;
  familyId: string;
  templateId?: string;
  title: string;
  description?: string;
  assignedToId?: string;
  assignedTo?: IFamilyMember;
  category: TimerCategory;
  durationSeconds: number;
  starReward: number;
  alertMode: TimerAlertMode;
  cooldownSeconds?: number;
  status: TimerStatus;
  remainingSeconds: number;
  startedAt: Date;
  pausedAt?: Date;
  completedAt?: Date;
  startedById?: string;
  confirmedById?: string;
  ownerDeviceId?: string;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Family member reference
interface IFamilyMember {
  id: string;
  familyId: string;
  userId: string;
  role: "manager" | "participant" | "caregiver";
  displayName: string | null;
  avatarColor: string | null;
}
```

## Input Validation Schemas

```typescript
// Create timer template
const createTimerTemplateSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.enum(["screen", "chore", "activity"]).default("chore"),
  durationSeconds: z.number().int().min(30).max(86400), // 30s to 24h
  starReward: z.number().int().min(0).max(1000).default(0),
  controlMode: z.enum(["parents_only", "anyone"]).default("anyone"),
  alertMode: z.enum(["none", "completion", "escalating"]).default("completion"),
  cooldownSeconds: z.number().int().min(0).max(3600).optional(), // up to 1h
  showAsQuickAction: z.boolean().default(false),
});

// Start timer from template
const startTimerFromTemplateSchema = z.object({
  templateId: z.string().min(1),
  assignedToId: z.string().min(1),
  deviceId: z.string().min(1),
});

// Start one-off timer
const startOneOffTimerSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.enum(["screen", "chore", "activity"]).default("chore"),
  durationSeconds: z.number().int().min(30).max(86400),
  starReward: z.number().int().min(0).max(1000).default(0),
  alertMode: z.enum(["none", "completion", "escalating"]).default("completion"),
  cooldownSeconds: z.number().int().min(0).max(3600).optional(),
  assignedToId: z.string().min(1),
  deviceId: z.string().min(1),
});

// Sync timer state
const syncTimerSchema = z.object({
  remainingSeconds: z.number().int().min(0),
  deviceId: z.string().min(1),
});

// Extend timer duration
const extendTimerSchema = z.object({
  seconds: z.number().int().min(60).max(3600), // 1min to 1h
});

// Confirm timer completion
const confirmTimerSchema = z.object({
  confirmedById: z.string().min(1),
});
```

## API Endpoints

### Timer Templates

| Endpoint                       | Method | Description                   |
| ------------------------------ | ------ | ----------------------------- |
| `/api/v1/timers/templates`     | GET    | List all templates for family |
| `/api/v1/timers/templates`     | POST   | Create new template           |
| `/api/v1/timers/templates/:id` | GET    | Get single template           |
| `/api/v1/timers/templates/:id` | PATCH  | Update template               |
| `/api/v1/timers/templates/:id` | DELETE | Soft delete template          |

### Active Timers

| Endpoint                            | Method | Description                                                  |
| ----------------------------------- | ------ | ------------------------------------------------------------ |
| `/api/v1/timers/active`             | GET    | List active timers (running/paused/expired)                  |
| `/api/v1/timers/active`             | POST   | Start timer (from template or one-off)                       |
| `/api/v1/timers/active/:id`         | GET    | Get single timer                                             |
| `/api/v1/timers/active/:id`         | PATCH  | Control timer (pause/resume/extend/sync/dismiss/acknowledge) |
| `/api/v1/timers/active/:id`         | DELETE | Cancel timer                                                 |
| `/api/v1/timers/active/:id/confirm` | POST   | Confirm completion (for cooldown timers)                     |

### PATCH Actions

The `PATCH /api/v1/timers/active/:id` endpoint supports multiple actions via the `action` field:

| Action        | Required Fields                | Description                                  |
| ------------- | ------------------------------ | -------------------------------------------- |
| `pause`       | `deviceId`                     | Pause running timer (owner only)             |
| `resume`      | `deviceId`                     | Resume paused timer (owner only)             |
| `extend`      | `seconds`                      | Add time to timer (1-60 min)                 |
| `sync`        | `deviceId`, `remainingSeconds` | Sync countdown state from owner              |
| `dismiss`     | -                              | Dismiss expired timer without reward         |
| `acknowledge` | -                              | Complete timer and award stars (no cooldown) |

### Example Requests

**Start timer from template:**

```json
POST /api/v1/timers/active
{
  "templateId": "tmpl_abc123",
  "assignedToId": "mem_xyz789",
  "deviceId": "dev_123456"
}
```

**Pause timer:**

```json
PATCH /api/v1/timers/active/timer_abc123
{
  "action": "pause",
  "deviceId": "dev_123456"
}
```

**Confirm completion:**

```json
POST /api/v1/timers/active/timer_abc123/confirm
{
  "confirmedById": "mem_parent123"
}
```

## Data Relationships

```
+-----------------------------------------------------------------------+
|                          Timers System                                  |
+-----------------------------------------------------------------------+
|                                                                         |
|  +------------+     +------------------+     +-------------------+     |
|  |  families  |     |  family_members  |     |      users        |     |
|  |    (FK)    |<----|       (FK)       |---->|   (Better-Auth)   |     |
|  +-----+------+     +--------+---------+     +-------------------+     |
|        |                     |                                          |
|        |                     |                                          |
|        v                     v                                          |
|  +---------------------+  +-------------------+                        |
|  |  timer_templates    |  | (assigned_to_id)  |                        |
|  |  (reusable defs)    |  | (started_by_id)   |                        |
|  +----------+----------+  | (confirmed_by_id) |                        |
|             |             +-------------------+                        |
|             |                    ^                                      |
|             v                    |                                      |
|  +------------------------------+                                      |
|  |      active_timers           |                                      |
|  |  (running instances)         |                                      |
|  +------------------------------+                                      |
|             |                                                           |
|             v                                                           |
|  +------------------------------+                                      |
|  |    star_transactions         |                                      |
|  |    (type: 'timer')           |                                      |
|  +------------------------------+                                      |
|                                                                         |
+-----------------------------------------------------------------------+
```

## Data Sources

| Data          | Source     | Refresh Rate                    |
| ------------- | ---------- | ------------------------------- |
| Templates     | PostgreSQL | On mount                        |
| Active timers | PostgreSQL | On mount, real-time via Pusher  |
| Countdown     | Client     | Owner device decrements locally |
| Sync state    | PostgreSQL | Every 60 seconds from owner     |

## Star Integration

When a timer completes and is confirmed (or acknowledged if no cooldown), stars are awarded:

```typescript
// On timer confirmation
async function confirmTimer(
  timerId: string,
  familyId: string,
  input: ConfirmTimerInput
) {
  const timer = await getTimerById(timerId, familyId);

  // Update timer status
  await db
    .update(activeTimers)
    .set({
      status: "completed",
      confirmedById: input.confirmedById,
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId));

  // Award stars if applicable
  if (timer.starReward > 0 && timer.assignedToId) {
    await addStars({
      memberId: timer.assignedToId,
      amount: timer.starReward,
      type: "timer",
      referenceId: timerId,
      description: timer.title,
    });
  }

  // Broadcast completion
  broadcastToFamily(familyId, "timer:completed", {
    timer: updatedTimer,
    starsAwarded: timer.starReward,
  });
}
```

## Device Ownership

Each active timer has an `ownerDeviceId` that identifies which device is running the countdown:

1. **Starting device becomes owner**: The device that starts a timer becomes the owner
2. **Owner runs countdown**: Only the owner device decrements `remainingSeconds`
3. **Periodic sync**: Owner syncs state to server every 60 seconds
4. **Orphan detection**: If `lastSyncAt` is older than 60 seconds, timer is considered orphaned
5. **Orphan recovery**: Any device can claim an orphaned timer and become the new owner

```typescript
// Claim orphaned timer
async function claimOrphanedTimer(
  timerId: string,
  familyId: string,
  deviceId: string
) {
  const timer = await getTimerById(timerId, familyId);

  // Check if orphaned (no sync in 60+ seconds)
  const orphanThreshold = new Date(Date.now() - 60000);
  if (timer.lastSyncAt && timer.lastSyncAt > orphanThreshold) {
    return null; // Not orphaned
  }

  // Claim ownership
  return await db
    .update(activeTimers)
    .set({
      ownerDeviceId: deviceId,
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(activeTimers.id, timerId))
    .returning();
}
```
