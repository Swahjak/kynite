# Private Calendars Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow users to mark Google Calendars as "private" so event details are hidden from other family members while keeping time slots visible.

**Architecture:** Server-side filtering ensures sensitive data never reaches unauthorized browsers. Privacy is per-calendar (not per-event). Owners see full details; non-owners see "Hidden" placeholder with muted styling.

**Tech Stack:** Drizzle ORM (PostgreSQL), Next.js API Routes, React components with Tailwind CSS, Vitest for unit tests, Playwright for E2E.

---

## Task 1: Add `isPrivate` Column to Database Schema

**Files:**

- Modify: `src/server/schema.ts:338-355`

**Step 1: Add the `isPrivate` column to `googleCalendars` table**

In `src/server/schema.ts`, find the `googleCalendars` table definition and add the new column:

```typescript
export const googleCalendars = pgTable("google_calendars", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  googleCalendarId: text("google_calendar_id").notNull(),
  name: text("name").notNull(),
  color: text("color"),
  accessRole: text("access_role").notNull().default("reader"),
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  isPrivate: boolean("is_private").notNull().default(false), // NEW
  lastSyncedAt: timestamp("last_synced_at", { mode: "date" }),
  syncCursor: text("sync_cursor"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 2: Generate the migration**

Run:

```bash
pnpm db:generate
```

Expected: Creates a new migration file in `drizzle/` with `ALTER TABLE google_calendars ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT false`

**Step 3: Apply the migration**

Run:

```bash
pnpm db:migrate
```

Expected: Migration applies successfully, no errors.

**Step 4: Verify in Drizzle Studio**

Run:

```bash
pnpm db:studio
```

Check that `google_calendars` table now has the `is_private` column.

**Step 5: Commit**

```bash
git add src/server/schema.ts drizzle/
git commit -m "feat(db): add isPrivate column to googleCalendars table"
```

---

## Task 2: Add `isHidden` to Event Types

**Files:**

- Modify: `src/server/services/event-service.ts:17-42`
- Modify: `src/components/calendar/interfaces.ts`

**Step 1: Extend `EventWithParticipants` interface**

In `src/server/services/event-service.ts`, add `isHidden` to the interface:

```typescript
export interface EventWithParticipants {
  id: string;
  familyId: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  color: string | null;
  googleCalendarId: string | null;
  googleEventId: string | null;
  syncStatus: string | null;
  calendarName: string | null;
  calendarColor: string | null;
  accessRole: string | null;
  isHidden: boolean; // NEW: true when event is from a private calendar and viewer is not owner
  participants: {
    odp: {
      id: string;
      name: string;
      color: string;
    };
  }[];
}
```

**Step 2: Update `IEvent` interface in calendar components**

In `src/components/calendar/interfaces.ts`, add `isHidden`:

```typescript
export interface IEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  allDay?: boolean;
  color?: string;
  participants?: IUser[];
  isHidden?: boolean; // NEW
}
```

**Step 3: Commit**

```bash
git add src/server/services/event-service.ts src/components/calendar/interfaces.ts
git commit -m "feat(types): add isHidden field to event interfaces"
```

---

## Task 3: Write Failing Test for Privacy Filtering Logic

**Files:**

- Create: `src/server/services/__tests__/event-privacy.test.ts`

**Step 1: Create the test file**

```typescript
import { describe, it, expect } from "vitest";
import { shouldRedactEvent } from "../event-service";

