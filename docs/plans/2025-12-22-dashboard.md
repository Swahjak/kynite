# Dashboard Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the dashboard home screen that displays clock, today's events, active timers, weekly stars leaderboard, and quick actions.

**Architecture:** Server component fetches data, passes to DashboardProvider context. Client components consume via `useDashboard()` hook. Uses mock data for features not yet implemented (timers, stars, weather).

**Tech Stack:** Next.js 16, React 19, shadcn/ui, Tailwind CSS, next-intl

---

## Phase 1: Foundation

### Task 1: Define Dashboard Types

**Files:**

- Create: `src/components/dashboard/types.ts`

**Step 1: Create types file**

```typescript
export type EventState = "NOW" | "NEXT" | "LATER";

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
  timerDuration?: number;
}

export interface DashboardData {
  familyName: string;
  todaysEvents: DashboardEvent[];
  activeTimers: Timer[];
  familyMembers: FamilyMemberStar[];
  quickActions: QuickAction[];
}
```

**Step 2: Verify file compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/dashboard/types.ts
git commit -m "feat(dashboard): add type definitions"
```

---

### Task 2: Create Mock Data

**Files:**

- Create: `src/components/dashboard/mocks.ts`

**Step 1: Write mock data file**

```typescript
import type {
  DashboardData,
  DashboardEvent,
  Timer,
  FamilyMemberStar,
  QuickAction,
} from "./types";

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

export const MOCK_EVENTS: DashboardEvent[] = [
  {
    id: "1",
    title: "Zwemles",
    startTime: new Date(today.getTime() + 9 * 60 * 60 * 1000), // 9:00
    endTime: new Date(today.getTime() + 10 * 60 * 60 * 1000), // 10:00
    location: "Sportcentrum De Kuil",
    category: "sports",
  },
  {
    id: "2",
    title: "Huiswerk maken",
    startTime: new Date(today.getTime() + 14 * 60 * 60 * 1000), // 14:00
    endTime: new Date(today.getTime() + 15 * 60 * 60 * 1000), // 15:00
    category: "school",
  },
  {
    id: "3",
    title: "Avondeten",
    startTime: new Date(today.getTime() + 18 * 60 * 60 * 1000), // 18:00
    endTime: new Date(today.getTime() + 19 * 60 * 60 * 1000), // 19:00
    location: "Thuis",
    category: "meal",
  },
  {
    id: "4",
    title: "Voorlezen",
    startTime: new Date(today.getTime() + 19.5 * 60 * 60 * 1000), // 19:30
    endTime: new Date(today.getTime() + 20 * 60 * 60 * 1000), // 20:00
    category: "reading",
  },
];

export const MOCK_TIMERS: Timer[] = [
  {
    id: "t1",
    title: "Schermtijd",
    subtitle: "iPad - Emma",
    remainingSeconds: 1200, // 20 min
    totalSeconds: 1800, // 30 min
    category: "screen",
  },
  {
    id: "t2",
    title: "Opruimen",
    subtitle: "Slaapkamer",
    remainingSeconds: 540, // 9 min
    totalSeconds: 900, // 15 min
    category: "chore",
  },
];

export const MOCK_FAMILY_MEMBERS: FamilyMemberStar[] = [
  {
    id: "m1",
    name: "Emma",
    avatarColor: "purple",
    weeklyStarCount: 24,
    level: 2,
    levelTitle: "Explorer",
  },
  {
    id: "m2",
    name: "Lucas",
    avatarColor: "blue",
    weeklyStarCount: 18,
    level: 1,
    levelTitle: "Beginner",
  },
  {
    id: "m3",
    name: "Sophie",
    avatarColor: "pink",
    weeklyStarCount: 31,
    level: 3,
    levelTitle: "Artist",
  },
];

export const MOCK_QUICK_ACTIONS: QuickAction[] = [
  {
    id: "qa1",
    label: "Etenstijd",
    icon: "Utensils",
    category: "meal",
    timerDuration: 1800,
  },
  {
    id: "qa2",
    label: "Planten water",
    icon: "Droplets",
    category: "chore",
    timerDuration: 300,
  },
  {
    id: "qa3",
    label: "15m Opruimen",
    icon: "Sparkles",
    category: "chore",
    timerDuration: 900,
  },
  { id: "qa4", label: "Klusje loggen", icon: "CheckCircle", category: "log" },
];

