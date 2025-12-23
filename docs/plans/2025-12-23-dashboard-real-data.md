# Dashboard Real Data Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all dashboard placeholder/mock data with real data from existing services.

**Architecture:** The dashboard already has a clean data-fetching layer in `requests.ts` that returns `DashboardData`. We'll update `getDashboardData()` to call real services (event-service, family-service, reward-chart-service) and map their responses to the existing `DashboardData` interface. Server components fetch data; client context manages runtime state.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, TypeScript, existing service layer

---

## Summary of Changes

| Placeholder            | Implementation                           | Complexity |
| ---------------------- | ---------------------------------------- | ---------- |
| Family Name            | Fetch from family-service                | Low        |
| Today's Events         | Fetch from event-service                 | Medium     |
| Family Members + Stars | Fetch from reward-chart-service          | Medium     |
| Active Timers          | Keep as mock (needs timer system design) | Deferred   |
| Quick Actions          | Keep as mock (needs UX decision)         | Deferred   |

**Scope:** Tasks 1-4 integrate real data. Timers and Quick Actions are deferred pending design decisions.

---

## Task 1: Add Authentication Context to Dashboard Page

**Files:**

- Modify: `src/app/[locale]/(app)/dashboard/page.tsx`
- Reference: `src/server/auth.ts`

**Step 1: Read the current dashboard page**

Review the existing page.tsx to understand its structure.

**Step 2: Update page.tsx to get session and familyId**

```tsx
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";
import { getDashboardData } from "@/components/dashboard/requests";

interface DashboardPageProps {
  params: Promise<{ locale: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect(`/${locale}/sign-in`);
  }

  const dashboardData = await getDashboardData(session.user.id);

  return <Dashboard initialData={dashboardData} />;
}
```

**Step 3: Run the dev server and verify the page loads**

Run: `pnpm dev`
Navigate to: `http://localhost:3000/nl/dashboard`
Expected: Page loads (still with mock data)

**Step 4: Commit**

```bash
git add src/app/[locale]/(app)/dashboard/page.tsx
git commit -m "feat(dashboard): add auth context to dashboard page"
```

---

## Task 2: Update getDashboardData to Accept userId

**Files:**

- Modify: `src/components/dashboard/requests.ts`
- Modify: `src/components/dashboard/types.ts`

**Step 1: Update requests.ts signature**

```ts
import { MOCK_DASHBOARD_DATA } from "./mocks";
import type { DashboardData } from "./types";

export async function getDashboardData(userId: string): Promise<DashboardData> {
  // TODO: Replace with real data fetching
  console.log("Fetching dashboard data for user:", userId);
  return MOCK_DASHBOARD_DATA;
}
```

**Step 2: Verify the app still works**

Run: `pnpm dev`
Check browser console for: "Fetching dashboard data for user: <userId>"
Expected: Dashboard renders with mock data, console shows userId

**Step 3: Commit**

```bash
git add src/components/dashboard/requests.ts
git commit -m "feat(dashboard): accept userId in getDashboardData"
```

---

## Task 3: Integrate Family Service for Family Name

**Files:**

- Modify: `src/components/dashboard/requests.ts`
- Reference: `src/server/services/family-service.ts`

**Step 1: Import and call family service**

```ts
import { MOCK_DASHBOARD_DATA } from "./mocks";
import type { DashboardData } from "./types";
import { getUserFamily } from "@/server/services/family-service";

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const family = await getUserFamily(userId);

  if (!family) {
    // User has no family - return empty dashboard
    return {
      familyName: "",
      todaysEvents: [],
      activeTimers: [],
      familyMembers: [],
      quickActions: [],
    };
  }

  return {
    familyName: family.name,
    todaysEvents: MOCK_DASHBOARD_DATA.todaysEvents,
    activeTimers: MOCK_DASHBOARD_DATA.activeTimers,
    familyMembers: MOCK_DASHBOARD_DATA.familyMembers,
    quickActions: MOCK_DASHBOARD_DATA.quickActions,
  };
}
```

**Step 2: Verify family name displays from database**

