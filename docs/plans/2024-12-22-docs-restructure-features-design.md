# Documentation Restructure: Features + Design Split

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate feature specifications from design mockups, with clear interaction modes for wall display vs management interface.

**Architecture:** Create `docs/features/` for source-of-truth specs (data models, UI requirements, interaction rules) and keep `docs/design/` for visual mockups only. Each feature gets `spec.md` (index), `data-model.md` (entities/API), and `ui.md` (components + interaction modes).

**Tech Stack:** Markdown documentation, no code changes

---

## Phase 1: Setup

### Task 1: Create Directory Structure

**Files:**

- Create: `docs/features/calendar/` (directory)
- Create: `docs/features/chores/` (directory)
- Create: `docs/features/dashboard/` (directory)
- Create: `docs/features/reward-store/` (directory)
- Create: `docs/features/ui/` (directory)

**Step 1: Create feature directories**

```bash
mkdir -p docs/features/calendar docs/features/chores docs/features/dashboard docs/features/reward-store docs/features/ui
```

**Step 2: Verify structure**

Run: `ls -la docs/features/`
Expected: 5 directories created

**Step 3: Commit**

```bash
git add docs/features/
git commit -m "docs: create features directory structure"
```

---

### Task 2: Create Design README

**Files:**

- Create: `docs/design/README.md`

**Step 1: Write the design disclaimer**

```markdown
# Design Reference

This folder contains **visual mockups and code references** for the Family Planner UI.

> **Important**: These designs are reference materials only. When implementing,
> always apply the project's brand guidelines and established patterns from
> the codebase. Do not copy mockup code directly.

## Contents

- `calendar/` - Calendar view mockups
- `chores/` - Chores view mockups
- `dashboard/` - Dashboard mockups
- `reward-store/` - Reward store mockups
- `ui/` - Shared component mockups (header, menu)

## Usage

1. Reference these mockups for visual direction
2. Apply brand colors, typography, and spacing from the project's Tailwind config
3. Use existing shadcn/ui components where possible
4. Follow accessibility guidelines from feature specs in `docs/features/`

## Relationship to Feature Specs

Each design folder has a corresponding feature spec in `docs/features/`:

| Design                 | Feature Spec             |
| ---------------------- | ------------------------ |
| `design/calendar/`     | `features/calendar/`     |
| `design/chores/`       | `features/chores/`       |
| `design/dashboard/`    | `features/dashboard/`    |
| `design/reward-store/` | `features/reward-store/` |

The feature specs define **what** to build. These designs show **how** it could look.
```

**Step 2: Verify file created**

Run: `cat docs/design/README.md | head -20`
Expected: Shows the disclaimer header

**Step 3: Commit**

```bash
git add docs/design/README.md
git commit -m "docs: add design folder README with mockup disclaimer"
```

---

## Phase 2: Calendar Feature Spec

### Task 3: Create Calendar Index Spec

**Files:**

- Create: `docs/features/calendar/spec.md`
- Reference: `docs/design/calendar/spec.md` (source)

**Step 1: Write the index file**

```markdown
# Calendar Feature Specification

## Overview

The calendar is the core feature of Family Planner, providing a centralized view of family schedules. It integrates with Google Calendar to display events and connects with the Chores module for task management.

## Documents

| Document                      | Description                               |
| ----------------------------- | ----------------------------------------- |
| [Data Model](./data-model.md) | Event entities, interfaces, API endpoints |
| [UI Specification](./ui.md)   | Components, views, interaction modes      |

## Design Reference

Visual mockups available in `docs/design/calendar/`:

- `calendar-month-design-*.png` - Month view mockups
- `calendar-week-design-*.png` - Week view mockups
- `calendar-today-design-*.png` - Today view mockups

> **Note:** Mockups are reference only. Implement using project brand guidelines.

## Key Features

- Multiple calendar views (Today, Day, Week, Month)
- Family member filtering with color-coded avatars
- Event color categorization
- Drag-and-drop event rescheduling (Management mode only)
- Integration with Google Calendar API
- Dark mode support
- Internationalization (nl/en)
```

**Step 2: Commit**

```bash
git add docs/features/calendar/spec.md
git commit -m "docs(calendar): add feature spec index"
```

---

### Task 4: Create Calendar Data Model

**Files:**

- Create: `docs/features/calendar/data-model.md`
- Reference: `docs/design/calendar/spec.md:376-408,925-931` (source sections)

**Step 1: Extract and write data model**

````markdown
# Calendar Data Model

## Event Entity

```typescript
interface IEvent {
  id: number;
  title: string;
  description: string;
  startDate: string; // ISO 8601 format
  endDate: string; // ISO 8601 format
  color: TEventColor;
  user: IUser;
}

type TEventColor = "blue" | "green" | "red" | "yellow" | "purple" | "orange";

interface IUser {
  id: string;
  name: string;
  picturePath: string | null;
}
```
````