export const MOCK_DASHBOARD_DATA: DashboardData = {
  familyName: "Familie de Vries",
  todaysEvents: MOCK_EVENTS,
  activeTimers: MOCK_TIMERS,
  familyMembers: MOCK_FAMILY_MEMBERS,
  quickActions: MOCK_QUICK_ACTIONS,
};
```

**Step 2: Verify imports work**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/dashboard/mocks.ts
git commit -m "feat(dashboard): add mock data"
```

---

## Phase 2: Context & Hooks

### Task 3: Create Dashboard Hooks

**Files:**

- Create: `src/components/dashboard/hooks.ts`

**Step 1: Write hooks file**

```typescript
"use client";

import { useState, useEffect } from "react";

export function useClock(updateInterval = 1000): Date {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, updateInterval);

    return () => clearInterval(timer);
  }, [updateInterval]);

  return time;
}

export type TimeOfDay = "morning" | "afternoon" | "evening";

export function useGreeting(currentTime: Date): TimeOfDay {
  const hour = currentTime.getHours();

  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}
```

**Step 2: Verify file compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/dashboard/hooks.ts
git commit -m "feat(dashboard): add useClock and useGreeting hooks"
```

---

### Task 4: Create Dashboard Context

**Files:**

- Create: `src/components/dashboard/contexts/dashboard-context.tsx`

**Step 1: Write context file**

```typescript
"use client";

import {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import type {
  DashboardData,
  DashboardEvent,
  Timer,
  FamilyMemberStar,
  QuickAction,
  EventState,
} from "../types";
import { useClock } from "../hooks";

function getEventState(event: DashboardEvent, currentTime: Date): EventState {
  const now = currentTime.getTime();
  const start = event.startTime.getTime();
  const end = event.endTime.getTime();

  if (now >= start && now < end) return "NOW";
  if (now < start) return "NEXT"; // Will be refined in context
  return "LATER";
}

interface IDashboardContext {
  familyName: string;
  currentTime: Date;
  todaysEvents: DashboardEvent[];
  activeTimers: Timer[];
  familyMembers: FamilyMemberStar[];
  quickActions: QuickAction[];
  nowEvent: DashboardEvent | null;
  nextEvent: DashboardEvent | null;
  laterEvents: DashboardEvent[];
  eventsRemaining: number;
  startQuickAction: (actionId: string) => void;
  pauseTimer: (timerId: string) => void;
  extendTimer: (timerId: string, seconds: number) => void;
}

const DashboardContext = createContext<IDashboardContext | null>(null);

interface DashboardProviderProps {
  data: DashboardData;
  children: ReactNode;
}

export function DashboardProvider({ data, children }: DashboardProviderProps) {
  const currentTime = useClock();
  const [timers, setTimers] = useState(data.activeTimers);

  const categorizedEvents = useMemo(() => {
    const now = currentTime.getTime();
    const upcoming = data.todaysEvents
      .filter((e) => e.endTime.getTime() > now)
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    const nowEvent = upcoming.find((e) => {
      const start = e.startTime.getTime();
      const end = e.endTime.getTime();
      return now >= start && now < end;
    }) || null;

    const futureEvents = upcoming.filter((e) => e.startTime.getTime() > now);
    const nextEvent = futureEvents[0] || null;
    const laterEvents = futureEvents.slice(1);

    return { nowEvent, nextEvent, laterEvents, eventsRemaining: upcoming.length };
  }, [data.todaysEvents, currentTime]);

  const startQuickAction = (actionId: string) => {
    const action = data.quickActions.find((a) => a.id === actionId);
    if (action?.timerDuration) {
      const newTimer: Timer = {
        id: `timer-${Date.now()}`,
        title: action.label,
        subtitle: "Quick Action",
        remainingSeconds: action.timerDuration,
        totalSeconds: action.timerDuration,
        category: action.category,
      };
      setTimers((prev) => [...prev, newTimer]);
    }
  };

  const pauseTimer = (timerId: string) => {
    // Mock implementation - would integrate with real timer system
    console.log("Pause timer:", timerId);
  };

  const extendTimer = (timerId: string, seconds: number) => {
    setTimers((prev) =>
      prev.map((t) =>
        t.id === timerId
          ? { ...t, remainingSeconds: t.remainingSeconds + seconds, totalSeconds: t.totalSeconds + seconds }
          : t
      )
    );
  };

  const value: IDashboardContext = {
    familyName: data.familyName,
    currentTime,
    todaysEvents: data.todaysEvents,
    activeTimers: timers,
    familyMembers: data.familyMembers,
    quickActions: data.quickActions,
    ...categorizedEvents,
    startQuickAction,
    pauseTimer,
    extendTimer,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): IDashboardContext {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboard must be used within DashboardProvider");
  }
  return context;
}
```

**Step 2: Verify file compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/dashboard/contexts/dashboard-context.tsx
git commit -m "feat(dashboard): add DashboardProvider context"
```

---

## Phase 3: UI Components

### Task 5: Greeting & Clock Component

**Files:**

- Create: `src/components/dashboard/greeting-clock/greeting-clock.tsx`

**Step 1: Write component**

```typescript
"use client";

import { useTranslations } from "next-intl";
import { useDashboard } from "../contexts/dashboard-context";
import { useGreeting } from "../hooks";

export function GreetingClock() {
  const t = useTranslations("DashboardPage");
  const { currentTime } = useDashboard();
  const timeOfDay = useGreeting(currentTime);

  const formattedTime = currentTime.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="text-center py-8">
      <p className="text-lg text-muted-foreground mb-2">
        {t(`greeting.${timeOfDay}`)}
      </p>
      <time
        dateTime={currentTime.toISOString()}
        suppressHydrationWarning
        className="text-5xl sm:text-6xl lg:text-7xl font-bold tabular-nums tracking-tight"
      >
        {formattedTime}
      </time>
    </div>
  );
}
```

**Step 2: Verify file compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/dashboard/greeting-clock/greeting-clock.tsx
git commit -m "feat(dashboard): add GreetingClock component"
```

---

### Task 6: Today's Flow Components

**Files:**

- Create: `src/components/dashboard/todays-flow/event-card.tsx`
- Create: `src/components/dashboard/todays-flow/todays-flow.tsx`

**Step 1: Write EventCard component**

```typescript
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DashboardEvent, EventState } from "../types";

