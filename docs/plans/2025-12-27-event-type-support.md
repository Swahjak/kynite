# Event Type Support Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add eventType column to differentiate birthday events from regular events, with special birthday display in day/week views (sticky top, cake icon).

**Architecture:** Add an `eventType` column to the events table storing Google Calendar event types (default, birthday, fromGmail). Update the sync service to populate this from Google API responses. Expose via event service and calendar interfaces. Add birthday-specific UI components showing cake icon and top-sticky positioning in day/week views.

**Tech Stack:** Drizzle ORM, PostgreSQL, TypeScript, React, Tailwind CSS, Vitest

---

## Task 1: Update Google Calendar Types

**Files:**

- Modify: `src/types/google-calendar.ts:45-59`

**Step 1: Add birthdayProperties interface**

Add after line 35 (after `GoogleCalendarAttendee`):

```typescript
export interface GoogleBirthdayProperties {
  type?: "birthday" | "anniversary" | "self" | "custom" | "other";
  customTypeName?: string;
  contact?: string; // People API resource name: 'people/c12345'
}
```

**Step 2: Add birthdayProperties to GoogleCalendarEvent**

Add to the `GoogleCalendarEvent` interface after `attendees?`:

```typescript
  birthdayProperties?: GoogleBirthdayProperties;
```

**Step 3: Commit**

```bash
git add src/types/google-calendar.ts
git commit -m "feat(types): add birthdayProperties to GoogleCalendarEvent"
```

---

## Task 2: Add eventType Column to Events Schema

**Files:**

- Modify: `src/server/schema.ts:488-511`

**Step 1: Add eventType column to events table**

After line 498 (`allDay: boolean("all_day")...`), add:

```typescript
  eventType: text("event_type"), // 'default' | 'birthday' | 'fromGmail' | null for manual events
```

**Step 2: Commit**

```bash
git add src/server/schema.ts
git commit -m "feat(schema): add eventType column to events table"
```

---

## Task 3: Generate Database Migration

**Files:**

- Create: `drizzle/0018_*.sql` (auto-generated)

**Step 1: Generate migration**

Run: `pnpm db:generate`

Expected: Creates new migration file adding `event_type` column

**Step 2: Verify migration content**

The generated SQL should contain:

```sql
ALTER TABLE "events" ADD COLUMN "event_type" text;
```

**Step 3: Run migration**

Run: `pnpm db:migrate`

Expected: Migration applies successfully

**Step 4: Commit**

```bash
git add drizzle/
git commit -m "chore(db): add migration for eventType column"
```

---

## Task 4: Update Sync Service to Store eventType

**Files:**

- Modify: `src/server/services/google-sync-service.ts:351-415`

**Step 1: Update upsertEventFromGoogle to store eventType**

In `src/server/services/google-sync-service.ts`, modify the `upsertEventFromGoogle` function.

Update the insert at line 400-414:

```typescript
await db.insert(events).values({
  id: eventId,
  familyId,
  title: googleEvent.summary || "(No title)",
  description: googleEvent.description,
  location: googleEvent.location,
  startTime,
  endTime,
  allDay,
  eventType: googleEvent.eventType ?? null,
  googleCalendarId,
  googleEventId: googleEvent.id,
  remoteUpdatedAt: new Date(googleEvent.updated),
  syncStatus: "synced",
});
```

Update the update at line 383-397:

```typescript
await db
  .update(events)
  .set({
    title: googleEvent.summary || "(No title)",
    description: googleEvent.description,
    location: googleEvent.location,
    startTime,
    endTime,
    allDay,
    eventType: googleEvent.eventType ?? null,
    remoteUpdatedAt: new Date(googleEvent.updated),
    syncStatus: "synced",
    updatedAt: new Date(),
  })
  .where(eq(events.id, eventId));
```

**Step 2: Verify typecheck passes**

Run: `pnpm typecheck`

Expected: PASS

**Step 3: Commit**

```bash
git add src/server/services/google-sync-service.ts
git commit -m "feat(sync): store eventType when syncing Google events"
```

---

## Task 5: Expose eventType in Event Service

**Files:**

- Modify: `src/server/services/event-service.ts:53-80`

**Step 1: Add eventType to EventWithParticipants interface**

After line 65 (`syncStatus: string | null;`), add:

```typescript
eventType: string | null;
```

**Step 2: Update getEventsForFamily to include eventType**

In the result mapping (around line 150-168), add `eventType: row.event.eventType,` after color.

**Step 3: Update getEventById to include eventType**

In the result object (around line 233-260), add `eventType: row.event.eventType,` after color.

**Step 4: Verify typecheck passes**