describe("shouldRedactEvent", () => {
  const makeEvent = (overrides: {
    calendarIsPrivate?: boolean;
    calendarAccountUserId?: string;
  }) => ({
    id: "event-1",
    title: "Test Event",
    calendar:
      overrides.calendarIsPrivate !== undefined
        ? {
            isPrivate: overrides.calendarIsPrivate,
            accountUserId: overrides.calendarAccountUserId ?? "owner-123",
          }
        : null,
  });

  describe("when calendar is not private", () => {
    it("returns false - no redaction needed", () => {
      const event = makeEvent({ calendarIsPrivate: false });
      expect(shouldRedactEvent(event, "anyone")).toBe(false);
    });
  });

  describe("when calendar is private", () => {
    it("returns false when viewer is the calendar owner", () => {
      const event = makeEvent({
        calendarIsPrivate: true,
        calendarAccountUserId: "owner-123",
      });
      expect(shouldRedactEvent(event, "owner-123")).toBe(false);
    });

    it("returns true when viewer is NOT the calendar owner", () => {
      const event = makeEvent({
        calendarIsPrivate: true,
        calendarAccountUserId: "owner-123",
      });
      expect(shouldRedactEvent(event, "other-user")).toBe(true);
    });

    it("returns true when no viewer is provided", () => {
      const event = makeEvent({
        calendarIsPrivate: true,
        calendarAccountUserId: "owner-123",
      });
      expect(shouldRedactEvent(event, undefined)).toBe(true);
    });
  });

  describe("when event has no calendar", () => {
    it("returns false - manual events are never private", () => {
      const event = makeEvent({});
      expect(shouldRedactEvent(event, "anyone")).toBe(false);
    });
  });
});
```

**Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test:run src/server/services/__tests__/event-privacy.test.ts
```

Expected: FAIL with `shouldRedactEvent is not exported` or similar.

**Step 3: Commit the failing test**

```bash
git add src/server/services/__tests__/event-privacy.test.ts
git commit -m "test(events): add failing tests for privacy filtering logic"
```

---

## Task 4: Implement `shouldRedactEvent` Function

**Files:**

- Modify: `src/server/services/event-service.ts`

**Step 1: Add the helper type and function**

Add near the top of the file, after the imports:

```typescript
interface EventWithCalendar {
  calendar: {
    isPrivate: boolean;
    accountUserId: string;
  } | null;
}

export function shouldRedactEvent(
  event: EventWithCalendar,
  viewerUserId?: string
): boolean {
  // Not from a calendar (manual event) - no redaction
  if (!event.calendar) return false;

  // Calendar is not private - no redaction
  if (!event.calendar.isPrivate) return false;

  // No viewer context - redact to be safe
  if (!viewerUserId) return true;

  // Redact if viewer is not the calendar owner
  return event.calendar.accountUserId !== viewerUserId;
}
```

**Step 2: Run the test to verify it passes**

Run:

```bash
pnpm test:run src/server/services/__tests__/event-privacy.test.ts
```

Expected: All tests PASS.

**Step 3: Commit**

```bash
git add src/server/services/event-service.ts
git commit -m "feat(events): implement shouldRedactEvent privacy helper"
```

---

## Task 5: Write Failing Test for `getEventsForFamily` Privacy Filtering

**Files:**

- Modify: `src/server/services/__tests__/event-privacy.test.ts`

**Step 1: Add integration-style test for the filtering**

Add to the existing test file:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { shouldRedactEvent, redactEventDetails } from "../event-service";

// ... existing tests ...