interface EventCardProps {
  event: DashboardEvent;
  state: EventState;
}

export function EventCard({ event, state }: EventCardProps) {
  const formattedTime = event.startTime.toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card
      className={cn(
        "transition-all",
        state === "NOW" && "border-l-4 border-l-primary bg-primary/5",
        state === "NEXT" && "bg-muted/50",
        state === "LATER" && "opacity-60"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "font-mono tabular-nums",
                state === "NOW" ? "text-2xl font-bold" : "text-lg"
              )}
            >
              {formattedTime}
            </p>
            <h3
              className={cn(
                "font-semibold truncate",
                state === "NOW" ? "text-xl" : "text-base"
              )}
            >
              {event.title}
            </h3>
            {event.location && (
              <p className="text-sm text-muted-foreground truncate">
                {event.location}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Write TodaysFlow component**

```typescript
"use client";

import { useTranslations } from "next-intl";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDashboard } from "../contexts/dashboard-context";
import { EventCard } from "./event-card";

export function TodaysFlow() {
  const t = useTranslations("DashboardPage.todaysFlow");
  const { nowEvent, nextEvent, laterEvents, eventsRemaining } = useDashboard();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t("title")}</h2>
        </div>
        <Badge variant="secondary">
          {t("eventsRemaining", { count: eventsRemaining })}
        </Badge>
      </div>

      <div className="space-y-3">
        {nowEvent && (
          <div>
            <p className="text-xs font-medium text-primary uppercase tracking-wide mb-1">
              {t("now")}
            </p>
            <EventCard event={nowEvent} state="NOW" />
          </div>
        )}

        {nextEvent && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              {t("next")}
            </p>
            <EventCard event={nextEvent} state="NEXT" />
          </div>
        )}

        {laterEvents.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
              {t("later")}
            </p>
            <div className="space-y-2">
              {laterEvents.map((event) => (
                <EventCard key={event.id} event={event} state="LATER" />
              ))}
            </div>
          </div>
        )}

        {!nowEvent && !nextEvent && laterEvents.length === 0 && (
          <p className="text-muted-foreground text-center py-8">
            {t("noEvents")}
          </p>
        )}
      </div>
    </section>
  );
}
```

**Step 3: Verify files compile**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/dashboard/todays-flow/
git commit -m "feat(dashboard): add TodaysFlow components"
```

---

### Task 7: Active Timers Components

**Files:**

- Create: `src/components/dashboard/active-timers/timer-card.tsx`
- Create: `src/components/dashboard/active-timers/active-timers.tsx`

**Step 1: Install Progress component if needed**

Run: `pnpm dlx shadcn@latest add progress`

**Step 2: Write TimerCard component**

```typescript
"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Pause, Plus } from "lucide-react";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { useDashboard } from "../contexts/dashboard-context";
import type { Timer } from "../types";

interface TimerCardProps {
  timer: Timer;
}

export function TimerCard({ timer }: TimerCardProps) {
  const { mode } = useInteractionMode();
  const { pauseTimer, extendTimer } = useDashboard();

  const minutes = Math.floor(timer.remainingSeconds / 60);
  const seconds = timer.remainingSeconds % 60;
  const progress = (timer.remainingSeconds / timer.totalSeconds) * 100;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold">{timer.title}</h3>
            <p className="text-sm text-muted-foreground">{timer.subtitle}</p>
          </div>
        </div>

        <div className="text-center mb-3">
          <span className="text-4xl font-bold tabular-nums">
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>
          <span className="text-sm text-muted-foreground ml-1">min</span>
        </div>

        <Progress value={progress} className="h-2 mb-3" />

        {mode === "manage" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => extendTimer(timer.id, 900)}
            >
              <Plus className="h-4 w-4 mr-1" />
              15m
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => pauseTimer(timer.id)}
            >
              <Pause className="h-4 w-4 mr-1" />
              Pauze
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 3: Write ActiveTimers component**

```typescript
"use client";

import { useTranslations } from "next-intl";
import { Timer } from "lucide-react";
import { useDashboard } from "../contexts/dashboard-context";
import { TimerCard } from "./timer-card";

export function ActiveTimers() {
  const t = useTranslations("DashboardPage.activeTimers");
  const { activeTimers } = useDashboard();

  if (activeTimers.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Timer className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold">{t("title")}</h2>
      </div>

      <div className="space-y-3">
        {activeTimers.map((timer) => (
          <TimerCard key={timer.id} timer={timer} />
        ))}
      </div>
    </section>
  );
}
```

**Step 4: Verify files compile**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/dashboard/active-timers/
git commit -m "feat(dashboard): add ActiveTimers components"
```

---

### Task 8: Weekly Stars Components

**Files:**

- Create: `src/components/dashboard/weekly-stars/member-row.tsx`
- Create: `src/components/dashboard/weekly-stars/weekly-stars.tsx`

**Step 1: Write MemberRow component**

```typescript
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FamilyMemberStar } from "../types";

interface MemberRowProps {
  member: FamilyMemberStar;
  rank: number;
}

const colorMap: Record<string, string> = {
  purple: "bg-purple-500",
  blue: "bg-blue-500",
  pink: "bg-pink-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  teal: "bg-teal-500",
};

export function MemberRow({ member, rank }: MemberRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg",
        rank === 1 && "bg-primary/5"
      )}
    >
      <div
        className={cn(
          "rounded-full p-0.5",
          rank === 1 && "ring-2 ring-primary"
        )}
      >
        <Avatar className="h-10 w-10">
          <AvatarFallback className={colorMap[member.avatarColor] || "bg-gray-500"}>
            {member.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{member.name}</p>
        <p className="text-xs text-muted-foreground">
          Level {member.level} · {member.levelTitle}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
        <span className="font-semibold tabular-nums">{member.weeklyStarCount}</span>
      </div>
    </div>
  );
}
```

**Step 2: Write WeeklyStars component**

```typescript
"use client";

