# Dashboard UI Specification

## Interaction Modes

| Mode             | Device         | User           | Purpose                                      |
| ---------------- | -------------- | -------------- | -------------------------------------------- |
| **Wall Display** | Mounted tablet | Kids/Family    | View schedule, see timers, complete chores   |
| **Management**   | Mobile/Desktop | Parents/Admins | Full timer controls, configure quick actions |

### Wall Display Mode (Device Users)

**Allowed Actions:**

- View greeting and today's events
- View active timers (display only for running)
- View and complete chores
- View weekly stars
- Start quick action timers
- Claim timer rewards during cooldown

**Hidden/Disabled:**

- Timer pause/extend buttons (managers only)
- Quick action configuration

**Touch Targets:** 44px minimum

### Management Mode

**Full Access:**

- All viewing capabilities
- Timer management (pause, extend, cancel)
- Quick action configuration
- Full navigation access

---

## Layout Structure

### Desktop/Tablet (md: 768px+)

```
┌─────────────────────────────────────────────────────────────────┐
│ Greeting (time-based message)                                   │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ ┌─────────────────────┐ │
│ │                                     │ │ Active Timers       │ │
│ │ Today's Flow                        │ │                     │ │
│ │ (3/5 width)                         │ ├─────────────────────┤ │
│ │                                     │ │ Weekly Stars        │ │
│ ├─────────────────────────────────────┤ │                     │ │
│ │ Today's Chores                      │ │                     │ │
│ │                                     │ │                     │ │
│ └─────────────────────────────────────┘ └─────────────────────┘ │
│                                                    [+ FAB]      │
└─────────────────────────────────────────────────────────────────┘
```

- **Main content**: 5-column grid (3:2 ratio)
- **Max width**: 1280px (max-w-7xl), centered
- **Padding**: p-4 md:p-6 lg:p-8
- **Gap**: gap-6 lg:gap-8

### Mobile (< md: 768px)

```
┌─────────────────────────────────────────┐
│ Greeting                                │
├─────────────────────────────────────────┤
│ Today's Flow                            │
│ (full width)                            │
├─────────────────────────────────────────┤
│ Today's Chores                          │
├─────────────────────────────────────────┤
│ Active Timers                           │
├─────────────────────────────────────────┤
│ Weekly Stars                            │
│                              [+ FAB]    │
└─────────────────────────────────────────┘
```

- Single column layout
- Sections stack vertically
- FAB fixed bottom-right

---

## Components

### 1. Greeting

Simple time-based greeting text (no clock display).

**File:** `src/components/dashboard/greeting/greeting.tsx`

```typescript
type TimeOfDay = "morning" | "afternoon" | "evening";

function useGreeting(currentTime: Date): TimeOfDay {
  const hour = currentTime.getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
```

| Element | Specification                              |
| ------- | ------------------------------------------ |
| Text    | "Good Morning/Afternoon/Evening"           |
| Style   | text-muted-foreground text-base md:text-lg |

### 2. Today's Flow

Timeline view of today's calendar events with temporal grouping.

**File:** `src/components/dashboard/todays-flow/todays-flow.tsx`

#### Section Header

| Element | Specification                                     |
| ------- | ------------------------------------------------- |
| Icon    | `CalendarClock` from lucide-react                 |
| Title   | "Today's Flow", text-lg font-semibold             |
| Badge   | "{n} Events Remaining", Badge variant="secondary" |

#### Event Card States

**NOW (Current Event)**

| Property    | Value                        |
| ----------- | ---------------------------- |
| Background  | bg-primary/5                 |
| Border-left | border-l-4 border-l-primary  |
| Time        | text-2xl font-bold font-mono |
| Title       | text-xl font-semibold        |

**UPCOMING (Next/Later Events)**

| Property   | Value                   |
| ---------- | ----------------------- |
| Background | bg-muted/50             |
| Time       | text-lg font-mono       |
| Title      | text-base font-semibold |

**PAST (Completed Events)**

| Property | Value      |
| -------- | ---------- |
| Opacity  | opacity-60 |

### 3. Today's Chores

Pending chores for today, grouped by urgency.

**File:** `src/components/dashboard/todays-chores/todays-chores.tsx`

#### Section Header

| Element | Specification                                     |
| ------- | ------------------------------------------------- |
| Icon    | `ClipboardList` from lucide-react                 |
| Title   | "Today's Chores", text-lg font-semibold           |
| Badge   | "{n} chores remaining", Badge variant="secondary" |

#### Urgency Groups

