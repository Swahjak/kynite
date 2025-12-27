# Event Time Display & Time Format Preference Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Always show end time on event cards in day/week views, and add server-side time format preference (12h/24h) defaulting to 24h.

**Architecture:** Add `use24HourFormat` column to users table. Create API endpoint for preference get/update. Use React Query for client-side caching and mutations. CalendarContext receives initial preference from server and uses mutation for updates.

**Tech Stack:** Next.js 16, Drizzle ORM, PostgreSQL, React Query, better-auth

---

## Task 1: Always Show End Time on Event Cards

**Files:**

- Modify: `src/components/calendar/views/week-and-day-view/event-block.tsx:101-106`

**Step 1: Update event-block.tsx to always show time**

Replace the conditional time display with always-visible time. Use smaller text for short events:

```tsx
// Find lines 101-106 and replace:
// OLD:
{
  durationInMinutes > 25 && (
    <p>
      {formatTime(start, use24HourFormat)} - {formatTime(end, use24HourFormat)}
    </p>
  );
}

// NEW:
<p className={cn(durationInMinutes <= 25 && "text-[10px]")}>
  {formatTime(start, use24HourFormat)} - {formatTime(end, use24HourFormat)}
</p>;
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Visual test**

Run: `pnpm dev`
Navigate to calendar day/week view, verify short and long events both show start-end times

**Step 4: Commit**

```bash
git add src/components/calendar/views/week-and-day-view/event-block.tsx
git commit -m "feat(calendar): always show end time on event cards"
```

---

## Task 2: Add use24HourFormat Column to Users Table

**Files:**

- Modify: `src/server/schema.ts:23-31`

**Step 1: Add use24HourFormat column to users table**

Add the column after the existing fields:

```typescript
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  type: text("type").default("human"),
  use24HourFormat: boolean("use_24_hour_format").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 2: Generate migration**

Run: `pnpm db:generate`
Expected: New migration file in `drizzle/` folder

**Step 3: Apply migration**

Run: `pnpm db:migrate`
Expected: Migration applied successfully

**Step 4: Commit**

```bash
git add src/server/schema.ts drizzle/
git commit -m "feat(db): add use24HourFormat column to users table"
```

---

## Task 3: Create Preferences API Endpoint

**Files:**

- Create: `src/app/api/v1/preferences/route.ts`

**Step 1: Create the preferences API route**

```typescript
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/schema";
import { getSession } from "@/lib/get-session";

export async function GET() {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({ use24HourFormat: users.use24HourFormat })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  return NextResponse.json({
    use24HourFormat: user?.use24HourFormat ?? true,
  });
}

export async function PATCH(request: Request) {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { use24HourFormat } = body;

  if (typeof use24HourFormat !== "boolean") {
    return NextResponse.json(
      { error: "use24HourFormat must be a boolean" },
      { status: 400 }
    );
  }

  await db
    .update(users)
    .set({
      use24HourFormat,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ use24HourFormat });
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/api/v1/preferences/route.ts
git commit -m "feat(api): add preferences endpoint for time format"
```

---

## Task 4: Create React Query Hooks for Preferences

**Files:**

- Create: `src/hooks/use-preferences.ts`

**Step 1: Create the preferences hooks file**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";

interface UserPreferences {
  use24HourFormat: boolean;
}

export const preferencesKeys = {
  all: ["preferences"] as const,
  user: () => [...preferencesKeys.all, "user"] as const,
};

