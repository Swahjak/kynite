# Wall Hub Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Today and Week dashboard views alongside the existing calendar, creating a three-tab navigation at `/calendar/today`, `/calendar/week`, and `/calendar/full`.

**Architecture:** Nested routes under `/calendar/` with a shared layout providing `CalendarDataProvider` and `ChoresProvider`. Each tab has its own page component rendering specialized views. Wall Hub views display events and chores in card-based layouts optimized for at-a-glance family coordination.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, shadcn/ui, date-fns, next-intl

---

## Task 1: Create Route Structure

**Files:**

- Create: `src/app/[locale]/(app)/calendar/layout.tsx`
- Create: `src/app/[locale]/(app)/calendar/today/page.tsx`
- Create: `src/app/[locale]/(app)/calendar/week/page.tsx`
- Create: `src/app/[locale]/(app)/calendar/full/page.tsx`
- Modify: `src/app/[locale]/(app)/calendar/page.tsx` (redirect to /calendar/today)

**Step 1: Create the shared calendar layout**

```tsx
// src/app/[locale]/(app)/calendar/layout.tsx
import { setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/get-session";
import { getFamilyMembers } from "@/server/services/family-service";
import {
  getChoresForFamily,
  getChoreProgress,
} from "@/server/services/chore-service";
import { CalendarLayoutClient } from "./calendar-layout-client";
import type { Locale } from "@/i18n/routing";

interface CalendarLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function CalendarLayout({
  children,
  params,
}: CalendarLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();
  const familyId = session?.session.familyId;

  if (!familyId) {
    return null;
  }

  const [members, chores, progress] = await Promise.all([
    getFamilyMembers(familyId),
    getChoresForFamily(familyId, { status: "pending" }),
    getChoreProgress(familyId),
  ]);

  return (
    <CalendarLayoutClient
      familyId={familyId}
      members={members}
      initialChores={chores}
      initialProgress={progress}
    >
      {children}
    </CalendarLayoutClient>
  );
}
```

**Step 2: Create the client layout wrapper**

```tsx
// src/app/[locale]/(app)/calendar/calendar-layout-client.tsx
"use client";

import type { ReactNode } from "react";
import { CalendarDataProvider } from "@/components/calendar/providers/calendar-data-provider";
import { CalendarProvider } from "@/components/calendar/contexts/calendar-context";
import { ChoresProvider } from "@/components/chores/contexts/chores-context";
import { useCalendarData } from "@/components/calendar/providers/calendar-data-provider";
import { WallHubHeader } from "@/components/wall-hub/wall-hub-header";
import type { FamilyMemberWithUser } from "@/types/family";
import type { IChoreWithAssignee, IChoreProgress } from "@/types/chore";

interface CalendarLayoutClientProps {
  familyId: string;
  members: FamilyMemberWithUser[];
  initialChores: IChoreWithAssignee[];
  initialProgress: IChoreProgress;
  children: ReactNode;
}

function CalendarLayoutInner({ children }: { children: ReactNode }) {
  const { events, users } = useCalendarData();

  return (
    <CalendarProvider users={users} events={events}>
      <div className="flex h-full flex-col">
        <WallHubHeader />
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </CalendarProvider>
  );
}

export function CalendarLayoutClient({
  familyId,
  members,
  initialChores,
  initialProgress,
  children,
}: CalendarLayoutClientProps) {
  return (
    <CalendarDataProvider familyId={familyId} members={members}>
      <ChoresProvider
        familyId={familyId}
        initialChores={initialChores}
        initialProgress={initialProgress}
        members={members}
      >
        <CalendarLayoutInner>{children}</CalendarLayoutInner>
      </ChoresProvider>
    </CalendarDataProvider>
  );
}
```

**Step 3: Create placeholder page files**

```tsx
// src/app/[locale]/(app)/calendar/today/page.tsx
import { TodayView } from "@/components/wall-hub/today/today-view";

export default function TodayPage() {
  return <TodayView />;
}
```