| Group    | Label Color           | Chores Included         |
| -------- | --------------------- | ----------------------- |
| Urgent   | text-destructive      | overdue + isUrgent      |
| Due Soon | text-muted-foreground | due within 4 hours      |
| Today    | text-muted-foreground | all other pending today |

#### Chore Card

Uses shared `ChoreCard` component from `src/components/chores/components/chore-card.tsx`:

- Displays assignee avatar, title, star reward
- Complete button (triggers confetti)
- Take button (opens member selection dialog)

### 4. Active Timers

Running and paused timers with countdown display and controls.

**File:** `src/components/dashboard/active-timers/active-timers.tsx`

#### Section Header

| Element | Specification                     |
| ------- | --------------------------------- |
| Icon    | `Timer` from lucide-react         |
| Title   | uppercase, text-xs, tracking-wide |

#### Timer Card States

**File:** `src/components/dashboard/active-timers/timer-card.tsx`

| UI State          | Description                        | Actions Available    |
| ----------------- | ---------------------------------- | -------------------- |
| running           | Timer counting down                | +extend, Pause, Done |
| paused            | Timer frozen                       | (none currently)     |
| in_cooldown       | Timer expired, reward claimable    | Claim (+stars)       |
| cooldown_expired  | Cooldown window missed             | Dismiss              |
| needs_acknowledge | Timer done, no cooldown configured | Done                 |

#### Timer Card Layout

| Element       | Specification                               |
| ------------- | ------------------------------------------- |
| Avatar        | Assigned member's avatar (if assigned)      |
| Title         | text-sm font-semibold                       |
| Subtitle      | text-xs text-muted-foreground               |
| Time display  | text-3xl md:text-4xl font-bold tabular-nums |
| Progress bar  | h-1.5, primary fill                         |
| Negative time | text-destructive animate-pulse              |

#### Dynamic Extend Times

| Total Duration | Extend Button |
| -------------- | ------------- |
| <= 5 min       | +1m           |
| <= 15 min      | +5m           |
| <= 30 min      | +10m          |
| <= 60 min      | +15m          |
| > 60 min       | +30m          |

### 5. Weekly Stars

Family member leaderboard sorted by weekly star count.

**File:** `src/components/dashboard/weekly-stars/weekly-stars.tsx`

#### Section Header

| Element | Specification                                   |
| ------- | ----------------------------------------------- |
| Title   | "Weekly Stars", uppercase text-xs tracking-wide |

#### Member Row

**File:** `src/components/dashboard/weekly-stars/member-row.tsx`

| Element    | Specification                           |
| ---------- | --------------------------------------- |
| Avatar     | FamilyAvatar component, size="sm"       |
| Name       | text-sm font-medium                     |
| Level      | "Level {n} {title}", text-xs text-muted |
| Star count | text-sm font-semibold tabular-nums      |
| Star icon  | Star filled, yellow-500                 |
| Leader bg  | bg-primary/5 for rank 1                 |

### 6. Quick Actions FAB

Floating action button with popover menu to start timer templates.

**File:** `src/components/dashboard/quick-actions/quick-actions-fab.tsx`

#### FAB Button

| Property | Value                       |
| -------- | --------------------------- |
| Position | fixed right-6 bottom-6 z-50 |
| Size     | h-14 w-14 rounded-full      |
| Icon     | Plus from lucide-react      |
| Shadow   | shadow-lg                   |
| Hover    | scale-105                   |
| Active   | scale-95                    |

#### Popover Content

| Element        | Specification                         |
| -------------- | ------------------------------------- |
| Layout         | 2x2 grid                              |
| Action buttons | ActionButton component                |
| Refresh button | variant="outline" with RefreshCw icon |

#### Action Button

**File:** `src/components/dashboard/quick-actions/action-button.tsx`

| Property | Value                           |
| -------- | ------------------------------- |
| Height   | h-16                            |
| Layout   | flex-col gap-1                  |
| Icon     | h-5 w-5                         |
| Label    | text-xs font-medium             |
| Disabled | When not manager and not device |

#### Member Selection Dialog

When starting a quick action, a dialog prompts for family member selection:

| Element      | Specification                    |
| ------------ | -------------------------------- |
| Title        | "Select Family Member"           |
| Buttons      | Member avatar + name, full width |
| Click action | Starts timer via API             |

---

## DashboardContext

Central state management for the dashboard.

**File:** `src/components/dashboard/contexts/dashboard-context.tsx`

### Context Interface