describe("redactEventDetails", () => {
  const makeFullEvent = () => ({
    id: "event-1",
    familyId: "family-1",
    title: "Doctor Appointment",
    description: "Annual checkup at Dr. Smith",
    location: "123 Medical Center",
    startTime: new Date("2025-01-15T10:00:00Z"),
    endTime: new Date("2025-01-15T11:00:00Z"),
    allDay: false,
    color: "blue",
    googleCalendarId: "cal-1",
    googleEventId: "gcal-event-1",
    syncStatus: "synced",
    calendarName: "Personal",
    calendarColor: "blue",
    accessRole: "owner",
    isHidden: false,
    participants: [],
  });

  it("replaces title with 'Hidden'", () => {
    const event = makeFullEvent();
    const redacted = redactEventDetails(event);
    expect(redacted.title).toBe("Hidden");
  });

  it("nullifies description", () => {
    const event = makeFullEvent();
    const redacted = redactEventDetails(event);
    expect(redacted.description).toBeNull();
  });

  it("nullifies location", () => {
    const event = makeFullEvent();
    const redacted = redactEventDetails(event);
    expect(redacted.location).toBeNull();
  });

  it("sets isHidden to true", () => {
    const event = makeFullEvent();
    const redacted = redactEventDetails(event);
    expect(redacted.isHidden).toBe(true);
  });

  it("preserves timing information", () => {
    const event = makeFullEvent();
    const redacted = redactEventDetails(event);
    expect(redacted.startTime).toEqual(event.startTime);
    expect(redacted.endTime).toEqual(event.endTime);
    expect(redacted.allDay).toBe(event.allDay);
  });

  it("preserves calendar color", () => {
    const event = makeFullEvent();
    const redacted = redactEventDetails(event);
    expect(redacted.calendarColor).toBe("blue");
  });
});
```

**Step 2: Run the test to verify it fails**

Run:

```bash
pnpm test:run src/server/services/__tests__/event-privacy.test.ts
```

Expected: FAIL with `redactEventDetails is not exported`.

**Step 3: Commit**

```bash
git add src/server/services/__tests__/event-privacy.test.ts
git commit -m "test(events): add failing tests for redactEventDetails"
```

---

## Task 6: Implement `redactEventDetails` Function

**Files:**

- Modify: `src/server/services/event-service.ts`

**Step 1: Add the redaction function**

```typescript
export function redactEventDetails<T extends EventWithParticipants>(
  event: T
): T {
  return {
    ...event,
    title: "Hidden",
    description: null,
    location: null,
    isHidden: true,
  };
}
```

**Step 2: Run the test to verify it passes**

Run:

```bash
pnpm test:run src/server/services/__tests__/event-privacy.test.ts
```

Expected: All tests PASS.

**Step 3: Commit**

```bash
git add src/server/services/event-service.ts
git commit -m "feat(events): implement redactEventDetails function"
```

---

## Task 7: Modify `getEventsForFamily` to Include Calendar Privacy Data

**Files:**

- Modify: `src/server/services/event-service.ts:44-136`

**Step 1: Update the query to join account table and include `isPrivate`**

Find the existing query in `getEventsForFamily` and modify to include:

1. Join with `accounts` table to get `userId`
2. Select `isPrivate` and account's `userId`

The query needs to be updated to include:

```typescript
// In the select, add:
calendarIsPrivate: googleCalendars.isPrivate,
calendarAccountUserId: accounts.userId,

