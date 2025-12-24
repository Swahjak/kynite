# Today View & Week View Design Alignment

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Align the Today view design with the Week view for consistent visual language across the wall-hub calendar views.

**Architecture:** Create a shared `PersonHeader` component mirroring `DayHeader`, replace Card-based layout with header+content structure matching Week's `DayColumn`, and unify empty state messaging.

**Tech Stack:** React components, Tailwind CSS, existing shared components (ScheduleCard, TaskCheckbox, user-colors)

---

## Identified Issues

| Issue                 | Today (current)              | Week (target)                          |
| --------------------- | ---------------------------- | -------------------------------------- |
| Column structure      | Card wrapping everything     | Separate header + content area         |
| Header component      | Avatar+name in CardHeader    | Dedicated DayHeader with styled box    |
| Background colors     | Card bg (white/dark)         | `bg-primary/5` (today) / `bg-muted/30` |
| Content border-radius | Card's border-radius         | `rounded-xl` on content area           |
| Section labels        | Shows "Schedule" and "Tasks" | No section labels                      |
| Task counter          | Shows "X/Y done"             | No counter                             |
| Empty state           | PartyPopper + 2 messages     | Simple "No events" text                |
| Person filtering      | None                         | Has PersonFilterChips                  |
| Navigation            | None                         | Prev/Next week buttons                 |

---

## Task 1: Create PersonHeader Component

**Files:**

- Create: `src/components/wall-hub/shared/person-header.tsx`
- Test: Visual verification in browser

**Step 1: Create the PersonHeader component**

Create component matching DayHeader's visual style but for person/user:

```tsx
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { IUser } from "@/components/calendar/interfaces";
import { getUserColorById } from "./user-colors";

interface PersonHeaderProps {
  user: IUser;
  isHighlighted?: boolean;
}

export function PersonHeader({ user, isHighlighted }: PersonHeaderProps) {
  const color = getUserColorById(user.id);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3",
        isHighlighted
          ? `border-2 ${color.border} ${color.bg}`
          : "bg-card border-border"
      )}
    >
      <Avatar className="size-10">
        <AvatarImage src={user.avatarUrl} alt={user.name} />
        <AvatarFallback style={{ backgroundColor: user.avatarColor }}>
          {user.avatarFallback}
        </AvatarFallback>
      </Avatar>
      <span className="text-lg font-semibold">{user.name}</span>
    </div>
  );
}
```

**Step 2: Verify component exports correctly**

Run: `pnpm build`
Expected: Build passes without errors

**Step 3: Commit**

```bash
git add src/components/wall-hub/shared/person-header.tsx
git commit -m "feat(wall-hub): add PersonHeader component matching DayHeader style"
```

---

## Task 2: Refactor PersonColumn to Match DayColumn Structure

**Files:**

- Modify: `src/components/wall-hub/today/person-column.tsx`

**Step 1: Update PersonColumn to use new structure**

Replace the Card-based layout with header+content structure:

```tsx
"use client";

import { useMemo } from "react";
import { isToday, parseISO, compareAsc } from "date-fns";
import { PersonHeader } from "@/components/wall-hub/shared/person-header";
import { ScheduleCard } from "@/components/wall-hub/shared/schedule-card";
import { TaskCheckbox } from "@/components/wall-hub/shared/task-checkbox";
import { cn } from "@/lib/utils";
import type { IEvent, IUser } from "@/components/calendar/interfaces";
import type { IChoreWithAssignee } from "@/types/chore";

interface PersonColumnProps {
  user: IUser;
  events: IEvent[];
  chores: IChoreWithAssignee[];
  onCompleteChore: (choreId: string) => void;
  isHighlighted?: boolean;
}

export function PersonColumn({
  user,
  events,
  chores,
  onCompleteChore,
  isHighlighted = true,
}: PersonColumnProps) {
  // Filter events for today that include this user
  const todayEvents = useMemo(() => {
    return events
      .filter((event) => {
        const startDate = parseISO(event.startDate);
        return isToday(startDate) && event.users.some((u) => u.id === user.id);
      })
      .sort((a, b) => compareAsc(parseISO(a.startDate), parseISO(b.startDate)));
  }, [events, user.id]);

  // Filter chores assigned to this user
  const userChores = useMemo(() => {
    return chores.filter((chore) => chore.assignedToId === user.id);
  }, [chores, user.id]);

  const hasNoContent = todayEvents.length === 0 && userChores.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <PersonHeader user={user} isHighlighted={isHighlighted} />
      <div
        className={cn(
          "flex flex-1 flex-col gap-2 rounded-xl p-3",
          isHighlighted ? "bg-primary/5 dark:bg-primary/10" : "bg-muted/30"
        )}
      >
        {todayEvents.map((event) => (
          <ScheduleCard key={event.id} event={event} showNowBadge />
        ))}
        {userChores.length > 0 && (
          <div className="mt-auto space-y-2">
            {userChores.map((chore) => (
              <TaskCheckbox
                key={chore.id}
                chore={chore}
                onComplete={onCompleteChore}
              />
            ))}
          </div>
        )}
        {hasNoContent && (
          <div className="text-muted-foreground flex flex-1 items-center justify-center text-xs">
            No events
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify the build passes**

Run: `pnpm build`
Expected: Build passes

**Step 3: Verify type-check passes**

Run: `pnpm lint`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/wall-hub/today/person-column.tsx
git commit -m "refactor(wall-hub): align PersonColumn layout with DayColumn structure"
```

