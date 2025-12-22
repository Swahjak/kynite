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

```typescript
// Core types
type CompletionStatus = "completed" | "missed" | "skipped";
type GoalStatus = "active" | "achieved" | "cancelled";
type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Sun=0, Sat=6

// Chart configuration
interface IRewardChart {
  id: string;
  familyId: string;
  memberId: string;
  member: IFamilyMember;
  isActive: boolean;
  tasks: IRewardChartTask[];
  activeGoal: IRewardChartGoal | null;
  currentMessage: IRewardChartMessage | null;
}

// Task definition
interface IRewardChartTask {
  id: string;
  chartId: string;
  title: string;
  icon: string;
  iconColor: string;
  starValue: number;
  daysOfWeek: DayOfWeek[];
  sortOrder: number;
  isActive: boolean;
}

// Daily completion record
interface IRewardChartCompletion {
  id: string;
  taskId: string;
  date: string; // ISO date string
  status: CompletionStatus;
  completedAt: Date | null;
}

// Goal progress
interface IRewardChartGoal {
  id: string;
  chartId: string;
  title: string;
  description?: string;
  emoji: string;
  starTarget: number;
  starsCurrent: number;
  status: GoalStatus;
  achievedAt: Date | null;
  progressPercent: number; // Computed: (current / target) * 100
}

// Parent message
interface IRewardChartMessage {
  id: string;
  chartId: string;
  content: string;
  authorId: string;
  author: IFamilyMember;
  isActive: boolean;
  createdAt: Date;
}

// Family member (from families feature)
interface IFamilyMember {
  id: string;
  familyId: string;
  userId: string;
  role: "manager" | "participant" | "caregiver";
  displayName: string | null;
  avatarColor: string | null;
}
```

## View Models

### WeeklyChartData

Data structure for rendering the weekly grid.

```typescript
interface WeeklyChartData {
  chart: IRewardChart;
  weekStart: Date; // Monday of current week
  weekEnd: Date; // Sunday of current week
  days: WeekDay[];
  tasks: TaskRow[];
  todayStats: TodayStats;
}

interface WeekDay {
  date: Date;
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
  date: Date;
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

| Endpoint                                             | Method | Description                     |
| ---------------------------------------------------- | ------ | ------------------------------- |
| `/api/reward-charts/:memberId`                       | GET    | Fetch chart for a family member |
| `/api/reward-charts/:chartId/week`                   | GET    | Fetch weekly grid data          |
| `/api/reward-charts/:chartId/tasks/:taskId/complete` | POST   | Mark task complete for today    |
| `/api/reward-charts/:chartId/tasks/:taskId/undo`     | POST   | Undo completion for today       |
| `/api/reward-charts/:chartId/goals`                  | GET    | Fetch all goals for chart       |
| `/api/reward-charts/:chartId/messages`               | GET    | Fetch active message            |

### POST /api/reward-charts/:chartId/tasks/:taskId/complete

**Request:** (no body needed, uses current date)

**Response:**

```json
{
  "success": true,
  "completion": {
    "id": "comp_123",
    "taskId": "task_456",
    "date": "2024-12-13",
    "status": "completed",
    "completedAt": "2024-12-13T10:30:00Z"
  },
  "goalProgress": {
    "starsCurrent": 25,
    "starTarget": 30,
    "progressPercent": 83
  },
  "todayStats": {
    "completed": 2,
    "total": 5
  }
}
```

### POST /api/reward-charts/:chartId/tasks/:taskId/undo

**Request:** (no body needed, uses current date)

**Response:**

```json
{
  "success": true,
  "completion": null,
  "goalProgress": {
    "starsCurrent": 24,
    "starTarget": 30,
    "progressPercent": 80
  },
  "todayStats": {
    "completed": 1,
    "total": 5
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

When a task is completed, stars are automatically:

1. Added to the active goal's `stars_current`
2. Recorded as a Star Transaction (type: `reward_chart`)

```typescript
// On task completion
async function completeTask(taskId: string, chartId: string) {
  const task = await getTask(taskId);
  const chart = await getChart(chartId);
  const goal = await getActiveGoal(chartId);

  // Create completion record
  const completion = await createCompletion({
    taskId,
    date: today(),
    status: "completed",
    completedAt: new Date(),
  });

  // Update goal progress
  if (goal) {
    await updateGoal(goal.id, {
      starsCurrent: goal.starsCurrent + task.starValue,
    });
  }

  // Record star transaction (for Reward Store integration)
  await createStarTransaction({
    userId: chart.member.userId,
    amount: task.starValue,
    type: "reward_chart",
    referenceId: completion.id,
    description: `Completed: ${task.title}`,
  });
}
```

> **Note:** The `type` field in `star_transactions` table should be extended to include `reward_chart` value.