```tsx
// src/app/[locale]/(app)/calendar/week/page.tsx
import { WeekView } from "@/components/wall-hub/week/week-view";

export default function WeekPage() {
  return <WeekView />;
}
```

```tsx
// src/app/[locale]/(app)/calendar/full/page.tsx
import { CalendarPageClient } from "../calendar-page-client";

export default function FullCalendarPage() {
  return <CalendarPageClient />;
}
```

**Step 4: Update the root calendar page to redirect**

```tsx
// src/app/[locale]/(app)/calendar/page.tsx
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CalendarPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);
  redirect(`/${locale}/calendar/today`);
}
```

**Step 5: Verify route structure**

Run: `ls -la src/app/\[locale\]/\(app\)/calendar/`
Expected: layout.tsx, calendar-layout-client.tsx, page.tsx, today/, week/, full/

**Step 6: Commit**

```bash
git add src/app/\[locale\]/\(app\)/calendar/
git commit -m "feat(wall-hub): add route structure for today/week/full tabs"
```

---

## Task 2: Create Wall Hub Header with Tab Navigation

**Files:**

- Create: `src/components/wall-hub/wall-hub-header.tsx`
- Modify: `messages/en.json` (add WallHub translations)
- Modify: `messages/nl.json` (add WallHub translations)

**Step 1: Create the header component**

```tsx
// src/components/wall-hub/wall-hub-header.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { CalendarDays, CalendarRange, Calendar } from "lucide-react";

const tabs = [
  { href: "/calendar/today", icon: CalendarDays, labelKey: "today" },
  { href: "/calendar/week", icon: CalendarRange, labelKey: "week" },
  { href: "/calendar/full", icon: Calendar, labelKey: "calendar" },
] as const;

export function WallHubHeader() {
  const pathname = usePathname();
  const t = useTranslations("WallHub");

  // Extract the path without locale prefix
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}/, "");

  return (
    <div className="bg-background border-b px-4 py-3">
      <div className="flex items-center justify-center">
        <nav className="bg-muted inline-flex gap-1 rounded-lg p-1">
          {tabs.map(({ href, icon: Icon, labelKey }) => {
            const isActive = pathWithoutLocale.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
```

**Step 2: Add translations to en.json**

Add to `messages/en.json` after the "Menu" section:

```json
"WallHub": {
  "today": "Today",
  "week": "Week",
  "calendar": "Calendar",
  "schedule": "Schedule",
  "tasks": "Tasks",
  "freeDay": "Free Day!",
  "noScheduledEvents": "No scheduled events",
  "done": "Done"
}
```

**Step 3: Add translations to nl.json**

Add to `messages/nl.json` after the "Menu" section:

```json
"WallHub": {
  "today": "Vandaag",
  "week": "Week",
  "calendar": "Kalender",
  "schedule": "Schema",
  "tasks": "Taken",
  "freeDay": "Vrije dag!",
  "noScheduledEvents": "Geen geplande evenementen",
  "done": "Klaar"
}
```

**Step 4: Run lint to verify**

Run: `pnpm lint`
Expected: No errors related to new files

**Step 5: Commit**

```bash
git add src/components/wall-hub/wall-hub-header.tsx messages/en.json messages/nl.json
git commit -m "feat(wall-hub): add tab navigation header"
```

---

## Task 3: Create Today View - Person Column Component

**Files:**

- Create: `src/components/wall-hub/today/person-column.tsx`
- Create: `src/components/wall-hub/shared/schedule-card.tsx`
- Create: `src/components/wall-hub/shared/task-checkbox.tsx`

**Step 1: Create the schedule card component**