---

## Task 3: Update TodayView Container Styling

**Files:**

- Modify: `src/components/wall-hub/today/today-view.tsx`

**Step 1: Update container classes to match WeekView**

```tsx
"use client";

import { useCalendar } from "@/components/calendar/contexts/calendar-context";
import { useChores } from "@/components/chores/contexts/chores-context";
import { PersonColumn } from "./person-column";

export function TodayView() {
  const { users, events } = useCalendar();
  const { chores, completeChore } = useChores();

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      {/* Desktop grid */}
      <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="grid min-w-[600px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {users.map((user) => (
            <PersonColumn
              key={user.id}
              user={user}
              events={events}
              chores={chores}
              onCompleteChore={completeChore}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify the build passes**

Run: `pnpm build`
Expected: Build passes

**Step 3: Commit**

```bash
git add src/components/wall-hub/today/today-view.tsx
git commit -m "refactor(wall-hub): align TodayView container with WeekView styling"
```

---

## Task 4: Add Person Filter to TodayView

**Files:**

- Modify: `src/components/wall-hub/today/today-view.tsx`

**Step 1: Add PersonFilterChips for filtering**

```tsx
"use client";

import { useMemo } from "react";
import { useCalendar } from "@/components/calendar/contexts/calendar-context";
import { useChores } from "@/components/chores/contexts/chores-context";
import { PersonColumn } from "./person-column";
import { PersonFilterChips } from "@/components/wall-hub/shared/person-filter-chips";

export function TodayView() {
  const { users, events, selectedUserId, filterEventsBySelectedUser } =
    useCalendar();
  const { chores, completeChore } = useChores();

  // Filter users based on selection
  const displayedUsers = useMemo(() => {
    if (selectedUserId === "all") return users;
    return users.filter((user) => user.id === selectedUserId);
  }, [users, selectedUserId]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      {/* Header with filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <PersonFilterChips
          users={users}
          selectedUserId={selectedUserId}
          onSelect={filterEventsBySelectedUser}
        />
      </div>

      {/* Person columns grid */}
      <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="grid min-w-[600px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {displayedUsers.map((user) => (
            <PersonColumn
              key={user.id}
              user={user}
              events={events}
              chores={chores}
              onCompleteChore={completeChore}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify the build passes**

Run: `pnpm build`
Expected: Build passes

**Step 3: Commit**

```bash
git add src/components/wall-hub/today/today-view.tsx
git commit -m "feat(wall-hub): add person filtering to TodayView matching WeekView"
```

---

## Task 5: Visual Verification

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Navigate to Today view**

Open: `http://localhost:3000/nl/calendar/today`

**Step 3: Compare with Week view**

Open: `http://localhost:3000/nl/calendar/week`

**Verify:**

- [ ] PersonHeader has same rounded-xl border style as DayHeader
- [ ] Content area has same `bg-primary/5` or `bg-muted/30` backgrounds
- [ ] ScheduleCard renders identically in both views
- [ ] TaskCheckbox renders identically in both views
- [ ] Empty state shows "No events" text (not PartyPopper icon)
- [ ] PersonFilterChips appears and functions correctly

**Step 4: Final commit (if any adjustments needed)**

```bash
git add -A
git commit -m "fix(wall-hub): polish today-week alignment after visual review"
```

---

## Summary of Changes

| Component      | Before                          | After                          |
| -------------- | ------------------------------- | ------------------------------ |
| PersonColumn   | Card + CardHeader + CardContent | PersonHeader + content div     |
| Empty state    | PartyPopper + messages          | Simple "No events"             |
| Section labels | "Schedule", "Tasks"             | Removed                        |
| Task counter   | "X/Y done"                      | Removed                        |
| Person filter  | None                            | PersonFilterChips              |
| Container bg   | Card bg                         | `bg-primary/5` / `bg-muted/30` |

## Files Modified

- `src/components/wall-hub/shared/person-header.tsx` (new)
- `src/components/wall-hub/today/person-column.tsx` (modified)
- `src/components/wall-hub/today/today-view.tsx` (modified)