## Event Colors

Events are color-coded by category:

| Color  | Use Cases                          |
| ------ | ---------------------------------- |
| Blue   | Sports, activities, outdoor events |
| Purple | Personal, gym, self-care           |
| Orange | Lessons, learning, education       |
| Green  | Family events, meals, gatherings   |
| Red    | Date nights, special occasions     |
| Yellow | Celebrations, birthdays, parties   |

## Data Sources

| Data     | Source              | Refresh Rate |
| -------- | ------------------- | ------------ |
| Events   | Google Calendar API | Every 5 min  |
| Tasks    | Chores Module       | Real-time    |
| Users    | Auth/Family Module  | On mount     |
| Settings | localStorage        | Immediate    |
| Weather  | Weather API (TBD)   | Every 30 min |

## State Management

The `CalendarProvider` context manages:

- Current view (today/day/week/month)
- Selected date
- Filtered events
- User filter selection
- Color filter selection
- Settings (persisted to localStorage)

The `DndProvider` context manages:

- Drag state
- Drop target
- Pending confirmation

````

**Step 2: Commit**

```bash
git add docs/features/calendar/data-model.md
git commit -m "docs(calendar): add data model specification"
````

---

### Task 5: Create Calendar UI Spec

**Files:**

- Create: `docs/features/calendar/ui.md`
- Reference: `docs/design/calendar/spec.md` (source - UI sections)

**Step 1: Write UI spec with interaction modes**

```markdown
# Calendar UI Specification

## Interaction Modes

The calendar UI supports two interaction contexts:

| Mode             | Device         | User           | Purpose                    |
| ---------------- | -------------- | -------------- | -------------------------- |
| **Wall Display** | Mounted tablet | Kids/Family    | View schedules, see timers |
| **Management**   | Mobile/Desktop | Parents/Admins | CRUD operations, settings  |

### Wall Display Mode

**Allowed Actions:**

- View all calendar views (Today, Day, Week, Month)
- Navigate between dates
- Filter by family member
- Filter by event color
- View event details (read-only)

**Hidden/Disabled:**

- "Add Event" button
- Event edit/delete actions
- Drag-and-drop rescheduling
- Settings panel
- DnD confirmation dialogs

**Touch Targets:** 48px minimum

### Management Mode

**Full Access:**

- All viewing capabilities
- Create, edit, delete events
- Drag-and-drop event rescheduling
- Settings configuration
- User preferences

---

## Views

### Available Views

| View  | Icon                 | Description                                           |
| ----- | -------------------- | ----------------------------------------------------- |
| Today | `view_day`           | Family-focused daily overview with columns per member |
| Day   | `calendar_today`     | Hourly timeline for selected date                     |
| Week  | `calendar_view_week` | 7-day hourly grid                                     |
| Month | `calendar_month`     | Full month grid with day detail sidebar               |

### Today View

Family-focused dashboard showing each family member's schedule in parallel columns.

**Components:**

- User header (avatar, name, level, XP bar)
- Schedule section (event cards)
- Tasks section (from Chores module)

### Day View

24-hour timeline with optional mini calendar sidebar.

**Components:**

- Mini calendar (desktop only)
- "Happening Now" panel
- Time column (hourly labels)
- Event blocks (positioned by time)
- Current time indicator

### Week View

7-day grid with hourly time slots.

**Note:** Shows warning on mobile - "Week view is optimized for larger screens"

### Month View

Full month grid with selected day detail sidebar.

**Components:**

- Month grid with event indicators
- Day detail sidebar (desktop only)
- Achievement indicators (trophy icons)

---

## Components

### Event Card

| Element     | Specification                   |
| ----------- | ------------------------------- |
| Left border | 4px solid event color           |
| Background  | Event color at 10% opacity      |
| Title       | Bold, 14px                      |
| Time        | Category color                  |
| Location    | Optional, 12px, secondary color |

### Filter Tabs

Horizontal pill buttons for view switching.

**States:**

- Active: Dark background, white text, bold
- Inactive: White background, border, secondary text

### Family Member Filter

Horizontal pills with avatars for filtering events by person.

---

## Responsive Behavior

| Breakpoint | Today View           | Day View            | Week View     | Month View     |
| ---------- | -------------------- | ------------------- | ------------- | -------------- |
| < md       | Single column, swipe | Full-width timeline | Warning shown | Grid only      |
| md - lg    | 2 columns            | Show sidebar        | Full grid     | Grid only      |
| > lg       | 3-4 columns          | Show sidebar        | Full grid     | Grid + sidebar |
| > 2xl      | All columns          | Show sidebar        | Full grid     | Grid + sidebar |

---

## Accessibility