Run: `pnpm dev`
Navigate to dashboard
Expected: Family name from database shows in greeting (not "Familie de Vries" unless that's your actual family name)

**Step 3: Commit**

```bash
git add src/components/dashboard/requests.ts
git commit -m "feat(dashboard): fetch family name from database"
```

---

## Task 4: Integrate Event Service for Today's Events

**Files:**

- Modify: `src/components/dashboard/requests.ts`
- Modify: `src/components/dashboard/types.ts` (if mapping needed)
- Reference: `src/server/services/event-service.ts`

**Step 1: Import event service and add date helpers**

```ts
import { MOCK_DASHBOARD_DATA } from "./mocks";
import type { DashboardData, DashboardEvent } from "./types";
import { getUserFamily } from "@/server/services/family-service";
import { getEventsForFamily } from "@/server/services/event-service";
import { startOfDay, endOfDay } from "date-fns";

function mapEventToDashboardEvent(event: {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location: string | null;
  color: string | null;
}): DashboardEvent {
  return {
    id: event.id,
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location ?? undefined,
    category: event.color ?? "default",
    state: "upcoming" as const,
  };
}

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const family = await getUserFamily(userId);

  if (!family) {
    return {
      familyName: "",
      todaysEvents: [],
      activeTimers: [],
      familyMembers: [],
      quickActions: [],
    };
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const events = await getEventsForFamily(family.id, {
    startDate: todayStart,
    endDate: todayEnd,
  });

  const todaysEvents = events
    .map(mapEventToDashboardEvent)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return {
    familyName: family.name,
    todaysEvents,
    activeTimers: MOCK_DASHBOARD_DATA.activeTimers,
    familyMembers: MOCK_DASHBOARD_DATA.familyMembers,
    quickActions: MOCK_DASHBOARD_DATA.quickActions,
  };
}
```

**Step 2: Check DashboardEvent interface matches**

Read `src/components/dashboard/types.ts` and verify `DashboardEvent` interface has these fields:

- `id: string`
- `title: string`
- `startTime: Date`
- `endTime: Date`
- `location?: string`
- `category: string`
- `state: "past" | "now" | "upcoming"`

Update the interface if needed.

**Step 3: Verify events display from database**

Run: `pnpm dev`
Navigate to dashboard
Expected: Today's events from Google Calendar sync (or empty if no events today)

**Step 4: Commit**

```bash
git add src/components/dashboard/requests.ts src/components/dashboard/types.ts
git commit -m "feat(dashboard): fetch today's events from database"
```

---

## Task 5: Integrate Reward Chart Service for Family Members + Stars

**Files:**

- Modify: `src/components/dashboard/requests.ts`
- Reference: `src/server/services/reward-chart-service.ts`
- Reference: `src/server/services/family-service.ts`

**Step 1: Add reward chart imports and mapping**

Add to `requests.ts`:

```ts
import { getFamilyMembers } from "@/server/services/family-service";
import {
  getChartsForFamily,
  getCompletionsForDateRange,
} from "@/server/services/reward-chart-service";
import { startOfWeek, endOfWeek } from "date-fns";
import type { FamilyMemberStar } from "./types";

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
```

**Step 2: Fetch family members with their weekly stars**

Update `getDashboardData`:

```ts
export async function getDashboardData(userId: string): Promise<DashboardData> {
  const family = await getUserFamily(userId);

  if (!family) {
    return {
      familyName: "",
      todaysEvents: [],
      activeTimers: [],
      familyMembers: [],
      quickActions: [],
    };
  }

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // Fetch events
  const events = await getEventsForFamily(family.id, {
    startDate: todayStart,
    endDate: todayEnd,
  });

  // Fetch family members
  const members = await getFamilyMembers(family.id);

  // Fetch reward charts for family
  const charts = await getChartsForFamily(family.id);

  // Calculate weekly stars for each member
  const familyMembers: FamilyMemberStar[] = await Promise.all(
    members.map(async (member) => {
      const chart = charts.find((c) => c.memberId === member.id);
      let weeklyStarCount = 0;

      if (chart) {
        const completions = await getCompletionsForDateRange(
          chart.id,
          weekStart,
          weekEnd
        );
        weeklyStarCount = completions.reduce((sum, c) => {
          // Each completion gives stars based on task value
          return sum + (c.status === "completed" ? 1 : 0);
        }, 0);
      }

      const { level, levelTitle } = calculateLevel(weeklyStarCount);

      return {
        id: member.id,
        name: member.displayName || member.user?.name || "Unknown",
        avatarColor: member.avatarColor || "#888888",
        weeklyStarCount,
        level,
        levelTitle,
      };
    })
  );

  const todaysEvents = events
    .map(mapEventToDashboardEvent)
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  return {
    familyName: family.name,
    todaysEvents,
    activeTimers: MOCK_DASHBOARD_DATA.activeTimers,
    familyMembers,
    quickActions: MOCK_DASHBOARD_DATA.quickActions,
  };
}
```

**Step 3: Verify family members display with real stars**

Run: `pnpm dev`
Navigate to dashboard
Expected: Family members from database with their actual weekly star counts

**Step 4: Commit**

```bash
git add src/components/dashboard/requests.ts
git commit -m "feat(dashboard): fetch family members with weekly stars"
```

---

## Task 6: Remove Unused Mock Imports

**Files:**

- Modify: `src/components/dashboard/requests.ts`

**Step 1: Clean up mock imports**

After all real data is integrated, update imports:

```ts
import { MOCK_DASHBOARD_DATA } from "./mocks";
// Keep only for activeTimers and quickActions until those are implemented
```

**Step 2: Run type check**

Run: `pnpm build`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/components/dashboard/requests.ts
git commit -m "refactor(dashboard): clean up mock imports"
```

---

## Deferred Items

### Active Timers (Needs Design)

The timer system requires:

1. Database schema for timers (timer table with start/pause/extend state)
2. Timer service for CRUD operations
3. Real-time updates (WebSocket or polling)
4. Client-side countdown logic

**Decision needed:** Should timers be family-wide or per-member? Should they persist across sessions?

### Quick Actions (Needs UX Decision)

Options:

1. Derive from frequently used chores
2. Admin-configurable list per family
3. Static set of common actions

**Decision needed:** What should quick actions do? Create timers? Log chore completions? Both?

---

## Testing Checklist

After implementation, verify:

- [ ] Dashboard loads for authenticated users
- [ ] Unauthenticated users redirect to sign-in
- [ ] Family name displays from database
- [ ] Today's events show real calendar data
- [ ] Family members show with real names and avatar colors
- [ ] Weekly star counts are accurate for current week
- [ ] Empty states work when no events/members exist
