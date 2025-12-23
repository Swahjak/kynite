# Wall Hub Calendar Views Design

## Overview

Add two new "at-a-glance" dashboard views alongside the existing calendar, creating a three-tab navigation structure optimized for wall display and quick family coordination.

## Tab Structure

```
/calendar/today  → Wall Hub Today View (people as columns)
/calendar/week   → Wall Hub Week View (days as columns)
/calendar/full   → Current calendar (day/week/month/year/agenda sub-views)
```

The existing calendar implementation is preserved under the "Calendar" tab with all its current functionality intact.

## Architecture

### Route Structure

```
src/app/[locale]/(app)/calendar/
├── layout.tsx          # Provides CalendarContext + ChoresContext
│                       # Renders shared header with Today/Week/Calendar tabs
├── today/
│   └── page.tsx        # WallHubTodayView
├── week/
│   └── page.tsx        # WallHubWeekView
└── full/
    └── page.tsx        # Current Calendar component
```

### Data Flow

- `layout.tsx` fetches events and chores, wraps children in providers
- Each page accesses data via `useCalendar()` and `useChores()` hooks
- Family members come from the existing user system
- Tab navigation uses Next.js `Link` components, active state from pathname

## Today View

**Purpose:** At-a-glance view of what each family member has going on today.

**Layout:** Horizontal columns, one per family member.

### Person Column Structure

```
┌─────────────────────┐
│ [Avatar]  Name      │  ← Header with avatar
├─────────────────────┤
│ SCHEDULE            │  ← Section label
│ ┌─────────────────┐ │
│ │ 08:00 AM        │ │  ← Event card
│ │ School Bus      │ │     - Time
│ └─────────────────┘ │     - Title
│ ┌─────────────────┐ │     - Optional: location, color accent
│ │ 08:30 - 03:00 PM│ │  ← "NOW" badge if current
│ │ School     [NOW]│ │
│ └─────────────────┘ │
├─────────────────────┤
│ TASKS         2/5   │  ← Chores section with progress
│ ☐ Math Homework     │     - Checkbox style
│ ☐ Clean Room        │     - From chores system
│ ☑ Feed the Dog      │     - Completed shown struck through
└─────────────────────┘
```

### Data Filtering

- Events filtered by `event.users` containing this family member
- Chores filtered by assignee
- Only today's events shown (sorted by start time)

### Empty State

"Free Day!" with celebration icon when a person has no scheduled events.

## Week View

**Purpose:** Overview of the family's week - what's happening each day.

**Layout:** 7 columns (Mon-Sun) with horizontal scroll on smaller screens.

### Day Column Structure

```
┌─────────────────────┐
│   TUE               │  ← Day header
│    24               │     - Day name + date
│  [TODAY]            │     - "TODAY" badge if current
├─────────────────────┤
│ ──────── NOW ────── │  ← Current time indicator (today only)
│ ┌─────────────────┐ │
│ │ 8:00 AM         │ │  ← Event card (simplified)
│ │ School Drop-off │ │     - Time + title
│ └─────────────────┘ │     - Color-coded left border
│ ┌─────────────────┐ │
│ │ 6:00 PM         │ │  ← Shows assigned people
│ │ Gym Session     │ │     as avatar initials
│ │ [D] [M]         │ │
│ └─────────────────┘ │
├─────────────────────┤
│ ☐ Read 20 mins      │  ← Day's tasks/routines
│ ☐ Pack Lunches      │     (dashed border style)
└─────────────────────┘
```

### Features

- **Person filter chips:** Everyone, Mom, Dad, Maya, Leo - filters events by assignee
- **Week navigation:** Previous/next week arrows, "Today" button
- **Past days:** Shown with reduced opacity
- Uses existing `filterEventsBySelectedUser` from CalendarContext

## Component Structure

```
src/components/wall-hub/
├── wall-hub-header.tsx       # Tab navigation (Today/Week/Calendar)
├── person-filter-chips.tsx   # Family member filter (reused in Week view)
├── today/
│   ├── today-view.tsx        # Main container, maps over family members
│   ├── person-column.tsx     # Single person's day (schedule + tasks)
│   ├── schedule-card.tsx     # Event display card
│   └── task-list.tsx         # Chores checklist for this person
├── week/
│   ├── week-view.tsx         # Main container, week navigation
│   ├── day-column.tsx        # Single day's events + tasks
│   ├── day-header.tsx        # Day name, date, TODAY badge
│   └── event-card.tsx        # Simplified event card
└── shared/
    ├── now-indicator.tsx     # "NOW" time line/badge
    └── empty-state.tsx       # "Free Day!" / "No events" states
```

### Reuse from Existing Calendar

- `useCalendar()` hook for events and user filtering
- Color utilities for event color coding
- Date formatting helpers

### New Context

- `ChoresContext` or integrate with existing chores data fetching pattern

## Interactions & Behavior

### Navigation

- Week view: prev/next week arrows, "Today" button to jump back
- Today view: static (always shows current day) - no date navigation needed
- Clicking an event opens the existing event details dialog

### Task Interactions

- Checkbox toggles chore completion (calls existing chores API)
- No drag-drop in Wall Hub views (that's for the full Calendar)

### Responsive Behavior

- **Desktop:** All columns visible side-by-side
- **Tablet:** Horizontal scroll for Week view, 2-column grid for Today
- **Mobile:** Single column stack, swipe between people/days

### Real-time Updates

- "NOW" indicator updates every minute
- Events refresh on window focus (revalidate pattern)

## Out of Scope (Future Enhancements)

- Creating/editing events from Wall Hub (use Calendar tab)
- Drag-drop rescheduling
- Gamification (levels, XP, streaks)

## Design References

- Week view design: `docs/design/calendar/week/calendar-week-design-1.png`
- Week view code sample: `docs/design/calendar/week/calendar-week-code-1.html`
- Today view design: `docs/design/calendar/today/calendar-today-design-1.png`