Run: `pnpm typecheck`

Expected: PASS

**Step 5: Commit**

```bash
git add src/server/services/event-service.ts
git commit -m "feat(events): expose eventType in event service"
```

---

## Task 6: Add eventType to Calendar IEvent Interface

**Files:**

- Modify: `src/components/calendar/interfaces.ts:12-21`

**Step 1: Add eventType to IEvent interface**

After `isHidden?: boolean;` (line 20), add:

```typescript
  eventType?: string | null;
```

**Step 2: Commit**

```bash
git add src/components/calendar/interfaces.ts
git commit -m "feat(calendar): add eventType to IEvent interface"
```

---

## Task 7: Update Event Transform to Include eventType

**Files:**

- Modify: `src/components/calendar/requests.ts:22-45`

**Step 1: Update transformEventToIEvent**

Add `eventType` to the returned object. Also, override color to 'red' for birthday events (brand guideline: red = special dates):

```typescript
export function transformEventToIEvent(event: EventWithParticipants): IEvent {
  const isBirthday = event.eventType === "birthday";

  // Use first participant's avatar color for the event color
  // Birthday events use red (brand: special dates)
  const firstParticipant = event.participants[0];
  const eventColor = isBirthday
    ? "red"
    : firstParticipant
      ? avatarColorToEventColor(firstParticipant.avatarColor)
      : "blue";

  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    startDate: new Date(event.startTime).toISOString(),
    endDate: new Date(event.endTime).toISOString(),
    color: eventColor,
    eventType: event.eventType,
    users: event.participants.map((p) => ({
      id: p.familyMemberId,
      name: p.displayName ?? p.userName,
      avatarFallback: (p.displayName ?? p.userName).slice(0, 2).toUpperCase(),
      avatarColor: p.avatarColor ?? null,
      avatarUrl: p.userImage ?? undefined,
      avatarSvg: p.avatarSvg,
    })),
  };
}
```

**Step 2: Verify typecheck passes**

Run: `pnpm typecheck`

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/calendar/requests.ts
git commit -m "feat(calendar): transform eventType and use red for birthdays"
```

---

## Task 8: Create Birthday Banner Component

**Files:**

- Create: `src/components/calendar/views/week-and-day-view/birthday-banner.tsx`

**Step 1: Create the birthday banner component**

This component displays birthday events at the top with a cake icon:

```tsx
import { Cake } from "lucide-react";
import type { IEvent } from "@/components/calendar/interfaces";
import { EventDetailsDialog } from "@/components/calendar/dialogs/event-details-dialog";

interface BirthdayBannerProps {
  events: IEvent[];
}