```tsx
// src/components/wall-hub/shared/schedule-card.tsx
"use client";

import { format, isWithinInterval, parseISO } from "date-fns";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { IEvent } from "@/components/calendar/interfaces";

interface ScheduleCardProps {
  event: IEvent;
  showNowBadge?: boolean;
}

const colorClasses: Record<string, string> = {
  blue: "border-l-blue-500 bg-blue-50 dark:bg-blue-950/30",
  green: "border-l-green-500 bg-green-50 dark:bg-green-950/30",
  red: "border-l-red-500 bg-red-50 dark:bg-red-950/30",
  yellow: "border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/30",
  purple: "border-l-purple-500 bg-purple-50 dark:bg-purple-950/30",
  orange: "border-l-orange-500 bg-orange-50 dark:bg-orange-950/30",
};

export function ScheduleCard({ event, showNowBadge }: ScheduleCardProps) {
  const startDate = parseISO(event.startDate);
  const endDate = parseISO(event.endDate);
  const now = new Date();

  const isNow = isWithinInterval(now, { start: startDate, end: endDate });
  const timeDisplay = format(startDate, "h:mm a");

  return (
    <div
      className={cn(
        "rounded-lg border-l-4 p-3",
        colorClasses[event.color] || colorClasses.blue
      )}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-muted-foreground text-xs font-medium">
          {timeDisplay}
        </span>
        {showNowBadge && isNow && (
          <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
            NOW
          </span>
        )}
      </div>
      <p className="text-sm font-semibold">{event.title}</p>
      {event.description && (
        <div className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
          <MapPin className="size-3" />
          <span>{event.description}</span>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Create the task checkbox component**

```tsx
// src/components/wall-hub/shared/task-checkbox.tsx
"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { IChoreWithAssignee } from "@/types/chore";

interface TaskCheckboxProps {
  chore: IChoreWithAssignee;
  onComplete: (choreId: string) => void;
  disabled?: boolean;
}

export function TaskCheckbox({
  chore,
  onComplete,
  disabled,
}: TaskCheckboxProps) {
  const isCompleted = chore.status === "completed";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
      <Checkbox
        checked={isCompleted}
        disabled={disabled || isCompleted}
        onCheckedChange={() => onComplete(chore.id)}
        className="size-5"
      />
      <span
        className={cn(
          "text-sm font-medium",
          isCompleted && "text-muted-foreground line-through"
        )}
      >
        {chore.title}
      </span>
    </div>
  );
}
```

**Step 3: Create the person column component**

```tsx
// src/components/wall-hub/today/person-column.tsx
"use client";

import { useMemo } from "react";
import { isToday, parseISO, compareAsc } from "date-fns";
import { useTranslations } from "next-intl";
import { PartyPopper } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScheduleCard } from "@/components/wall-hub/shared/schedule-card";
import { TaskCheckbox } from "@/components/wall-hub/shared/task-checkbox";
import type { IEvent, IUser } from "@/components/calendar/interfaces";
import type { IChoreWithAssignee } from "@/types/chore";

interface PersonColumnProps {
  user: IUser;
  events: IEvent[];
  chores: IChoreWithAssignee[];
  onCompleteChore: (choreId: string) => void;
}