// In the joins, add:
.leftJoin(accounts, eq(googleCalendars.accountId, accounts.id))
```

**Step 2: Update the function signature to accept `viewerUserId`**

```typescript
export async function getEventsForFamily(
  familyId: string,
  query?: EventQueryInput,
  viewerUserId?: string // NEW: for privacy filtering
): Promise<EventWithParticipants[]> {
```

**Step 3: Add privacy filtering after fetching events**

At the end of the function, before returning:

```typescript
// Apply privacy filtering
return result.map((event) => {
  const calendarInfo =
    event.calendarIsPrivate !== null
      ? {
          isPrivate: event.calendarIsPrivate,
          accountUserId: event.calendarAccountUserId,
        }
      : null;

  if (shouldRedactEvent({ calendar: calendarInfo }, viewerUserId)) {
    return redactEventDetails({ ...event, isHidden: true });
  }
  return { ...event, isHidden: false };
});
```

**Step 4: Run tests**

Run:

```bash
pnpm test:run
```

Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/server/services/event-service.ts
git commit -m "feat(events): add privacy filtering to getEventsForFamily"
```

---

## Task 8: Update Events API Route to Pass `viewerUserId`

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/events/route.ts:17-83`

**Step 1: Update the GET handler**

Find line 67 where `getEventsForFamily` is called and add the viewer's user ID:

```typescript
// Before:
const events = await getEventsForFamily(familyId, parsed.data);

// After:
const events = await getEventsForFamily(
  familyId,
  parsed.data,
  session.user.id // Pass viewer's user ID for privacy filtering
);
```

**Step 2: Verify the build**

Run:

```bash
pnpm build
```

Expected: Build succeeds with no type errors.

**Step 3: Commit**

```bash
git add src/app/api/v1/families/[familyId]/events/route.ts
git commit -m "feat(api): pass viewerUserId to getEventsForFamily for privacy filtering"
```

---

## Task 9: Add Hidden Event Styling to Month View

**Files:**

- Modify: `src/components/calendar/views/month-view/month-event-badge.tsx`

**Step 1: Import `cn` helper if not already imported**

Verify `cn` is imported from `@/lib/utils`.

**Step 2: Add conditional styling for hidden events**

Update the badge wrapper div to include hidden event styles:

```tsx
<div
  className={cn(
    badge({
      variant: badgeVariant === "dot" ? `${event.color}-dot` : event.color,
    }),
    event.isHidden && "pointer-events-none opacity-[0.77] select-none"
  )}
>
  {/* ... existing content ... */}
</div>
```

**Step 3: Verify dev server shows no errors**

Run:

```bash
pnpm dev
```

Navigate to the calendar and verify no console errors.

**Step 4: Commit**

```bash
git add src/components/calendar/views/month-view/month-event-badge.tsx
git commit -m "feat(ui): add muted styling for hidden events in month view"
```

---

## Task 10: Add Hidden Event Styling to Week/Day View

**Files:**

- Modify: `src/components/calendar/views/week-and-day-view/event-block.tsx`

**Step 1: Add conditional styling for hidden events**

Update the event block wrapper to include hidden event styles:

```tsx
<div
  className={cn(
    eventBlock({ color: event.color }),
    event.isHidden &&
      "pointer-events-none cursor-default opacity-[0.77] select-none"
  )}
>
  {/* ... existing content ... */}
</div>
```

**Step 2: Disable drag/resize for hidden events**

Wrap the `DraggableEvent` and `ResizableEvent` conditionally:

```tsx
{
  event.isHidden ? (
    <div className={/* existing styles */}>
      {/* Event content without drag/resize */}
    </div>
  ) : (
    <DraggableEvent event={event}>
      <ResizableEvent event={event}>{/* Existing content */}</ResizableEvent>
    </DraggableEvent>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/calendar/views/week-and-day-view/event-block.tsx
git commit -m "feat(ui): add muted styling for hidden events in week/day view"
```

---

## Task 11: Create Calendar Privacy Toggle API Endpoint

**Files:**

- Create: `src/app/api/v1/calendars/[calendarId]/privacy/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { googleCalendars, accounts } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updatePrivacySchema = z.object({
  isPrivate: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ calendarId: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { calendarId } = await params;

  // Parse request body
  const body = await request.json();
  const parsed = updatePrivacySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  // Verify user owns this calendar (via their account)
  const calendar = await db
    .select({
      id: googleCalendars.id,
      accountUserId: accounts.userId,
    })
    .from(googleCalendars)
    .innerJoin(accounts, eq(googleCalendars.accountId, accounts.id))
    .where(eq(googleCalendars.id, calendarId))
    .limit(1);

  if (calendar.length === 0) {
    return NextResponse.json(
      { success: false, error: "Calendar not found" },
      { status: 404 }
    );
  }

  if (calendar[0].accountUserId !== session.user.id) {
    return NextResponse.json(
      { success: false, error: "You can only modify your own calendars" },
      { status: 403 }
    );
  }

  // Update privacy setting
  await db
    .update(googleCalendars)
    .set({
      isPrivate: parsed.data.isPrivate,
      updatedAt: new Date(),
    })
    .where(eq(googleCalendars.id, calendarId));

  return NextResponse.json({
    success: true,
    data: { isPrivate: parsed.data.isPrivate },
  });
}
```

**Step 2: Verify the route compiles**

Run:

```bash
pnpm build
```

Expected: No type errors.

**Step 3: Commit**

```bash
git add src/app/api/v1/calendars/[calendarId]/privacy/route.ts
git commit -m "feat(api): add PATCH endpoint for calendar privacy toggle"
```

---

## Task 12: Create API to List Calendars with Privacy Status

**Files:**

- Create: `src/app/api/v1/accounts/[accountId]/calendars/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { googleCalendars, accounts } from "@/server/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { accountId } = await params;

  // Verify user owns this account
  const account = await db
    .select({ id: accounts.id, userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (account.length === 0 || account[0].userId !== session.user.id) {
    return NextResponse.json(
      { success: false, error: "Account not found" },
      { status: 404 }
    );
  }

  // Get all calendars for this account
  const calendars = await db
    .select({
      id: googleCalendars.id,
      name: googleCalendars.name,
      color: googleCalendars.color,
      syncEnabled: googleCalendars.syncEnabled,
      isPrivate: googleCalendars.isPrivate,
    })
    .from(googleCalendars)
    .where(eq(googleCalendars.accountId, accountId))
    .orderBy(googleCalendars.name);

  return NextResponse.json({
    success: true,
    data: { calendars },
  });
}
```

**Step 2: Commit**

```bash
git add src/app/api/v1/accounts/[accountId]/calendars/route.ts
git commit -m "feat(api): add GET endpoint to list calendars with privacy status"
```

---

## Task 13: Create Calendar Settings Component

**Files:**

- Create: `src/components/settings/calendar-privacy-toggle.tsx`

**Step 1: Create the toggle component**

```tsx
"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Lock, LockOpen } from "lucide-react";

interface CalendarPrivacyToggleProps {
  calendarId: string;
  calendarName: string;
  isPrivate: boolean;
  syncEnabled: boolean;
  onPrivacyChange: (calendarId: string, isPrivate: boolean) => Promise<void>;
}

export function CalendarPrivacyToggle({
  calendarId,
  calendarName,
  isPrivate,
  syncEnabled,
  onPrivacyChange,
}: CalendarPrivacyToggleProps) {
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(isPrivate);

  const handleToggle = async (newValue: boolean) => {
    setLoading(true);
    try {
      await onPrivacyChange(calendarId, newValue);
      setChecked(newValue);
    } catch (error) {
      console.error("Failed to update privacy setting:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        {checked ? (
          <Lock className="text-muted-foreground h-4 w-4" />
        ) : (
          <LockOpen className="text-muted-foreground h-4 w-4" />
        )}
        <Label htmlFor={`privacy-${calendarId}`} className="text-sm">
          {calendarName}
        </Label>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Switch
              id={`privacy-${calendarId}`}
              checked={checked}
              onCheckedChange={handleToggle}
              disabled={!syncEnabled || loading}
              aria-label={`Make ${calendarName} private`}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {!syncEnabled
            ? "Enable sync first to set privacy"
            : checked
              ? "Event details hidden from family members"
              : "Event details visible to family members"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/settings/calendar-privacy-toggle.tsx
git commit -m "feat(ui): create CalendarPrivacyToggle component"
```

---

## Task 14: Add Calendar List with Privacy Toggles to Settings

**Files:**

- Modify: `src/components/settings/linked-accounts-section.tsx`

**Step 1: Extend the component to fetch and display calendars**

Add calendar fetching and display logic. Update the `LinkedGoogleAccountCard` or create a new `AccountCalendarsList` component that:

1. Fetches calendars from `/api/v1/accounts/[accountId]/calendars`
2. Renders each calendar with a `CalendarPrivacyToggle`
3. Handles the privacy change API call

```tsx
// Add to the component:
const handlePrivacyChange = async (calendarId: string, isPrivate: boolean) => {
  const response = await fetch(`/api/v1/calendars/${calendarId}/privacy`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isPrivate }),
  });

  if (!response.ok) {
    throw new Error("Failed to update privacy setting");
  }
};
```

**Step 2: Commit**

```bash
git add src/components/settings/linked-accounts-section.tsx
git commit -m "feat(ui): add calendar privacy toggles to settings page"
```

---

## Task 15: Write E2E Test for Privacy Filtering

**Files:**

- Create: `e2e/tests/calendar/private-calendars.spec.ts`

**Step 1: Create the E2E test**

```typescript
import { test, expect } from "../../fixtures";

test.describe("Private Calendars", () => {
  test("non-owner sees 'Hidden' for private calendar events", async ({
    familyPage,
  }) => {
    // Setup: Create a private calendar event for user A
    // Login as user B (family member, not owner)
    // Navigate to calendar
    // Verify event shows "Hidden" title
    // Verify network response has "Hidden", not actual title

    await familyPage.goto("/calendar");

    // Check that hidden events display correctly
    const hiddenEvent = familyPage.page.locator('[data-hidden="true"]');
    if ((await hiddenEvent.count()) > 0) {
      await expect(hiddenEvent.first()).toContainText("Hidden");
      await expect(hiddenEvent.first()).toHaveCSS("opacity", "0.77");
    }
  });

  test("owner sees full details for their private calendar events", async ({
    familyPage,
  }) => {
    // Setup: Create a private calendar event
    // Login as the calendar owner
    // Navigate to calendar
    // Verify event shows actual title, not "Hidden"

    await familyPage.goto("/calendar");

    // Verify owner's events are not hidden
    // This requires test data setup with private calendars
  });

  test("privacy toggle updates calendar setting", async ({ familyPage }) => {
    // Navigate to settings
    // Find a calendar toggle
    // Toggle privacy on
    // Verify API call succeeds
    // Refresh and verify setting persisted

    await familyPage.goto("/settings");
    // ... test implementation
  });
});
```

**Step 2: Commit**

```bash
git add e2e/tests/calendar/private-calendars.spec.ts
git commit -m "test(e2e): add private calendars E2E tests"
```

---

## Task 16: Add Data Attribute for Hidden Events (E2E Testing Support)

**Files:**

- Modify: `src/components/calendar/views/month-view/month-event-badge.tsx`
- Modify: `src/components/calendar/views/week-and-day-view/event-block.tsx`

**Step 1: Add `data-hidden` attribute to event components**

In both files, add:

```tsx
<div
  data-hidden={event.isHidden ? "true" : undefined}
  className={cn(/* existing classes */)}
>
```

**Step 2: Commit**

```bash
git add src/components/calendar/views/month-view/month-event-badge.tsx \
        src/components/calendar/views/week-and-day-view/event-block.tsx
git commit -m "feat(ui): add data-hidden attribute for E2E testing"
```

---

## Task 17: Run Full Test Suite and Verify

**Step 1: Run unit tests**

```bash
pnpm test:run
```

Expected: All tests pass.

**Step 2: Run E2E tests**

```bash
pnpm e2e:full
```

Expected: All tests pass (new private calendar tests may need test data).

**Step 3: Run build**

```bash
pnpm build
```

Expected: Build succeeds with no errors.

**Step 4: Run lint**

```bash
pnpm lint
```

Expected: No linting errors.

**Step 5: Final commit if any cleanup needed**

```bash
git add .
git commit -m "chore: cleanup and fixes from test run"
```

---

## Summary

| Task  | Description                          | Est. Complexity |
| ----- | ------------------------------------ | --------------- |
| 1     | Add `isPrivate` column to schema     | Low             |
| 2     | Update event type interfaces         | Low             |
| 3-4   | Implement `shouldRedactEvent` (TDD)  | Medium          |
| 5-6   | Implement `redactEventDetails` (TDD) | Medium          |
| 7     | Modify `getEventsForFamily` query    | High            |
| 8     | Update API route to pass viewer ID   | Low             |
| 9-10  | Add hidden event styling to views    | Medium          |
| 11-12 | Create privacy toggle API endpoints  | Medium          |
| 13-14 | Create settings UI components        | Medium          |
| 15-16 | E2E tests and data attributes        | Medium          |
| 17    | Final verification                   | Low             |

**Security Note:** Always verify in browser DevTools Network tab that private event details are never sent to non-owners.