- Keyboard navigation for all interactive elements
- ARIA labels on buttons and controls
- Focus management in dialogs
- Screen reader announcements for state changes
- High contrast mode support
- Respect `prefers-reduced-motion`
```

**Step 2: Commit**

```bash
git add docs/features/calendar/ui.md
git commit -m "docs(calendar): add UI spec with interaction modes"
```

---

## Phase 3: Chores Feature Spec

### Task 6: Create Chores Index Spec

**Files:**

- Create: `docs/features/chores/spec.md`

**Step 1: Write the index file**

```markdown
# Chores Feature Specification

## Overview

The chores view serves as the task display and completion interface for the Family Planner. It provides family members with an at-a-glance view of outstanding household tasks, optimized for quick completion on wall-mounted displays.

## Documents

| Document                      | Description                                    |
| ----------------------------- | ---------------------------------------------- |
| [Data Model](./data-model.md) | Chore entities, database schema, API endpoints |
| [UI Specification](./ui.md)   | Components, views, interaction modes           |

## Design Reference

Visual mockups available in `docs/design/chores/`:

- `chores-design-*.png` - Chores view mockups

> **Note:** Mockups are reference only. Implement using project brand guidelines.

## Key Constraints

- **Read-only interface**: Chore creation, editing, and assignment is managed through a separate administration interface
- **Completion-focused**: The only interactive action is marking chores as complete
- **Display-first**: Optimized for passive viewing and quick interactions

## Key Features

- Display outstanding chores for all family members
- Single-tap task completion
- Daily progress tracking and streaks
- Urgent/overdue task highlighting
- Gamification feedback (XP rewards)
```

**Step 2: Commit**

```bash
git add docs/features/chores/spec.md
git commit -m "docs(chores): add feature spec index"
```

---

### Task 7: Create Chores Data Model

**Files:**

- Create: `docs/features/chores/data-model.md`
- Reference: `docs/design/chores/spec.md:550-637,839-845` (source)

**Step 1: Write data model**

````markdown
# Chores Data Model

## Chore Entity

```typescript
interface IChore {
  id: string;
  title: string;
  description?: string;
  assignedTo: IUser;
  dueDate?: Date;
  dueTime?: string; // HH:mm format
  recurrence: ChoreRecurrence;
  isUrgent: boolean; // Manual urgency flag
  status: ChoreStatus;
  xpReward: number;
  createdAt: Date;
  completedAt?: Date;
  completedBy?: IUser;
}

type ChoreRecurrence =
  | "once"
  | "daily"
  | "weekly"
  | "weekdays"
  | "weekends"
  | "monthly";

type ChoreStatus = "pending" | "completed" | "skipped";

interface IUser {
  id: string;
  name: string;
  picturePath: string | null;
  color: string; // For avatar fallback
}
```
````

## Computed Properties

```typescript
type UrgencyStatus = "none" | "due-soon" | "urgent" | "overdue";

function getUrgencyStatus(chore: IChore): UrgencyStatus {
  if (chore.status !== "pending") return "none";
  if (chore.isUrgent) return "urgent";
  if (!chore.dueDate) return "none";

  const now = new Date();
  const due = combineDateAndTime(chore.dueDate, chore.dueTime);

  if (due < now) return "overdue";
  if (due < addHours(now, 4)) return "due-soon";

  return "none";
}
```

## Database Schema

```sql
CREATE TABLE chores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to_id UUID REFERENCES users(id),
  due_date DATE,
  due_time TIME,
  recurrence VARCHAR(20) DEFAULT 'once',
  is_urgent BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'pending',
  xp_reward INTEGER DEFAULT 10,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  completed_by_id UUID REFERENCES users(id)
);
```

## API Endpoints

| Endpoint                   | Method | Description              |
| -------------------------- | ------ | ------------------------ |
| `/api/chores`              | GET    | Fetch all pending chores |
| `/api/chores/:id/complete` | POST   | Mark chore as complete   |
| `/api/chores/streak`       | GET    | Get current streak data  |
| `/api/chores/progress`     | GET    | Get today's progress     |

## Data Sources

| Data     | Source     | Refresh Rate               |
| -------- | ---------- | -------------------------- |
| Chores   | PostgreSQL | On mount, after completion |
| Users    | PostgreSQL | On mount                   |
| Streak   | PostgreSQL | After completion           |
| Progress | Computed   | Real-time                  |

## XP Rewards

| Chore Type            | XP Reward |
| --------------------- | --------- |
| Daily routine         | 10 XP     |
| Weekly task           | 25 XP     |
| Urgent/time-sensitive | 15 XP     |
| Special/bonus         | 50 XP     |

_Note: XP values are configured in the administration interface._

````

**Step 2: Commit**

```bash
git add docs/features/chores/data-model.md
git commit -m "docs(chores): add data model specification"
````

---

### Task 8: Create Chores UI Spec

**Files:**

- Create: `docs/features/chores/ui.md`

**Step 1: Write UI spec with interaction modes**