```typescript
interface IDashboardContext {
  familyId: string;
  familyName: string;
  currentTime: Date;
  todaysEvents: DashboardEvent[];
  todaysChores: DashboardChore[];
  choresRemaining: number;
  activeTimers: Timer[];
  familyMembers: FamilyMemberStar[];
  quickActions: QuickAction[];
  nowEvent: DashboardEvent | null;
  nextEvent: DashboardEvent | null;
  laterEvents: DashboardEvent[];
  eventsRemaining: number;
  startQuickAction: (actionId: string, memberId: string) => void;
  pauseTimer: (timerId: string) => void;
  extendTimer: (timerId: string, seconds: number) => void;
  confirmTimer: (timerId: string, confirmedById: string) => void;
  dismissTimer: (timerId: string) => void;
  acknowledgeTimer: (timerId: string) => void;
  isLoadingTimers: boolean;
  completeChore: (choreId: string) => Promise<void>;
  assignChore: (choreId: string, assignedToId: string) => Promise<void>;
}
```

### Real-time Updates

Uses `useFamilyChannel` hook for Pusher events:

| Event           | Action                        |
| --------------- | ----------------------------- |
| timer:started   | Add timer to list             |
| timer:updated   | Update timer in list          |
| timer:cancelled | Remove timer from list        |
| timer:completed | Remove timer from list        |
| timer:expired   | Update timer status           |
| stars:updated   | Invalidate weekly stars query |
| chore:completed | Invalidate chores query       |

---

## Dark Mode

The dashboard fully supports dark mode via the `dark` class on `<html>`.

### Color Mapping

| Element         | Light   | Dark                |
| --------------- | ------- | ------------------- |
| Page background | #f6f8f7 | #10221a             |
| Surface/Cards   | #ffffff | #1c2e26             |
| Text Primary    | #111815 | #ffffff             |
| Text Secondary  | #618979 | #8baea0             |
| Borders         | #dbe6e1 | #2a3831             |
| Primary         | #13ec92 | #13ec92 (unchanged) |

---

## Accessibility

### WCAG 2.1 AA Compliance

| Requirement      | Implementation                               |
| ---------------- | -------------------------------------------- |
| Color contrast   | All text meets 4.5:1 (normal) or 3:1 (large) |
| Focus indicators | 2px Primary outline with 2px offset          |
| Touch targets    | Minimum 44x44px for all interactive elements |
| Screen readers   | Semantic HTML, ARIA labels on icons          |
| Reduced motion   | Respect `prefers-reduced-motion`             |

### Keyboard Navigation

| Key         | Action                            |
| ----------- | --------------------------------- |
| Tab         | Move between interactive elements |
| Enter/Space | Activate buttons, open menus      |
| Escape      | Close menus/modals                |
| Arrow keys  | Navigate within menus             |

---

## Component Structure

```
src/components/dashboard/
├── dashboard.tsx                    # Main wrapper with DashboardProvider
├── types.ts                         # TypeScript interfaces
├── requests.ts                      # Server-side data fetching
├── hooks.ts                         # useClock, useGreeting hooks
├── mocks.ts                         # Mock data for testing
├── contexts/
│   └── dashboard-context.tsx        # Central state management
├── greeting/
│   └── greeting.tsx                 # Time-based greeting text
├── todays-flow/
│   ├── todays-flow.tsx              # Event timeline section
│   └── event-card.tsx               # Individual event card
├── todays-chores/
│   └── todays-chores.tsx            # Chores section with urgency groups
├── active-timers/
│   ├── active-timers.tsx            # Timer section wrapper
│   └── timer-card.tsx               # Individual timer with controls
├── weekly-stars/
│   ├── weekly-stars.tsx             # Leaderboard section
│   └── member-row.tsx               # Individual member row
├── quick-actions/
│   ├── quick-actions.tsx            # Grid of action buttons
│   ├── quick-actions-fab.tsx        # Floating action button
│   └── action-button.tsx            # Individual action button
└── __tests__/
    └── ...                          # Unit tests
```

---

## State Management

- **DashboardProvider**: Wraps entire dashboard, provides context
- **React Query**: Manages timer state with caching and invalidation
- **Pusher**: Real-time updates for timers, chores, and stars
- **useClock hook**: Updates current time every second
- **useGreeting hook**: Derives time-of-day from current time

---

## Performance Considerations

- Clock updates via `setInterval` (1 second)
- Timer countdown managed locally with server sync
- React Query with `staleTime: Infinity` for timer data
- Memoized event filtering and categorization
- SSR for initial data load, client hydration for interactivity