export function useUserPreferences() {
  return useQuery({
    queryKey: preferencesKeys.user(),
    queryFn: () => apiFetch<UserPreferences>("/api/v1/preferences"),
    staleTime: Infinity,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Partial<UserPreferences>) =>
      apiFetch<UserPreferences>("/api/v1/preferences", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onMutate: async (newPreferences) => {
      await queryClient.cancelQueries({ queryKey: preferencesKeys.user() });

      const previousPreferences = queryClient.getQueryData<UserPreferences>(
        preferencesKeys.user()
      );

      queryClient.setQueryData<UserPreferences>(
        preferencesKeys.user(),
        (old) =>
          ({
            ...old,
            ...newPreferences,
          }) as UserPreferences
      );

      return { previousPreferences };
    },
    onError: (_err, _newPreferences, context) => {
      if (context?.previousPreferences) {
        queryClient.setQueryData(
          preferencesKeys.user(),
          context.previousPreferences
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: preferencesKeys.user() });
    },
  });
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/use-preferences.ts
git commit -m "feat(hooks): add useUserPreferences and useUpdatePreferences"
```

---

## Task 5: Fetch Preference in Calendar Layout

**Files:**

- Modify: `src/app/[locale]/(app)/calendar/layout.tsx:30-34`
- Modify: `src/app/[locale]/(app)/calendar/calendar-layout-client.tsx`

**Step 1: Add preference fetch to layout.tsx**

```typescript
import { setRequestLocale } from "next-intl/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/get-session";
import { db } from "@/server/db";
import { users } from "@/server/schema";
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

  const [members, chores, progress, userPrefs] = await Promise.all([
    getFamilyMembers(familyId),
    getChoresForFamily(familyId, { status: "pending" }),
    getChoreProgress(familyId),
    db
      .select({ use24HourFormat: users.use24HourFormat })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1),
  ]);

  return (
    <CalendarLayoutClient
      familyId={familyId}
      members={members}
      initialChores={chores}
      initialProgress={progress}
      initialUse24HourFormat={userPrefs[0]?.use24HourFormat ?? true}
    >
      {children}
    </CalendarLayoutClient>
  );
}
```

**Step 2: Update calendar-layout-client.tsx to accept and pass prop**

Add `initialUse24HourFormat` to the props interface and pass to CalendarProvider:

```typescript
interface CalendarLayoutClientProps {
  familyId: string;
  members: FamilyMember[];
  initialChores: ChoreWithAssignees[];
  initialProgress: Record<string, number>;
  initialUse24HourFormat?: boolean;
  children: React.ReactNode;
}

// In the component, pass to CalendarProvider:
<CalendarProvider
  users={calendarUsers}
  events={events}
  initialUse24HourFormat={initialUse24HourFormat}
>
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/[locale]/(app)/calendar/layout.tsx src/app/[locale]/(app)/calendar/calendar-layout-client.tsx
git commit -m "feat(calendar): pass time format preference from server"
```

---

## Task 6: Update CalendarContext to Use Server Preference

**Files:**

- Modify: `src/components/calendar/contexts/calendar-context.tsx`

**Step 1: Update CalendarProvider to accept initialUse24HourFormat**

Update the interface and implementation:

```typescript
interface CalendarSettings {
  badgeVariant: "dot" | "colored";
  view: TCalendarView;
  agendaModeGroupBy: "date" | "color";
  // Remove use24HourFormat from localStorage settings
}

const DEFAULT_SETTINGS: CalendarSettings = {
  badgeVariant: "colored",
  view: "day",
  agendaModeGroupBy: "date",
};

export function CalendarProvider({
  children,
  users,
  events,
  badge = "colored",
  view = "day",
  initialUse24HourFormat = true,
}: {
  children: React.ReactNode;
  users: IUser[];
  events: IEvent[];
  view?: TCalendarView;
  badge?: "dot" | "colored";
  initialUse24HourFormat?: boolean;
}) {
  const [settings, setSettings] = useLocalStorage<CalendarSettings>(
    "calendar-settings",
    {
      ...DEFAULT_SETTINGS,
      badgeVariant: badge,
      view: view,
    }
  );

  // Time format comes from server, not localStorage
  const [use24HourFormat, setUse24HourFormatState] = useState<boolean>(
    initialUse24HourFormat
  );
  const updatePreferencesMutation = useUpdatePreferences();

  // ... rest of state

  const toggleTimeFormat = () => {
    const newValue = !use24HourFormat;
    setUse24HourFormatState(newValue);
    updatePreferencesMutation.mutate({ use24HourFormat: newValue });
  };

  // ... rest of component
}
```

**Step 2: Add import for useUpdatePreferences**

```typescript
import { useUpdatePreferences } from "@/hooks/use-preferences";
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/calendar/contexts/calendar-context.tsx
git commit -m "feat(calendar): use server-side time format preference"
```

---

## Task 7: Update CurrentTime Component

**Files:**

- Modify: `src/components/layout/current-time.tsx`

**Step 1: Update to use preferences hook**

```typescript
"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useUserPreferences } from "@/hooks/use-preferences";