```markdown
# Chores UI Specification

## Interaction Modes

| Mode             | Device         | User           | Purpose                     |
| ---------------- | -------------- | -------------- | --------------------------- |
| **Wall Display** | Mounted tablet | Kids/Family    | View tasks, mark complete   |
| **Management**   | Mobile/Desktop | Parents/Admins | Create, edit, assign chores |

### Wall Display Mode

**Allowed Actions:**

- View all chores (All, By Person, Urgent filters)
- Mark chores as complete (single tap)
- View progress and streak
- Pull to refresh

**Hidden/Disabled:**

- FAB (Add Chore button)
- Edit/delete chore actions
- Chore creation forms
- Assignment changes

**Touch Targets:** 48px minimum (check button is 48px)

### Management Mode

**Full Access:**

- All viewing capabilities
- Create new chores
- Edit existing chores
- Delete chores
- Assign to family members
- Set recurrence patterns
- Configure XP rewards

---

## Layout

### Desktop/Tablet (md+)
```

+-------------------------------------------------------------------+
| Header |
+-------------------------------------------------------------------+
| Greeting Section |
+-------------------------------------------------------------------+
| Progress Card (streak + completion bar) |
+-------------------------------------------------------------------+
| Filter Tabs: [All Chores] [By Person] [Urgent] |
+-------------------------------------------------------------------+
| Chore List / Columns |
+-------------------------------------------------------------------+
| FAB [+] (Management mode only) |
+-------------------------------------------------------------------+

```

### Mobile (< md)

Single column layout with vertically stacked sections.

---

## Components

### Chore Card

| Element | Specification |
|---------|---------------|
| Avatar | 56px circular with ring |
| Title | lg Bold, truncate single line |
| Status badge | xs Bold uppercase, colored background |
| Assignee | sm, secondary color |
| Check button | 48px circular, primary on hover |

### Card States

| State | Visual |
|-------|--------|
| Default | Full opacity, check hidden |
| Hover | Primary border, check visible |
| Completed | Slide out animation, fade |
| Low priority | 80% opacity |

### Progress Card

| Element | Specification |
|---------|---------------|
| Trophy icon | Primary color, 24px |
| Streak label | "Daily Streak: N Days", Bold |
| Progress | "X/Y Done", secondary color |
| Progress bar | 12px height, primary fill |

### Filter Tabs

| State | Background | Text |
|-------|------------|------|
| Active | Primary (#13ec92) | Dark |
| Inactive | Transparent | Secondary |

---

## Filter Views

### All Chores

Single column list sorted by:
1. Overdue (oldest first)
2. Urgent (soonest first)
3. Today (by time)
4. Future (by date)
5. Flexible (alphabetically)

### By Person

Side-by-side columns per family member.
- Column width: 280-320px
- Horizontal scroll on overflow

### Urgent

Filtered view showing only urgent/overdue chores.

---

## Animations

| Action | Animation |
|--------|-----------|
| Complete chore | Button scale(1.1), card slideX + fade |
| Progress update | Width transition 300ms |
| Card hover | Border color transition 200ms |

---

## Accessibility

- Tab navigation between cards and check buttons
- Enter/Space to complete chore
- Screen reader: "Mark {title} as complete"
- Focus visible: 2px primary outline
- Respect `prefers-reduced-motion`
```

**Step 2: Commit**

```bash
git add docs/features/chores/ui.md
git commit -m "docs(chores): add UI spec with interaction modes"
```

---

## Phase 4: Dashboard Feature Spec

### Task 9: Create Dashboard Index Spec

**Files:**

- Create: `docs/features/dashboard/spec.md`

**Step 1: Write the index file**

```markdown
# Dashboard Feature Specification

## Overview

The dashboard serves as the home screen and primary interface for the Family Planner. It provides an at-a-glance view of the family's day, designed for quick consumption on wall-mounted displays.

## Documents

| Document                      | Description                                  |
| ----------------------------- | -------------------------------------------- |
| [Data Model](./data-model.md) | Dashboard entities, interfaces, data sources |
| [UI Specification](./ui.md)   | Components, layout, interaction modes        |

## Design Reference

Visual mockups available in `docs/design/dashboard/`:

- `dashboard-design-*.png` - Dashboard layout mockups

> **Note:** Mockups are reference only. Implement using project brand guidelines.

## Key Features

- Prominent clock display for ambient awareness
- Today's schedule in timeline format
- Active timer display
- Weekly stars leaderboard
- Quick action buttons
```

**Step 2: Commit**

```bash
git add docs/features/dashboard/spec.md
git commit -m "docs(dashboard): add feature spec index"
```

---

### Task 10: Create Dashboard Data Model

**Files:**

- Create: `docs/features/dashboard/data-model.md`

**Step 1: Write data model**

````markdown
# Dashboard Data Model

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
````

## Data Sources

