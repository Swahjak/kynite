# Dashboard Data Model

The dashboard is a **view-only feature** that aggregates data from other features. It does not own database tables but consumes data from families, calendar events, timers, chores, and reward charts.

## Dashboard Data

```typescript
// src/components/dashboard/types.ts

export type EventState = "past" | "now" | "upcoming";

export interface DashboardEvent {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  category: string;
  state?: EventState;
}

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
  completedAt: Date | null;
}

export interface FamilyMemberStar {
  id: string;
  name: string;
  avatarUrl?: string;
  avatarColor: string;
  weeklyStarCount: number;
  level: number;
  levelTitle: string;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  category: string;
  timerDuration?: number; // seconds
}

export type ChoreUrgency = "overdue" | "urgent" | "due-soon" | "none";

export interface DashboardChore {
  id: string;
  title: string;
  dueTime: string | null;
  urgency: ChoreUrgency;
  assignee: {
    name: string;
    avatarColor: string;
  } | null;
  starReward: number;
}

export interface DashboardData {
  familyId: string;
  familyName: string;
  todaysEvents: DashboardEvent[];
  todaysChores: DashboardChore[];
  activeTimers: Timer[];
  familyMembers: FamilyMemberStar[];
  quickActions: QuickAction[];
}
```

## Data Relationships

The dashboard aggregates data from multiple sources:

```
┌─────────────────────────────────────────────────────────────┐
│                      Dashboard View                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  families   │    │   events    │    │  activeTimers   │  │
│  │  (FK)       │    │   (FK)      │    │     (FK)        │  │
│  └──────┬──────┘    └──────┬──────┘    └────────┬────────┘  │
│         │                  │                    │            │
│         ▼                  ▼                    ▼            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │ Family Name │    │Today's Flow │    │  Active Timers  │  │
│  │   Greeting  │    │ (now/next)  │    │  (countdown)    │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │   chores    │    │rewardCharts │    │ timerTemplates  │  │
│  │   (FK)      │    │   (FK)      │    │     (FK)        │  │
│  └──────┬──────┘    └──────┬──────┘    └────────┬────────┘  │
│         │                  │                    │            │
│         ▼                  ▼                    ▼            │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │Today's Chores│   │Weekly Stars │    │  Quick Actions  │  │
│  │ (urgency)   │    │ (aggregated)│    │     (FAB)       │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

| Dashboard Section | Source Feature  | Source Table                                   |
| ----------------- | --------------- | ---------------------------------------------- |
| Family Name       | Families        | `families`                                     |
| Today's Flow      | Calendar        | `events` (filtered by today's date)            |
| Today's Chores    | Chores          | `chores` (pending, due today)                  |
| Weekly Stars      | Reward Charts   | `rewardChartCompletions` (aggregated by week)  |
| Active Timers     | Timers          | `activeTimers` (running/paused status)         |
| Quick Actions     | Timer Templates | `timerTemplates` (where quickActionPin = true) |

## Data Sources

| Data           | Source                | Storage                               | Refresh Rate                   |
| -------------- | --------------------- | ------------------------------------- | ------------------------------ |
| Current time   | Client clock          | Memory (useClock hook)                | Every second                   |
| Events         | Google Calendar API   | PostgreSQL (`events`)                 | SSR + real-time via Pusher     |
| Chores         | Database              | PostgreSQL (`chores`)                 | SSR + real-time via Pusher     |
| Timers         | Database + API        | PostgreSQL (`activeTimers`)           | React Query + Pusher           |
| Family members | Database              | PostgreSQL (`familyMembers`)          | SSR                            |
| Star counts    | Database (aggregated) | PostgreSQL (`rewardChartCompletions`) | SSR + invalidate on completion |
| Quick actions  | Database              | PostgreSQL (`timerTemplates`)         | SSR                            |

## Event Filtering

Today's events are filtered and categorized by temporal state in `DashboardContext`:

```typescript
// src/components/dashboard/contexts/dashboard-context.tsx

const categorizedEvents = useMemo(() => {
  const now = currentTime.getTime();
  const upcoming = data.todaysEvents
    .filter((e) => e.endTime.getTime() > now)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  // Current event (now playing)
  const nowEvent =
    upcoming.find((e) => {
      const start = e.startTime.getTime();
      const end = e.endTime.getTime();
      return now >= start && now < end;
    }) || null;

  // Future events (not yet started)
  const futureEvents = upcoming.filter((e) => e.startTime.getTime() > now);
  const nextEvent = futureEvents[0] || null;
  const laterEvents = futureEvents.slice(1);

  return { nowEvent, nextEvent, laterEvents, eventsRemaining: upcoming.length };
}, [data.todaysEvents, currentTime]);
```

## Chore Urgency Calculation

Chores are categorized by urgency based on due date/time:

```typescript
// src/components/dashboard/requests.ts

function calculateChoreUrgency(
  chore: IChoreWithAssignee,
  now: Date
): ChoreUrgency {
  if (chore.status !== "pending") return "none";
  if (chore.isUrgent) return "urgent";
  if (!chore.dueDate) return "none";

  // Combine date and time for comparison
  let dueDateTime: Date;
  if (chore.dueTime) {
    dueDateTime = new Date(`${chore.dueDate}T${chore.dueTime}:00`);
  } else {
    dueDateTime = new Date(`${chore.dueDate}T23:59:59`);
  }

  if (dueDateTime < now) return "overdue";

  // Due within 4 hours
  const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  if (dueDateTime < fourHoursLater) return "due-soon";

  return "none";
}
```

## Weekly Stars Aggregation

Stars are aggregated per family member for the current week from reward chart completions:

```typescript
// src/components/dashboard/requests.ts

function calculateLevel(starCount: number): {
  level: number;
  levelTitle: string;
} {
  if (starCount >= 50) return { level: 5, levelTitle: "Superstar" };
  if (starCount >= 30) return { level: 4, levelTitle: "Champion" };
  if (starCount >= 20) return { level: 3, levelTitle: "Artist" };
  if (starCount >= 10) return { level: 2, levelTitle: "Explorer" };
  return { level: 1, levelTitle: "Beginner" };
}

// Weekly stars are summed from rewardChartCompletions
// filtered by chartId, status='completed', and date within current week
```