export function CurrentTime() {
  const [time, setTime] = useState<Date | null>(null);
  const { data: preferences } = useUserPreferences();
  const use24HourFormat = preferences?.use24HourFormat ?? true;

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!time) {
    return null;
  }

  const formattedTime = format(
    time,
    use24HourFormat ? "HH:mm" : "h:mm a"
  );

  return (
    <time
      dateTime={time.toISOString()}
      suppressHydrationWarning
      className="text-lg font-semibold tabular-nums"
    >
      {formattedTime}
    </time>
  );
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/layout/current-time.tsx
git commit -m "feat(layout): use time format preference in header clock"
```

---

## Task 8: Update Schedule Card Component

**Files:**

- Modify: `src/components/wall-hub/shared/schedule-card.tsx`

**Step 1: Update to use preferences hook**

Find the hardcoded time format and update:

```typescript
// Add import
import { useUserPreferences } from "@/hooks/use-preferences";
import { format } from "date-fns";

// Inside component:
const { data: preferences } = useUserPreferences();
const use24HourFormat = preferences?.use24HourFormat ?? true;

// Replace hardcoded format:
// OLD: const timeDisplay = format(startDate, "h:mm a");
// NEW:
const timeDisplay = format(startDate, use24HourFormat ? "HH:mm" : "h:mm a");
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/wall-hub/shared/schedule-card.tsx
git commit -m "feat(wall-hub): use time format preference in schedule card"
```

---

## Task 9: Update Settings Toggle

**Files:**

- Modify: `src/components/calendar/settings/settings.tsx`

**Step 1: Verify settings toggle uses context correctly**

The toggle should still work since CalendarContext handles the mutation internally via `toggleTimeFormat()`. No changes needed if it already uses `toggleTimeFormat()` from context.

**Step 2: Test the toggle**

Run: `pnpm dev`
Navigate to calendar, open settings dropdown, toggle 24-hour format
Verify preference persists after page refresh

**Step 3: Commit (if changes needed)**

```bash
git add src/components/calendar/settings/settings.tsx
git commit -m "refactor(settings): verify time format toggle uses server preference"
```

---

## Task 10: Run All Tests and Final Verification

**Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 2: Run linter**

Run: `pnpm lint`
Expected: No errors

**Step 3: Run unit tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 4: Manual testing checklist**

- [ ] Event cards in day view show start-end time for all events
- [ ] Event cards in week view show start-end time for all events
- [ ] Short events (< 25 min) show time in smaller text
- [ ] Header clock respects time format preference
- [ ] Settings toggle changes time format
- [ ] Preference persists after page refresh
- [ ] Preference persists after sign out/sign in

**Step 5: Final commit**

```bash
git add -A
git commit -m "test: verify time format preference implementation"
```

---

## Rollback Plan

If issues occur:

1. Revert all commits: `git revert HEAD~10..HEAD`
2. Or drop the new column:
   ```sql
   ALTER TABLE users DROP COLUMN use_24_hour_format;
   ```
3. The existing localStorage-based preference will continue to work

---

## Notes

- Existing users will default to 24h format (column default)
- localStorage preference is no longer used for time format (removed from CalendarSettings)
- Other localStorage settings (badge variant, view, agenda grouping) remain unchanged
- React Query caches the preference with `staleTime: Infinity` to minimize API calls