| Data         | Source              | Refresh Rate |
| ------------ | ------------------- | ------------ |
| Current time | Client clock        | Every second |
| Weather      | External API        | Every 30 min |
| Events       | Google Calendar API | Every 5 min  |
| Timers       | Local state / DB    | Real-time    |
| Star counts  | Database            | On demand    |

## Greeting Logic

```typescript
function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Good Night";
}
```

## Level Calculation

```typescript
function getLevel(starCount: number): number {
  return Math.floor(starCount / 10);
}
// Title varies by level: Explorer, Artist, Champion, etc.
```

````

**Step 2: Commit**

```bash
git add docs/features/dashboard/data-model.md
git commit -m "docs(dashboard): add data model specification"
````

---

### Task 11: Create Dashboard UI Spec

**Files:**

- Create: `docs/features/dashboard/ui.md`

**Step 1: Write UI spec with interaction modes**

```markdown
# Dashboard UI Specification

## Interaction Modes

| Mode             | Device         | User           | Purpose                              |
| ---------------- | -------------- | -------------- | ------------------------------------ |
| **Wall Display** | Mounted tablet | Kids/Family    | View schedule, see timers, see stars |
| **Management**   | Mobile/Desktop | Parents/Admins | Manage timers, configure actions     |

### Wall Display Mode

**Allowed Actions:**

- View clock and greeting
- View today's schedule
- View active timers (display only)
- View weekly stars
- Tap quick actions to start predefined timers

**Hidden/Disabled:**

- Timer pause/extend buttons (display only)
- Quick action configuration
- Sidebar navigation to Settings

**Touch Targets:** 48px minimum

### Management Mode

**Full Access:**

- All viewing capabilities
- Timer management (pause, extend, cancel)
- Quick action configuration
- Full navigation access

---

## Layout

### Desktop (xl+)
```

+------------------------------------------------------------------+
| Header |
+------------------------------------------------------------------+
| | Greeting + Clock |
| Sidebar +--------------------------------------------------------+
| | Today's Flow (2/3) | Timers + Stars (1/3) |
| | | |
+----------+------------------------+-------------------------------+

```

- Sidebar: 288px fixed
- Main content: 3-column grid (2:1 ratio)
- Max width: 1600px centered

### Mobile (< xl)

Single column with stacked sections. Hamburger menu replaces sidebar.

---

## Components

### Greeting & Clock

| Element | Specification |
|---------|---------------|
| Greeting | Time-based, xl-2xl, secondary color |
| Clock | 5-7rem, black weight, tabular-nums |
| Font | Lexend |

### Today's Flow

**Event Card States:**

| State | Background | Border | Features |
|-------|------------|--------|----------|
| NOW | Surface white | 4px primary left | "NOW" badge, shadow |
| NEXT | 60% opacity | Transparent | "NEXT" label |
| LATER | 40% opacity | Transparent | "LATER" label |

### Active Timers

**Display Only on Wall Display:**
- Timer title and subtitle
- Time remaining (5xl, tabular-nums)
- Progress bar (8px, primary fill)
- "+15m" and "Pause" buttons visible but non-functional

### Weekly Stars

| Element | Specification |
|---------|---------------|
| Avatar | 40-48px circular with ring |
| Name | Base Bold |
| Level | xs Muted |
| Stars | lg-2xl Bold with star icon |

### Quick Actions

2x2 grid of action buttons that trigger predefined timers.

| Action | Icon | Timer |
|--------|------|-------|
| Dinner Mode | restaurant | Configurable |
| Water Plants | water_drop | 5 min |
| 15m Tidy | cleaning_services | 15 min |
| Log Chore | favorite | Opens modal |

---

## Accessibility

- Clock announces on focus: "Current time: {time}"
- Events include full context: "{title} at {time}, {location}"
- Star counts labeled: "{name} has {count} stars"
- All buttons have descriptive aria-labels
```

**Step 2: Commit**

```bash
git add docs/features/dashboard/ui.md
git commit -m "docs(dashboard): add UI spec with interaction modes"
```

---

## Phase 5: Reward Store Feature Spec

### Task 12: Create Reward Store Index Spec

**Files:**

- Create: `docs/features/reward-store/spec.md`

**Step 1: Write the index file**

```markdown
# Reward Store Feature Specification

## Overview

The Reward Store is a gamification feature that motivates children to complete tasks by allowing them to spend earned stars on rewards. Children can browse and redeem rewards; parents manage the reward catalog through a separate interface.

## Documents

| Document                      | Description                                    |
| ----------------------------- | ---------------------------------------------- |
| [Data Model](./data-model.md) | Reward entities, transactions, API endpoints   |
| [UI Specification](./ui.md)   | Components, redemption flow, interaction modes |

## Design Reference

Visual mockups available in `docs/design/reward-store/`:

- `reward-store-design-*.png` - Store layout mockups

> **Note:** Mockups are reference only. Implement using project brand guidelines.

## Key Features

