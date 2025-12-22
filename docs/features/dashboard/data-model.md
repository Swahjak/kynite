# Dashboard Data Model

The dashboard is a **view-only feature** that aggregates data from other features. It does not own database tables but consumes data from families, calendar events, timers, and chores.

## Dashboard Data

```typescript
interface DashboardData {
  family: {
    name: string;
    photoUrl?: string;
  };
  currentTime: Date;
  weather: WeatherData;
  todaysEvents: Event[];
  activeTimers: Timer[];
  familyMembers: FamilyMember[];
  quickActions: QuickAction[];
}

interface WeatherData {
  temperature: number;
  unit: "F" | "C";
  condition: string;
  icon: string;
}

interface Event {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  category: EventCategory;
  assignedTo?: string[];
}

interface Timer {
  id: string;
  title: string;
  subtitle: string;
  remainingSeconds: number;
  totalSeconds: number;
  category: string;
  iconName: string;
}

interface FamilyMember {
  id: string;
  name: string;
  role: "parent" | "child";
  avatarColor: string;
  avatarUrl?: string;
  starCount: number;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  iconColor: string;
  timerDuration?: number; // seconds
  isFeatured: boolean;
}
```

## Data Relationships

The dashboard aggregates data from multiple sources:

```
┌─────────────────────────────────────────────────────────────┐
│                      Dashboard View                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  families   │    │   events    │    │   timers    │     │
│  │  (FK)       │    │   (FK)      │    │   (TBD)     │     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘     │
│         │                  │                  │             │
│         ▼                  ▼                  ▼             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │ Family Name │    │Today's Flow │    │Active Timers│     │
│  │ Family Photo│    │ (filtered)  │    │             │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                              │
│  ┌─────────────┐    ┌─────────────┐                        │
│  │family_members│   │chore_logs   │                        │
│  │   (FK)      │    │   (TBD)     │                        │
│  └──────┬──────┘    └──────┬──────┘                        │
│         │                  │                                │
│         ▼                  ▼                                │
│  ┌─────────────┐    ┌─────────────┐                        │
│  │Weekly Stars │    │ Star Counts │                        │
│  │ Leaderboard │◄───│ (aggregated)│                        │
│  └─────────────┘    └─────────────┘                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

| Dashboard Section | Source Feature    | Source Table                         |
| ----------------- | ----------------- | ------------------------------------ |
| Family Name/Photo | Families          | `families`                           |
| Today's Flow      | Calendar          | `events` (filtered by today's date)  |
| Weekly Stars      | Families + Chores | `family_members` + `chore_logs`      |
| Active Timers     | Timers (TBD)      | `timers`                             |
| Quick Actions     | Dashboard Config  | localStorage or `dashboard_settings` |

## Data Sources

| Data           | Source              | Storage                       | Refresh Rate        |
| -------------- | ------------------- | ----------------------------- | ------------------- |
| Current time   | Client clock        | Memory                        | Every second        |
| Weather        | External API (TBD)  | Cache                         | Every 30 min        |
| Events         | Google Calendar API | PostgreSQL (`events`)         | Every 5 min         |
| Timers         | Local state / DB    | PostgreSQL / Memory           | Real-time           |
| Family members | Database            | PostgreSQL (`family_members`) | On demand           |
| Star counts    | Database            | PostgreSQL (aggregated)       | On chore completion |
| Quick actions  | User config         | localStorage                  | On change           |

## Event Filtering

Today's events are filtered and categorized by temporal state:

```typescript
type EventState = "NOW" | "NEXT" | "LATER";

function getEventState(event: Event, currentTime: Date): EventState {
  if (currentTime >= event.startTime && currentTime < event.endTime) {
    return "NOW";
  }
  // First upcoming event is 'NEXT', rest are 'LATER'
  return isFirstUpcoming ? "NEXT" : "LATER";
}
```

## Weekly Stars Aggregation

Stars are aggregated per family member for the current week:

```typescript
interface WeeklyStarsData {
  memberId: string;
  memberName: string;
  avatarColor: string;
  weeklyStarCount: number;
  totalStarCount: number;
  level: number;
  levelTitle: string;
}
```