export function PersonColumn({
  user,
  events,
  chores,
  onCompleteChore,
}: PersonColumnProps) {
  const t = useTranslations("WallHub");

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
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarImage src={user.avatarUrl} alt={user.name} />
            <AvatarFallback style={{ backgroundColor: user.avatarColor }}>
              {user.avatarFallback}
            </AvatarFallback>
          </Avatar>
          <span className="text-lg font-semibold">{user.name}</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {hasNoContent ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <PartyPopper className="text-muted-foreground size-12" />
            <p className="text-muted-foreground text-sm font-medium">
              {t("freeDay")}
            </p>
            <p className="text-muted-foreground text-xs">
              {t("noScheduledEvents")}
            </p>
          </div>
        ) : (
          <>
            {todayEvents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  {t("schedule")}
                </h4>
                <div className="space-y-2">
                  {todayEvents.map((event) => (
                    <ScheduleCard key={event.id} event={event} showNowBadge />
                  ))}
                </div>
              </div>
            )}
            {userChores.length > 0 && (
              <div className="mt-auto space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {t("tasks")}
                  </h4>
                  <span className="text-muted-foreground text-xs">
                    {userChores.filter((c) => c.status === "completed").length}/
                    {userChores.length} {t("done")}
                  </span>
                </div>
                <div className="space-y-2">
                  {userChores.map((chore) => (
                    <TaskCheckbox
                      key={chore.id}
                      chore={chore}
                      onComplete={onCompleteChore}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 4: Run type check**

Run: `pnpm lint`
Expected: No type errors

**Step 5: Commit**

```bash
git add src/components/wall-hub/
git commit -m "feat(wall-hub): add person column and shared components"
```

---

## Task 4: Create Today View Main Component

**Files:**

- Create: `src/components/wall-hub/today/today-view.tsx`
- Create: `src/components/wall-hub/index.ts`

**Step 1: Create the today view component**

```tsx
// src/components/wall-hub/today/today-view.tsx
"use client";

import { useCalendar } from "@/components/calendar/contexts/calendar-context";
import { useChores } from "@/components/chores/contexts/chores-context";
import { PersonColumn } from "./person-column";

export function TodayView() {
  const { users, events } = useCalendar();
  const { chores, completeChore } = useChores();

  return (
    <div className="h-full overflow-auto p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
  );
}
```

**Step 2: Create the index barrel file**

```tsx
// src/components/wall-hub/index.ts
export { WallHubHeader } from "./wall-hub-header";
export { TodayView } from "./today/today-view";
export { WeekView } from "./week/week-view";
```

**Step 3: Run type check**

Run: `pnpm lint`
Expected: No errors (WeekView export will error until Task 5)

**Step 4: Commit**

```bash
git add src/components/wall-hub/
git commit -m "feat(wall-hub): add Today view with person columns"
```

---

## Task 5: Create Week View Components

**Files:**

- Create: `src/components/wall-hub/week/week-view.tsx`
- Create: `src/components/wall-hub/week/day-column.tsx`
- Create: `src/components/wall-hub/week/day-header.tsx`
- Create: `src/components/wall-hub/shared/person-filter-chips.tsx`

**Step 1: Create day header component**

```tsx
// src/components/wall-hub/week/day-header.tsx
"use client";

import { format, isToday } from "date-fns";
import { cn } from "@/lib/utils";

interface DayHeaderProps {
  date: Date;
}

export function DayHeader({ date }: DayHeaderProps) {
  const dayIsToday = isToday(date);

  return (
    <div
      className={cn(
        "rounded-xl border p-3 text-center",
        dayIsToday
          ? "border-primary bg-primary/10 border-2"
          : "bg-card border-border"
      )}
    >
      <p
        className={cn(
          "text-sm font-medium tracking-wide uppercase",
          dayIsToday ? "text-primary" : "text-muted-foreground"
        )}
      >
        {format(date, "EEE")}
      </p>
      <p
        className={cn(
          "text-2xl font-bold",
          dayIsToday ? "text-foreground" : "text-foreground"
        )}
      >
        {format(date, "d")}
      </p>
      {dayIsToday && (
        <span className="bg-primary text-primary-foreground mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold">
          TODAY
        </span>
      )}
    </div>
  );
}
```

**Step 2: Create day column component**

```tsx
// src/components/wall-hub/week/day-column.tsx
"use client";

import { useMemo } from "react";
import { isSameDay, parseISO, compareAsc, isPast, isToday } from "date-fns";
import { ScheduleCard } from "@/components/wall-hub/shared/schedule-card";
import { TaskCheckbox } from "@/components/wall-hub/shared/task-checkbox";
import { DayHeader } from "./day-header";
import { cn } from "@/lib/utils";
import type { IEvent } from "@/components/calendar/interfaces";
import type { IChoreWithAssignee } from "@/types/chore";

interface DayColumnProps {
  date: Date;
  events: IEvent[];
  chores: IChoreWithAssignee[];
  onCompleteChore: (choreId: string) => void;
}

export function DayColumn({
  date,
  events,
  chores,
  onCompleteChore,
}: DayColumnProps) {
  // Filter events for this specific day
  const dayEvents = useMemo(() => {
    return events
      .filter((event) => isSameDay(parseISO(event.startDate), date))
      .sort((a, b) => compareAsc(parseISO(a.startDate), parseISO(b.startDate)));
  }, [events, date]);

  // Filter chores due on this day
  const dayChores = useMemo(() => {
    return chores.filter((chore) => {
      if (!chore.dueDate) return false;
      return isSameDay(parseISO(chore.dueDate), date);
    });
  }, [chores, date]);

  const isPastDay = isPast(date) && !isToday(date);

  return (
    <div className={cn("flex flex-col gap-3", isPastDay && "opacity-60")}>
      <DayHeader date={date} />
      <div className="bg-muted/30 flex flex-1 flex-col gap-2 rounded-xl p-2">
        {dayEvents.map((event) => (
          <ScheduleCard
            key={event.id}
            event={event}
            showNowBadge={isToday(date)}
          />
        ))}
        {dayChores.length > 0 && (
          <div className="mt-auto space-y-2">
            {dayChores.map((chore) => (
              <TaskCheckbox
                key={chore.id}
                chore={chore}
                onComplete={onCompleteChore}
              />
            ))}
          </div>
        )}
        {dayEvents.length === 0 && dayChores.length === 0 && (
          <div className="text-muted-foreground flex flex-1 items-center justify-center text-xs">
            No events
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 3: Create person filter chips component**

```tsx
// src/components/wall-hub/shared/person-filter-chips.tsx
"use client";

import { Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { IUser } from "@/components/calendar/interfaces";

interface PersonFilterChipsProps {
  users: IUser[];
  selectedUserId: string | "all";
  onSelect: (userId: string | "all") => void;
}

export function PersonFilterChips({
  users,
  selectedUserId,
  onSelect,
}: PersonFilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect("all")}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
          selectedUserId === "all"
            ? "bg-foreground text-background"
            : "bg-background hover:bg-muted border"
        )}
      >
        <Users className="size-4" />
        Everyone
      </button>
      {users.map((user) => (
        <button
          key={user.id}
          onClick={() => onSelect(user.id)}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-full pr-4 pl-1.5 text-sm font-medium transition-colors",
            selectedUserId === user.id
              ? "bg-foreground text-background"
              : "bg-background hover:bg-muted border"
          )}
        >
          <Avatar className="size-7">
            <AvatarImage src={user.avatarUrl} alt={user.name} />
            <AvatarFallback
              style={{ backgroundColor: user.avatarColor }}
              className="text-xs"
            >
              {user.avatarFallback}
            </AvatarFallback>
          </Avatar>
          {user.name}
        </button>
      ))}
    </div>
  );
}
```

**Step 4: Create week view component**

```tsx
// src/components/wall-hub/week/week-view.tsx
"use client";

import { useMemo, useState } from "react";
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  format,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCalendar } from "@/components/calendar/contexts/calendar-context";
import { useChores } from "@/components/chores/contexts/chores-context";
import { DayColumn } from "./day-column";
import { PersonFilterChips } from "@/components/wall-hub/shared/person-filter-chips";