- View current star balance
- Browse available rewards
- Redeem rewards (instant, with optional confirmation)
- View redemption history
- Weekly earnings chart
- Recent activity feed
```

**Step 2: Commit**

```bash
git add docs/features/reward-store/spec.md
git commit -m "docs(reward-store): add feature spec index"
```

---

### Task 13: Create Reward Store Data Model

**Files:**

- Create: `docs/features/reward-store/data-model.md`

**Step 1: Write data model**

````markdown
# Reward Store Data Model

## Reward Entity

| Field         | Type      | Description                                  |
| ------------- | --------- | -------------------------------------------- |
| `id`          | UUID      | Unique identifier                            |
| `familyId`    | UUID      | Family this reward belongs to                |
| `title`       | string    | Display name (max 50 chars)                  |
| `description` | string    | Details (max 200 chars)                      |
| `starCost`    | integer   | Stars required to redeem                     |
| `imageUrl`    | string    | Reward image URL (optional)                  |
| `isActive`    | boolean   | Whether reward is available                  |
| `limitType`   | enum      | `none`, `daily`, `weekly`, `monthly`, `once` |
| `limitCount`  | integer   | Max redemptions per period                   |
| `badge`       | string    | Optional badge text                          |
| `createdAt`   | timestamp | Creation date                                |
| `updatedAt`   | timestamp | Last modification                            |

## Redemption Entity

| Field        | Type      | Description            |
| ------------ | --------- | ---------------------- |
| `id`         | UUID      | Unique identifier      |
| `rewardId`   | UUID      | Reference to reward    |
| `userId`     | UUID      | User who redeemed      |
| `starCost`   | integer   | Stars spent (snapshot) |
| `redeemedAt` | timestamp | When redeemed          |

## Star Transaction Entity

| Field         | Type      | Description                           |
| ------------- | --------- | ------------------------------------- |
| `id`          | UUID      | Unique identifier                     |
| `userId`      | UUID      | User account                          |
| `amount`      | integer   | Positive (earned) or negative (spent) |
| `type`        | enum      | `chore`, `bonus`, `redemption`        |
| `referenceId` | UUID      | Related chore/redemption ID           |
| `description` | string    | Activity description                  |
| `createdAt`   | timestamp | Transaction time                      |

## API Endpoints

### GET /api/rewards

Fetch available rewards for the current user's family.

**Response:**

```json
{
  "rewards": [
    {
      "id": "uuid",
      "title": "Movie Night Choice",
      "description": "Pick the movie for family night!",
      "starCost": 500,
      "imageUrl": "https://...",
      "badge": "Popular",
      "canRedeem": true,
      "nextAvailableAt": null
    }
  ]
}
```
````

### POST /api/rewards/:id/redeem

Redeem a reward. Deducts stars immediately.

**Success Response:**

```json
{
  "success": true,
  "newBalance": 750,
  "redemption": {
    "id": "uuid",
    "rewardTitle": "Movie Night Choice",
    "starCost": 500,
    "redeemedAt": "2024-12-22T10:30:00Z"
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "INSUFFICIENT_STARS",
  "message": "You need 250 more stars",
  "required": 500,
  "balance": 250
}
```

### GET /api/users/:id/stars

Fetch user's star balance and recent activity.

### GET /api/users/:id/redemptions

Fetch user's redemption history.

````

**Step 2: Commit**

```bash
git add docs/features/reward-store/data-model.md
git commit -m "docs(reward-store): add data model specification"
````

---

### Task 14: Create Reward Store UI Spec

**Files:**

- Create: `docs/features/reward-store/ui.md`

**Step 1: Write UI spec with interaction modes**

```markdown
# Reward Store UI Specification

## Interaction Modes

| Mode             | Device         | User    | Purpose                         |
| ---------------- | -------------- | ------- | ------------------------------- |
| **Wall Display** | Mounted tablet | Kids    | View rewards, redeem with stars |
| **Management**   | Mobile/Desktop | Parents | Create, edit, manage rewards    |

### Wall Display Mode

**Allowed Actions:**

- View star balance
- Browse available rewards
- Redeem rewards (when affordable)
- View redemption history
- View weekly earnings chart
- View recent activity

**Hidden/Disabled:**

- Create reward
- Edit reward
- Delete reward
- Adjust star balances
- Configure limits

**Touch Targets:** 48px minimum

### Management Mode

**Full Access:**

- All viewing capabilities
- Create new rewards
- Edit existing rewards
- Delete rewards
- Set costs and limits
- Award bonus stars
- View all family members' balances

---

## Layout

### Desktop
```

+------------------------------------------------------------------+
| Header: Greeting + Star Balance Card |
+----------------------------------------------+-------------------+
| Rewards Marketplace (2/3) | Sidebar (1/3) |
| - Filter tabs (Available | Redeemed) | - Weekly Chart |
| - Reward cards grid (2 columns) | - Recent Activity |
+----------------------------------------------+-------------------+

```

### Mobile

Single column with sidebar sections stacked below marketplace.

---

## Components

### Star Balance Card

| Element | Specification |
|---------|---------------|
| Total | text-4xl font-black (Lexend) |
| Star icon | Filled, primary color |
| Weekly delta | text-xs, primary-dark |

### Reward Card

**Structure:**
```

+-----------------------------------+
| [Image] [Badge] |
+-----------------------------------+
| Title |
| Description (2 lines max) |
| |
| ★ 500 [Redeem Button] |
+-----------------------------------+

```

**States:**

| State | Image | Button | Star Cost |
|-------|-------|--------|-----------|
| Affordable | Full color | Primary "Redeem" | Primary |
| Unaffordable | Grayscale + overlay | Disabled "Need X more" | Muted |
| Limit reached | Grayscale | Disabled "Available in X days" | Muted |

### Badges

| Type | Style | Use Case |
|------|-------|----------|
| Popular | White/90 bg | High redemption |
| New | Primary bg | Recently added |
| Limited | Orange bg | Limited quantity |
| Locked | Black/60 bg + lock icon | Unaffordable |

### Redemption Flow

1. User taps "Redeem" button
2. Confirmation dialog appears (optional, parent-configurable)
3. Stars deducted immediately
4. Success toast shown
5. Activity logged

### Confirmation Dialog

Use shadcn/ui `AlertDialog`:
- Shows reward title
- Shows cost and balance before/after
- "Cancel" (secondary) and "Redeem Now" (primary) buttons

---

## Accessibility

- Star balance: "1,250 stars, 120 earned this week"
- Reward cards: "Movie Night Choice, 500 stars, Redeem button"
- Locked rewards: "Locked, need 250 more stars"
- Focus visible: 2px primary outline
```

**Step 2: Commit**

```bash
git add docs/features/reward-store/ui.md
git commit -m "docs(reward-store): add UI spec with interaction modes"
```

---

## Phase 6: Shared UI Specs

### Task 15: Create Header UI Spec

**Files:**

- Create: `docs/features/ui/header.md`
- Reference: `docs/design/ui/header/spec.md` (source)

**Step 1: Write header spec with interaction modes**

```markdown
# App Header Specification

## Overview

The App Header is the primary navigation bar that appears at the top of every screen.

## Interaction Modes

| Element       | Wall Display | Management  |
| ------------- | ------------ | ----------- |
| Brand Area    | View only    | Opens menu  |
| Weather       | Visible      | Visible     |
| Add Event     | **Hidden**   | Visible     |
| Settings      | **Hidden**   | Visible     |
| Notifications | View only    | Interactive |
| Avatar        | View only    | Opens menu  |

### Wall Display Mode

The header displays in a simplified "kiosk" mode:

- Brand logo and family name visible
- Weather widget visible
- Notifications badge visible (view only)
- No interactive buttons except navigation

### Management Mode

Full header with all interactive elements:

- Add Event button (primary CTA)
- Settings button
- Notifications with badge
- User menu via avatar

---

## Components

### Brand Area

| Element        | Specification                         |
| -------------- | ------------------------------------- |
| Icon container | 48×48px, primary bg, circular         |
| Icon           | Home (Lucide), 24px, dark             |
| Title          | "Family Planner", 20px Bold           |
| Tagline        | "FAMILY OS", 12px, primary, uppercase |

### Weather Display (Optional)

| Element     | Specification               |
| ----------- | --------------------------- |
| Container   | Pill shape, border          |
| Icon        | Weather condition, 20px     |
| Temperature | 14px SemiBold, tabular-nums |

### Primary Action Button

**Management Mode Only**

| Property   | Value               |
| ---------- | ------------------- |
| Background | Primary (#13ec92)   |
| Text       | Dark, 14px SemiBold |
| Icon       | Plus, 18px          |
| Min height | 44px                |

### Action Icons

| Property   | Value            |
| ---------- | ---------------- |
| Size       | 44×44px          |
| Icon size  | 22px             |
| Icon color | Secondary        |
| Hover      | Surface hover bg |

### Notification Badge

| Property   | Value             |
| ---------- | ----------------- |
| Position   | Top-right of bell |
| Min size   | 18px              |
| Background | Red-500           |
| Font       | 10px Bold         |

---

## Responsive Behavior

| Breakpoint | Changes                           |
| ---------- | --------------------------------- |
| < 640px    | Hide weather, Add Event icon-only |
| 640-1024px | All elements, reduced spacing     |
| > 1024px   | Full layout                       |

---

## Design Reference

See `docs/design/ui/header/` for visual mockups.
```

**Step 2: Commit**

```bash
git add docs/features/ui/header.md
git commit -m "docs(ui): add header spec with interaction modes"
```

---

### Task 16: Create Menu UI Spec

**Files:**

- Create: `docs/features/ui/menu.md`
- Reference: `docs/design/ui/menu/spec.md` (source)

**Step 1: Write menu spec with interaction modes**

```markdown
# Navigation Menu Specification

## Overview

The menu is a slide-out drawer (Sheet) triggered from the header. It provides primary navigation for the application.

## Interaction Modes

| Item      | Wall Display | Management |
| --------- | ------------ | ---------- |
| Dashboard | Navigate     | Navigate   |
| Schedule  | Navigate     | Navigate   |
| Chore Log | Navigate     | Navigate   |
| Settings  | **Hidden**   | Navigate   |
| Help      | Visible      | Visible    |

### Wall Display Mode

Simplified navigation without administrative functions:

- Dashboard, Schedule, Chore Log accessible
- Settings link hidden
- Help link visible

### Management Mode

Full navigation with all items:

- All navigation items accessible
- Settings for configuration

---

## Anatomy
```

+-----------------------------+
| Brand Header |
| [Icon] Family Planner |
| [Family Name] |
+-----------------------------+
| Navigation |
| ▣ Dashboard active |
| ▢ Schedule |
| ▢ Chore Log |
| ▢ Settings (mgmt only) |
| |
| (spacer) |
+-----------------------------+
| Footer |
| ⓘ Help |
+-----------------------------+

```

---

## Components

### Menu Container (Sheet)

| Property | Value |
|----------|-------|
| Width | 256px |
| Height | 100vh |
| Position | Left side |
| Animation | slideInLeft 200ms |

### Navigation Item

| State | Background | Text |
|-------|------------|------|
| Active | Primary (#13ec92) | Dark |
| Inactive | Transparent | Secondary |
| Hover | Surface hover | Primary |

| Property | Value |
|----------|-------|
| Min height | 48px |
| Padding | 12px 16px |
| Icon size | 20px |
| Gap | 12px |

### Navigation Items

| Item | Icon (Lucide) | Route |
|------|---------------|-------|
| Dashboard | LayoutDashboard | /dashboard |
| Schedule | Calendar | /schedule |
| Chore Log | CheckSquare | /chores |
| Settings | Settings | /settings |
| Help | HelpCircle | (modal) |

---

## Accessibility

- Tab navigation between items
- Enter/Space to activate
- Escape to close
- Focus trapped while open
- `aria-current="page"` on active item

---

## Design Reference

See `docs/design/ui/menu/` for visual mockups.
```

**Step 2: Commit**

```bash
git add docs/features/ui/menu.md
git commit -m "docs(ui): add menu spec with interaction modes"
```

---

## Phase 7: Clean Up Design Folder

### Task 17: Add Disclaimer to Design Specs

**Files:**

- Modify: `docs/design/calendar/spec.md`
- Modify: `docs/design/chores/spec.md`
- Modify: `docs/design/dashboard/spec.md`
- Modify: `docs/design/reward-store/spec.md`
- Modify: `docs/design/ui/header/spec.md`
- Modify: `docs/design/ui/menu/spec.md`

**Step 1: Add disclaimer to each file**

Add this block after the title in each design spec:

```markdown
> **Design Reference Only**
>
> This document contains visual mockups and styling references. For implementation
> requirements, data models, and interaction rules, see the feature specification
> in `docs/features/`.
>
> When implementing, apply the project's brand guidelines and established patterns
> from the codebase. Do not copy mockup code directly.
```

**Step 2: Commit all changes**

```bash
git add docs/design/
git commit -m "docs(design): add mockup disclaimers to all design specs"
```

---

### Task 18: Final Verification

**Step 1: Verify directory structure**

Run: `find docs/features -type f -name "*.md" | sort`

Expected output:

```
docs/features/calendar/data-model.md
docs/features/calendar/spec.md
docs/features/calendar/ui.md
docs/features/chores/data-model.md
docs/features/chores/spec.md
docs/features/chores/ui.md
docs/features/dashboard/data-model.md
docs/features/dashboard/spec.md
docs/features/dashboard/ui.md
docs/features/reward-store/data-model.md
docs/features/reward-store/spec.md
docs/features/reward-store/ui.md
docs/features/ui/header.md
docs/features/ui/menu.md
```

**Step 2: Verify design README exists**

Run: `cat docs/design/README.md | head -5`

Expected: Shows "# Design Reference" header

**Step 3: Final commit**

```bash
git add .
git commit -m "docs: complete features/design restructure with interaction modes"
```

---

## Summary

| Phase        | Tasks    | Files                    |
| ------------ | -------- | ------------------------ |
| Setup        | 1-2      | 2 (directories + README) |
| Calendar     | 3-5      | 3                        |
| Chores       | 6-8      | 3                        |
| Dashboard    | 9-11     | 3                        |
| Reward Store | 12-14    | 3                        |
| Shared UI    | 15-16    | 2                        |
| Cleanup      | 17-18    | 6 modified               |
| **Total**    | 18 tasks | 21 file operations       |