export function BirthdayBanner({ events }: BirthdayBannerProps) {
  const birthdayEvents = events.filter((e) => e.eventType === "birthday");

  if (birthdayEvents.length === 0) return null;

  return (
    <div className="flex border-b bg-red-50 dark:bg-red-950/30">
      <div className="flex w-18 items-center justify-end pr-2">
        <Cake className="size-4 text-red-500" />
      </div>
      <div className="flex flex-1 flex-wrap items-center gap-2 border-l border-red-200 px-2 py-2 dark:border-red-800">
        {birthdayEvents.map((event) => (
          <EventDetailsDialog key={event.id} event={event}>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/50 dark:text-red-300 dark:hover:bg-red-900"
            >
              <Cake className="size-3" />
              <span className="max-w-32 truncate">{event.title}</span>
            </button>
          </EventDetailsDialog>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/calendar/views/week-and-day-view/birthday-banner.tsx
git commit -m "feat(calendar): add birthday banner component with cake icon"
```

---

## Task 9: Add Birthday Banner to Day View

**Files:**

- Modify: `src/components/calendar/views/week-and-day-view/calendar-day-view.tsx`

**Step 1: Import BirthdayBanner**

Add import at top:

```typescript
import { BirthdayBanner } from "@/components/calendar/views/week-and-day-view/birthday-banner";
```

**Step 2: Add BirthdayBanner above multi-day events row**

In the JSX, add `<BirthdayBanner events={multiDayEvents} />` before `<DayViewMultiDayEventsRow>` (around line 85):

```tsx
<div>
  <BirthdayBanner events={multiDayEvents} />
  <DayViewMultiDayEventsRow
    selectedDate={selectedDate}
    multiDayEvents={multiDayEvents}
  />
  {/* Day header */}
  ...
</div>
```

**Step 3: Commit**

```bash
git add src/components/calendar/views/week-and-day-view/calendar-day-view.tsx
git commit -m "feat(calendar): add birthday banner to day view"
```

---

## Task 10: Update Day View "Happening Now" for Birthdays

**Files:**

- Modify: `src/components/calendar/views/week-and-day-view/calendar-day-view.tsx`

**Step 1: Import Cake icon**

Update the lucide-react import to include `Cake`:

```typescript
import { Calendar, Cake, Clock, User } from "lucide-react";
```

**Step 2: Update the "Happening now" section to show cake for birthdays**

Find the current events section (around line 189-254). Update the indicator to use cake icon for birthdays:

Replace the indicator section:

```tsx
{
  currentEvents.length > 0 ? (
    <div className="flex items-start gap-2 px-4 pt-4">
      {currentEvents.some((e) => e.eventType === "birthday") ? (
        <>
          <Cake className="mt-0.5 size-4 text-red-500" />
          <p className="text-t-secondary text-sm font-semibold">
            Birthday today!
          </p>
        </>
      ) : (
        <>
          <span className="relative mt-[5px] flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex size-2.5 rounded-full bg-green-600"></span>
          </span>
          <p className="text-t-secondary text-sm font-semibold">
            Happening now
          </p>
        </>
      )}
    </div>
  ) : (
    <p className="text-t-tertiary p-4 text-center text-sm italic">
      No appointments or consultations at the moment
    </p>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/calendar/views/week-and-day-view/calendar-day-view.tsx
git commit -m "feat(calendar): show cake icon for birthdays in happening now"
```

---

## Task 11: Add Birthday Banner to Week View

**Files:**

- Modify: `src/components/calendar/views/week-and-day-view/calendar-week-view.tsx`

**Step 1: Read week view structure**

First examine the week view to find where to add the birthday banner.

**Step 2: Import BirthdayBanner**

Add import at top:

```typescript
import { BirthdayBanner } from "@/components/calendar/views/week-and-day-view/birthday-banner";
```

**Step 3: Add BirthdayBanner above multi-day events row**

Add `<BirthdayBanner events={multiDayEvents} />` before `<WeekViewMultiDayEventsRow>`.

**Step 4: Commit**

```bash
git add src/components/calendar/views/week-and-day-view/calendar-week-view.tsx
git commit -m "feat(calendar): add birthday banner to week view"
```

---

## Task 12: Filter Birthday Events from Multi-Day Row

**Files:**

- Modify: `src/components/calendar/views/week-and-day-view/day-view-multi-day-events-row.tsx`
- Modify: `src/components/calendar/views/week-and-day-view/week-view-multi-day-events-row.tsx`

**Step 1: Filter out birthday events from day view multi-day row**

In `day-view-multi-day-events-row.tsx`, add filter to exclude birthdays (they're shown in banner):

```typescript
const multiDayEventsInDay = multiDayEvents
  .filter((event) => event.eventType !== "birthday") // Exclude birthdays - shown in banner
  .filter((event) => {
    // ... existing date filtering
  });
```

**Step 2: Filter out birthday events from week view multi-day row**

Apply the same filter in `week-view-multi-day-events-row.tsx`.

**Step 3: Commit**

```bash
git add src/components/calendar/views/week-and-day-view/day-view-multi-day-events-row.tsx
git add src/components/calendar/views/week-and-day-view/week-view-multi-day-events-row.tsx
git commit -m "feat(calendar): filter birthdays from multi-day row (shown in banner)"
```

---

## Task 13: Verify Full Build

**Step 1: Run full typecheck**

Run: `pnpm typecheck`

Expected: PASS

**Step 2: Run tests**

Run: `pnpm test:run`

Expected: All tests PASS

**Step 3: Run build**

Run: `pnpm build`

Expected: Build succeeds

**Step 4: Manual testing**

1. Start dev server: `pnpm dev`
2. Sync a Google Calendar that has birthday events
3. Verify birthday events appear in red banner at top of day/week view
4. Verify cake icon appears instead of green "NOW" indicator for birthdays
5. Verify clicking birthday opens event details dialog

---

## Summary

After completing these tasks:

1. `GoogleCalendarEvent` type includes `birthdayProperties` for future use
2. Events table has `eventType` column
3. Google sync stores event type from API
4. Event service exposes `eventType` to clients
5. Calendar `IEvent` includes `eventType`
6. Birthday events display with:
   - Red color (brand: special dates)
   - Sticky banner at top of day/week views
   - Cake icon instead of pulsing "NOW" indicator
   - Cake icon badges in the banner

**Future enhancements (not in scope):**

- Filter events by type in calendar views
- Birthday reminders/notifications
- Link to People API contact via `birthdayProperties.contact`
- Anniversary events with different styling