export function WeekView() {
  const { users, events, selectedUserId, filterEventsBySelectedUser } =
    useCalendar();
  const { chores, completeChore } = useChores();
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const filteredEvents = useMemo(() => {
    if (selectedUserId === "all") return events;
    return events.filter((event) =>
      event.users.some((u) => u.id === selectedUserId)
    );
  }, [events, selectedUserId]);

  const goToPreviousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const goToNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      {/* Header with navigation and filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="size-5" />
          </Button>
          <h2 className="text-xl font-bold lg:text-2xl">
            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d")}
          </h2>
          <Button variant="ghost" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="size-5" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        </div>
        <PersonFilterChips
          users={users}
          selectedUserId={selectedUserId}
          onSelect={filterEventsBySelectedUser}
        />
      </div>

      {/* Week grid */}
      <div className="flex-1 overflow-x-auto">
        <div className="grid min-w-[800px] grid-cols-7 gap-4">
          {weekDays.map((day) => (
            <DayColumn
              key={day.toISOString()}
              date={day}
              events={filteredEvents}
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

**Step 5: Update barrel export**

Update `src/components/wall-hub/index.ts` to include WeekView (already done in Step 2 of Task 4).

**Step 6: Run lint**

Run: `pnpm lint`
Expected: No errors

**Step 7: Commit**

```bash
git add src/components/wall-hub/
git commit -m "feat(wall-hub): add Week view with day columns and person filters"
```

---

## Task 6: Update Calendar Page Client for Full View

**Files:**

- Modify: `src/app/[locale]/(app)/calendar/calendar-page-client.tsx`

**Step 1: Simplify calendar page client**

The calendar page client no longer needs to fetch data (layout does that). Update it:

```tsx
// src/app/[locale]/(app)/calendar/calendar-page-client.tsx
"use client";

import { Calendar } from "@/components/calendar/calendar";

export function CalendarPageClient() {
  return <Calendar />;
}
```

**Step 2: Verify the calendar still renders**

Run: `pnpm dev`
Navigate to: `http://localhost:3000/en/calendar/full`
Expected: Full calendar renders with all views

**Step 3: Commit**

```bash
git add src/app/\[locale\]/\(app\)/calendar/calendar-page-client.tsx
git commit -m "refactor(calendar): simplify page client for new layout structure"
```

---

## Task 7: Add Navigation Menu Link Updates

**Files:**

- Modify: `src/components/layout/navigation-menu.tsx`

**Step 1: Update calendar link to point to /calendar/today**

Find the calendar menu item and update its href from `/calendar` to `/calendar/today`:

```tsx
// In the menuItems array, update:
{ href: "/calendar/today", icon: Calendar, labelKey: "calendar" },
```

**Step 2: Verify navigation works**

Run: `pnpm dev`
Click "Calendar" in nav menu
Expected: Navigates to `/calendar/today` with Today view visible

**Step 3: Commit**

```bash
git add src/components/layout/navigation-menu.tsx
git commit -m "fix(nav): update calendar link to new today route"
```

---

## Task 8: Integration Testing

**Files:**

- No new files, manual verification

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Test Today view**

Navigate to: `http://localhost:3000/en/calendar/today`
Verify:

- [ ] Family members display as columns
- [ ] Today's events show in correct columns
- [ ] Chores appear with checkboxes
- [ ] Completing a chore updates the list

**Step 3: Test Week view**

Navigate to: `http://localhost:3000/en/calendar/week`
Verify:

- [ ] 7 day columns (Mon-Sun) display
- [ ] Today is highlighted
- [ ] Week navigation arrows work
- [ ] Person filter chips filter events
- [ ] "Today" button returns to current week

**Step 4: Test Full Calendar**

Navigate to: `http://localhost:3000/en/calendar/full`
Verify:

- [ ] Existing calendar functionality works
- [ ] All view tabs (day/week/month/year/agenda) work
- [ ] Events display correctly

**Step 5: Test tab switching**

Verify:

- [ ] Clicking tabs navigates between views
- [ ] Active tab is highlighted
- [ ] Back button works correctly

**Step 6: Run all tests**

Run: `pnpm test:run`
Expected: All tests pass (minus pre-existing failures)

**Step 7: Final commit**

```bash
git add -A
git commit -m "feat(wall-hub): complete Today and Week dashboard views"
```

---

## Summary

After completing all tasks, you will have:

1. **Route structure**: `/calendar/today`, `/calendar/week`, `/calendar/full`
2. **Shared layout**: Provides calendar events, users, and chores to all child routes
3. **Tab navigation**: Header with Today/Week/Calendar tabs
4. **Today view**: Person columns showing each family member's schedule and tasks
5. **Week view**: Day columns with events and chores, person filtering, week navigation
6. **Full calendar**: Existing calendar with all views preserved

The Wall Hub views integrate with existing `CalendarContext` and `ChoresContext`, reusing data fetching and mutations while providing a new at-a-glance UI.
