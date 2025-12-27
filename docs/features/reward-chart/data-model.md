# Reward Chart Data Model

## Overview

The Reward Chart feature requires five primary entities: charts (per-child configuration), tasks (recurring routines), completions (daily tracking), goals (rewards to earn), and messages (parent encouragement). Stars earned feed into the existing Star Transaction system from the Reward Store.

## Database Schema

### reward_charts

Per-child chart configuration linking a family member to their goals.

```typescript
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
```

| Column       | Type      | Description                           |
| ------------ | --------- | ------------------------------------- |
| `id`         | text      | Primary key (CUID)                    |
| `family_id`  | text      | FK to `families.id`                   |
| `member_id`  | text      | FK to `family_members.id` (the child) |
| `is_active`  | boolean   | Whether chart is enabled              |
| `created_at` | timestamp | Creation date                         |
| `updated_at` | timestamp | Last modification                     |

### reward_chart_tasks

Recurring tasks assigned to a chart.

```typescript
export const rewardChartTasks = pgTable("reward_chart_tasks", {
  id: text("id").primaryKey(),
  chartId: text("chart_id")
    .notNull()
    .references(() => rewardCharts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  icon: text("icon").notNull(), // Material symbol name
  iconColor: text("icon_color").notNull(), // Color key: blue, emerald, purple, etc.
  starValue: integer("star_value").notNull().default(1),
  daysOfWeek: text("days_of_week").notNull(), // JSON array: [0,1,2,3,4,5,6]
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

| Column         | Type      | Description                              |
| -------------- | --------- | ---------------------------------------- |
| `id`           | text      | Primary key                              |
| `chart_id`     | text      | FK to `reward_charts.id`                 |
| `title`        | text      | Task name (e.g., "Brush Teeth AM")       |
| `icon`         | text      | Material symbol (e.g., "dentistry")      |
| `icon_color`   | text      | Color key (e.g., "blue", "emerald")      |
| `star_value`   | integer   | Stars earned per completion (default: 1) |
| `days_of_week` | text      | JSON array of active days (0=Sun, 6=Sat) |
| `sort_order`   | integer   | Display order in grid                    |
| `is_active`    | boolean   | Whether task appears on chart            |
| `created_at`   | timestamp | Creation date                            |

### reward_chart_completions

Daily completion records for each task.

```typescript
export const rewardChartCompletions = pgTable("reward_chart_completions", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => rewardChartTasks.id, { onDelete: "cascade" }),
  date: date("date").notNull(),
  status: text("status").notNull(), // 'completed' | 'missed' | 'skipped'
  completedAt: timestamp("completed_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

| Column         | Type      | Description                           |
| -------------- | --------- | ------------------------------------- |
| `id`           | text      | Primary key                           |
| `task_id`      | text      | FK to `reward_chart_tasks.id`         |
| `date`         | date      | The specific day                      |
| `status`       | text      | Completion state                      |
| `completed_at` | timestamp | When marked complete (null if missed) |
| `created_at`   | timestamp | Record creation                       |

### reward_chart_goals

Goals that children work toward.

```typescript
export const rewardChartGoals = pgTable("reward_chart_goals", {
  id: text("id").primaryKey(),
  chartId: text("chart_id")
    .notNull()
    .references(() => rewardCharts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  emoji: text("emoji").notNull(), // Display emoji
  starTarget: integer("star_target").notNull(),
  starsCurrent: integer("stars_current").notNull().default(0),
  status: text("status").notNull().default("active"), // 'active' | 'achieved' | 'cancelled'
  achievedAt: timestamp("achieved_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

| Column          | Type      | Description                         |
| --------------- | --------- | ----------------------------------- |
| `id`            | text      | Primary key                         |
| `chart_id`      | text      | FK to `reward_charts.id`            |
| `title`         | text      | Goal name (e.g., "Trip to the Zoo") |
| `description`   | text      | Optional details                    |
| `emoji`         | text      | Display emoji (e.g., "🦁")          |
| `star_target`   | integer   | Stars needed to achieve             |
| `stars_current` | integer   | Stars accumulated toward goal       |
| `status`        | text      | Goal state                          |
| `achieved_at`   | timestamp | When goal was reached               |
| `created_at`    | timestamp | Creation date                       |
| `updated_at`    | timestamp | Last modification                   |

### reward_chart_messages

Encouragement messages from parents.

```typescript
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
```

| Column       | Type      | Description                        |
| ------------ | --------- | ---------------------------------- |
| `id`         | text      | Primary key                        |
| `chart_id`   | text      | FK to `reward_charts.id`           |
| `content`    | text      | Message text                       |
| `author_id`  | text      | FK to `family_members.id` (parent) |
| `is_active`  | boolean   | Whether message is displayed       |
| `created_at` | timestamp | When sent                          |

## TypeScript Interfaces

Located in `src/components/reward-chart/interfaces.ts`:

```typescript
// Core types
type CompletionStatus = "completed" | "missed" | "skipped";
type GoalStatus = "active" | "achieved" | "cancelled";
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sun=0, Sat=6
type CellStatus =
  | "completed"
  | "pending"
  | "missed"
  | "future"
  | "not_applicable";

// Chart configuration (returned by getChartWithDetails)
interface IRewardChart {
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

// Task definition
interface IRewardChartTask {
  id: string;
  chartId: string;
  title: string;
  icon: string; // Lucide icon key (e.g., "smile", "bed")
  iconColor: string; // Color key (e.g., "blue", "emerald")
  starValue: number;
  daysOfWeek: DayOfWeek[]; // Parsed from JSON stored in DB
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
}

// Daily completion record
interface IRewardChartCompletion {
  id: string;
  taskId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  status: CompletionStatus;
  completedAt: Date | null;
  createdAt: Date;
}

// Goal progress
interface IRewardChartGoal {
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

// Parent message
interface IRewardChartMessage {
  id: string;
  chartId: string;
  content: string;
  authorId: string;
  author?: FamilyMember | null;
  isActive: boolean;
  createdAt: Date;
}

// API response types
interface GoalProgress {
  starsCurrent: number;
  starTarget: number;
  progressPercent: number;
  achieved?: boolean;
}

interface CompleteTaskResponse {
  completion: IRewardChartCompletion;
  goalProgress: GoalProgress | null;
  starsEarned: number;
}

interface UndoCompletionResponse {
  goalProgress: GoalProgress | null;
  starsRemoved: number;
}
```

## View Models

### WeeklyChartData

Data structure for rendering the weekly grid. Returned by `/reward-charts/{chartId}/week` endpoint.

```typescript
interface WeeklyChartData {
  chart: IRewardChart;
  weekStart: string; // ISO date "YYYY-MM-DD" (Monday)
  weekEnd: string; // ISO date "YYYY-MM-DD" (Sunday)
  days: WeekDay[];
  tasks: TaskRow[];
  todayStats: TodayStats;
}

interface WeekDay {
  date: string; // ISO date "YYYY-MM-DD"
  dayOfWeek: DayOfWeek;
  dayName: string; // "Mon", "Tue", etc.
  dayNumber: number; // 12, 13, etc.
  isToday: boolean;
  isWeekend: boolean;
}

interface TaskRow {
  task: IRewardChartTask;
  cells: TaskCell[];
}

interface TaskCell {
  date: string; // ISO date "YYYY-MM-DD"
  status: CellStatus;
  completion: IRewardChartCompletion | null;
  isApplicable: boolean; // Based on task's daysOfWeek
}

type CellStatus =
  | "completed" // Star earned
  | "pending" // Can be completed (today only)
  | "missed" // Past day, not completed
  | "future" // Future day
  | "not_applicable"; // Task not scheduled for this day

interface TodayStats {
  completed: number;
  total: number;
}

// Additional view model for child selection
interface ChildChartInfo {
  id: string; // memberId
  name: string; // displayName
  avatarUrl?: string | null;
  avatarColor?: string | null;
  avatarSvg?: string | null;
  chartId: string | null;
  totalStars: number;
}
```

## Data Relationships

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Reward Chart System                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────┐     ┌─────────────────┐     ┌──────────────────┐   │
│  │  families  │     │ family_members  │     │     users        │   │
│  │    (FK)    │◄────│      (FK)       │────►│   (Better-Auth)  │   │
│  └─────┬──────┘     └────────┬────────┘     └──────────────────┘   │
│        │                     │                                       │
│        │                     │                                       │
│        ▼                     ▼                                       │
│  ┌─────────────────────────────────┐                                │
│  │         reward_charts           │                                │
│  │  (one per child)                │                                │
│  └──────────────┬──────────────────┘                                │
│                 │                                                    │
│    ┌────────────┼────────────┬────────────┐                        │
│    │            │            │            │                        │
│    ▼            ▼            ▼            ▼                        │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐           │
│ │  tasks   │ │  goals   │ │ messages │ │              │           │
│ └────┬─────┘ └──────────┘ └──────────┘ └──────────────┘           │
│      │                                                              │
│      ▼                                                              │
│ ┌────────────────┐                                                  │
│ │  completions   │                                                  │
│ │  (per day)     │                                                  │
│ └────────────────┘                                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## API Endpoints

All endpoints are under `/api/v1/families/{familyId}/reward-charts`.

### Chart Operations

| Endpoint                        | Method | Description                                   | Access        |
| ------------------------------- | ------ | --------------------------------------------- | ------------- |
| `/reward-charts`                | GET    | List all charts for family (with active goal) | Family member |
| `/reward-charts`                | POST   | Create chart for a member                     | Manager only  |
| `/reward-charts/{chartId}`      | GET    | Get chart with details                        | Family member |
| `/reward-charts/{chartId}/week` | GET    | Get weekly grid data with completions         | Family member |

### Task Operations

| Endpoint                                           | Method | Description                  | Access        |
| -------------------------------------------------- | ------ | ---------------------------- | ------------- |
| `/reward-charts/{chartId}/tasks`                   | POST   | Create new task              | Manager only  |
| `/reward-charts/{chartId}/tasks/{taskId}`          | PUT    | Update task                  | Manager only  |
| `/reward-charts/{chartId}/tasks/{taskId}`          | DELETE | Delete task (soft delete)    | Manager only  |
| `/reward-charts/{chartId}/tasks/reorder`           | POST   | Reorder tasks (drag-drop)    | Manager only  |
| `/reward-charts/{chartId}/tasks/{taskId}/complete` | POST   | Mark task complete for today | Family member |
| `/reward-charts/{chartId}/tasks/{taskId}/undo`     | POST   | Undo completion for today    | Family member |

### Goal Operations

| Endpoint                                  | Method | Description     | Access        |
| ----------------------------------------- | ------ | --------------- | ------------- |
| `/reward-charts/{chartId}/goals`          | GET    | List all goals  | Family member |
| `/reward-charts/{chartId}/goals`          | POST   | Create new goal | Manager only  |
| `/reward-charts/{chartId}/goals/{goalId}` | PUT    | Update goal     | Manager only  |

### Message Operations

| Endpoint                            | Method | Description        | Access        |
| ----------------------------------- | ------ | ------------------ | ------------- |
| `/reward-charts/{chartId}/messages` | GET    | Get active message | Family member |
| `/reward-charts/{chartId}/messages` | POST   | Send new message   | Manager only  |

### POST .../tasks/{taskId}/complete

**Request:** No body needed (uses current date automatically)

**Response:**

```json
{
  "success": true,
  "data": {
    "completion": {
      "id": "comp_abc123",
      "taskId": "task_456",
      "date": "2024-12-13",
      "status": "completed",
      "completedAt": "2024-12-13T10:30:00Z",
      "createdAt": "2024-12-13T10:30:00Z"
    },
    "goalProgress": {
      "starsCurrent": 25,
      "starTarget": 30,
      "progressPercent": 83,
      "achieved": false
    },
    "starsEarned": 1
  }
}
```

### POST .../tasks/{taskId}/undo

**Request:** No body needed (uses current date automatically)

**Response:**

```json
{
  "success": true,
  "data": {
    "goalProgress": {
      "starsCurrent": 24,
      "starTarget": 30,
      "progressPercent": 80
    },
    "starsRemoved": 1
  }
}
```

### POST .../tasks/reorder

Reorders tasks via drag-and-drop. Updates `sortOrder` for all tasks.

**Request:**

```json
{
  "taskIds": ["task_1", "task_3", "task_2", "task_4"]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "taskIds": ["task_1", "task_3", "task_2", "task_4"]
  }
}
```

## Data Sources

| Data               | Source     | Refresh Rate               |
| ------------------ | ---------- | -------------------------- |
| Chart config       | PostgreSQL | On mount                   |
| Weekly completions | PostgreSQL | On mount, after completion |
| Goal progress      | PostgreSQL | After completion           |
| Messages           | PostgreSQL | On mount                   |
| Today stats        | Computed   | Real-time                  |

## Star Integration

When a task is completed, the service performs these operations atomically in a transaction:

1. Creates a completion record with status "completed"
2. Calls `addStars()` to record a Star Transaction (type: `reward_chart`)
3. Updates the member's cached star balance in `member_star_balances`
4. Updates the active goal's `stars_current` if one exists
5. Broadcasts real-time update via Pusher (`stars:updated` event)

When a task completion is undone:

1. Deletes the completion record
2. Calls `addStars()` with negative amount to reverse the transaction
3. Updates the cached balance and active goal accordingly
4. Broadcasts real-time update

### Star Transaction Types

The `type` field in `star_transactions` supports these values:

| Type           | Source                       | Amount   |
| -------------- | ---------------------------- | -------- |
| `reward_chart` | Reward chart task completion | Positive |
| `chore`        | Chore completion             | Positive |
| `bonus`        | Manual bonus from parent     | Positive |
| `timer`        | Timer completion             | Positive |
| `redemption`   | Reward store purchase        | Negative |

### Implementation Reference

```typescript
// In reward-chart-service.ts completeTask()
await addStars({
  memberId: chart.memberId,
  amount: task.starValue,
  type: "reward_chart",
  referenceId: completion.id,
  description: task.title,
});

// In reward-chart-service.ts undoCompletion()
await addStars({
  memberId: chart.memberId,
  amount: -task.starValue, // Negative reverses the transaction
  type: "reward_chart",
  referenceId: existing[0].id,
  description: `Undo: ${task.title}`,
});
```

### Real-time Updates

Star balance changes are broadcast to all family members via Pusher:

```typescript
broadcastToFamily(familyId, "stars:updated", {
  memberId: input.memberId,
  newBalance,
});
```