import { useTranslations } from "next-intl";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "../contexts/dashboard-context";
import { MemberRow } from "./member-row";

export function WeeklyStars() {
  const t = useTranslations("DashboardPage.weeklyStars");
  const { familyMembers } = useDashboard();

  const sortedMembers = [...familyMembers].sort(
    (a, b) => b.weeklyStarCount - a.weeklyStarCount
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-5 w-5 text-muted-foreground" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-1">
          {sortedMembers.map((member, index) => (
            <MemberRow key={member.id} member={member} rank={index + 1} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Verify files compile**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/dashboard/weekly-stars/
git commit -m "feat(dashboard): add WeeklyStars components"
```

---

### Task 9: Quick Actions Components

**Files:**

- Create: `src/components/dashboard/quick-actions/action-button.tsx`
- Create: `src/components/dashboard/quick-actions/quick-actions.tsx`

**Step 1: Write ActionButton component**

```typescript
"use client";

import { Button } from "@/components/ui/button";
import {
  Utensils,
  Droplets,
  Sparkles,
  CheckCircle,
  type LucideIcon,
} from "lucide-react";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { useDashboard } from "../contexts/dashboard-context";
import type { QuickAction } from "../types";

const iconMap: Record<string, LucideIcon> = {
  Utensils,
  Droplets,
  Sparkles,
  CheckCircle,
};

interface ActionButtonProps {
  action: QuickAction;
}

export function ActionButton({ action }: ActionButtonProps) {
  const { mode } = useInteractionMode();
  const { startQuickAction } = useDashboard();

  const Icon = iconMap[action.icon] || CheckCircle;
  const isDisabled = mode === "wall";

  return (
    <Button
      variant="outline"
      className="h-20 flex-col gap-1 active:scale-95 transition-transform"
      disabled={isDisabled}
      onClick={() => startQuickAction(action.id)}
    >
      <Icon className="h-6 w-6" />
      <span className="text-xs font-medium">{action.label}</span>
    </Button>
  );
}
```

**Step 2: Write QuickActions component**

```typescript
"use client";

import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "../contexts/dashboard-context";
import { ActionButton } from "./action-button";

export function QuickActions() {
  const t = useTranslations("DashboardPage.quickActions");
  const { quickActions } = useDashboard();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-5 w-5 text-muted-foreground" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Verify files compile**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/dashboard/quick-actions/
git commit -m "feat(dashboard): add QuickActions components"
```

---

### Task 10: Main Dashboard Component

**Files:**

- Create: `src/components/dashboard/requests.ts`
- Create: `src/components/dashboard/dashboard.tsx`

**Step 1: Write requests file**

```typescript
import type { DashboardData } from "./types";
import { MOCK_DASHBOARD_DATA } from "./mocks";

export async function getDashboardData(): Promise<DashboardData> {
  // TODO: Replace with real data fetching
  return MOCK_DASHBOARD_DATA;
}
```

**Step 2: Write Dashboard component**

```typescript
import { getDashboardData } from "./requests";
import { DashboardProvider } from "./contexts/dashboard-context";
import { GreetingClock } from "./greeting-clock/greeting-clock";
import { TodaysFlow } from "./todays-flow/todays-flow";
import { ActiveTimers } from "./active-timers/active-timers";
import { WeeklyStars } from "./weekly-stars/weekly-stars";
import { QuickActions } from "./quick-actions/quick-actions";

export async function Dashboard() {
  const data = await getDashboardData();

  return (
    <DashboardProvider data={data}>
      <div className="flex-1 p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          <GreetingClock />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2">
              <TodaysFlow />
            </div>

            <div className="space-y-6">
              <ActiveTimers />
              <WeeklyStars />
              <QuickActions />
            </div>
          </div>
        </div>
      </div>
    </DashboardProvider>
  );
}
```

**Step 3: Verify files compile**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/dashboard/requests.ts src/components/dashboard/dashboard.tsx
git commit -m "feat(dashboard): add main Dashboard component"
```

---

## Phase 4: Page & Navigation

### Task 11: Create Dashboard Page

**Files:**

- Create: `src/app/[locale]/dashboard/page.tsx`

**Step 1: Write page file**

```typescript
import { setRequestLocale } from "next-intl/server";
import { Dashboard } from "@/components/dashboard/dashboard";
import { AppHeader } from "@/components/layout/app-header";
import { InteractionModeProvider } from "@/contexts/interaction-mode-context";
import type { Locale } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <InteractionModeProvider mode="manage">
      <main className="bg-background min-h-screen flex flex-col">
        <AppHeader />
        <Dashboard />
      </main>
    </InteractionModeProvider>
  );
}
```

**Step 2: Verify page compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/[locale]/dashboard/page.tsx
git commit -m "feat(dashboard): add dashboard page route"
```

---

### Task 12: Add Dashboard to Navigation

**Files:**

- Modify: `src/components/layout/navigation-menu.tsx`

**Step 1: Add dashboard nav item**

Add import:

```typescript
import { LayoutDashboard } from "lucide-react";
```

Add to navItems array (first position):

```typescript
{ href: "/dashboard", icon: LayoutDashboard, labelKey: "dashboard" },
```

**Step 2: Verify file compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/layout/navigation-menu.tsx
git commit -m "feat(dashboard): add dashboard to navigation menu"
```

---

## Phase 5: Internationalization

### Task 13: Add Translation Keys

**Files:**

- Modify: `messages/nl.json`
- Modify: `messages/en.json`

**Step 1: Add Dutch translations**

Add to `messages/nl.json`:

```json
{
  "DashboardPage": {
    "greeting": {
      "morning": "Goedemorgen",
      "afternoon": "Goedemiddag",
      "evening": "Goedenavond"
    },
    "todaysFlow": {
      "title": "Vandaag",
      "eventsRemaining": "{count, plural, =0 {Geen events} =1 {1 event over} other {# events over}}",
      "now": "Nu",
      "next": "Volgende",
      "later": "Later",
      "noEvents": "Geen events meer vandaag"
    },
    "activeTimers": {
      "title": "Actieve Timers",
      "pause": "Pauze",
      "extend": "+15m"
    },
    "weeklyStars": {
      "title": "Wekelijkse Sterren"
    },
    "quickActions": {
      "title": "Snelle Acties"
    }
  },
  "Menu": {
    "dashboard": "Dashboard"
  }
}
```

**Step 2: Add English translations**

Add to `messages/en.json`:

```json
{
  "DashboardPage": {
    "greeting": {
      "morning": "Good Morning",
      "afternoon": "Good Afternoon",
      "evening": "Good Evening"
    },
    "todaysFlow": {
      "title": "Today",
      "eventsRemaining": "{count, plural, =0 {No events} =1 {1 event remaining} other {# events remaining}}",
      "now": "Now",
      "next": "Next",
      "later": "Later",
      "noEvents": "No more events today"
    },
    "activeTimers": {
      "title": "Active Timers",
      "pause": "Pause",
      "extend": "+15m"
    },
    "weeklyStars": {
      "title": "Weekly Stars"
    },
    "quickActions": {
      "title": "Quick Actions"
    }
  },
  "Menu": {
    "dashboard": "Dashboard"
  }
}
```

**Step 3: Commit**

```bash
git add messages/nl.json messages/en.json
git commit -m "feat(dashboard): add i18n translations"
```

---

## Phase 6: Testing

### Task 14: Unit Tests

**Files:**

- Create: `src/components/dashboard/__tests__/hooks.test.ts`

**Step 1: Write hook tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClock, useGreeting } from "../hooks";

describe("useGreeting", () => {
  it("returns morning for hours before 12", () => {
    const morning = new Date("2024-01-01T08:00:00");
    const { result } = renderHook(() => useGreeting(morning));
    expect(result.current).toBe("morning");
  });

  it("returns afternoon for hours 12-17", () => {
    const afternoon = new Date("2024-01-01T14:00:00");
    const { result } = renderHook(() => useGreeting(afternoon));
    expect(result.current).toBe("afternoon");
  });

  it("returns evening for hours 18+", () => {
    const evening = new Date("2024-01-01T20:00:00");
    const { result } = renderHook(() => useGreeting(evening));
    expect(result.current).toBe("evening");
  });
});

describe("useClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns current time", () => {
    const { result } = renderHook(() => useClock());
    expect(result.current).toBeInstanceOf(Date);
  });

  it("updates every interval", () => {
    const { result } = renderHook(() => useClock(1000));
    const initialTime = result.current.getTime();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.getTime()).toBeGreaterThan(initialTime);
  });
});
```

**Step 2: Run tests**

Run: `pnpm test:run src/components/dashboard/__tests__/hooks.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/components/dashboard/__tests__/
git commit -m "test(dashboard): add hook unit tests"
```

---

### Task 15: E2E Tests

**Files:**

- Create: `e2e/dashboard.spec.ts`

**Step 1: Write E2E tests**

```typescript
import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("loads successfully", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveTitle(/Family Planner/);
  });

  test("displays greeting and clock", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("time")).toBeVisible();
  });

  test("displays today's flow section", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Vandaag")).toBeVisible();
  });

  test("displays weekly stars section", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Wekelijkse Sterren")).toBeVisible();
  });

  test("displays quick actions section", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Snelle Acties")).toBeVisible();
  });

  test("navigation to dashboard works", async ({ page }) => {
    await page.goto("/calendar");
    await page.getByRole("button", { name: /menu/i }).click();
    await page.getByRole("link", { name: /dashboard/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
```

**Step 2: Run E2E tests**

Run: `pnpm e2e e2e/dashboard.spec.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add e2e/dashboard.spec.ts
git commit -m "test(dashboard): add E2E tests"
```

---

## Verification Checklist

After completing all tasks:

- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test:run` passes
- [ ] `pnpm e2e` passes
- [ ] Dashboard accessible at `/dashboard`
- [ ] All sections render (Clock, Today's Flow, Timers, Stars, Actions)
- [ ] Navigation menu includes Dashboard link
- [ ] Both Dutch and English translations work
