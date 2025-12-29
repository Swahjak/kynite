# Recurring Events Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add recurring event support (daily/weekly/monthly/yearly) to the calendar with persisted occurrences.

**Architecture:** Create a new `recurring_event_patterns` table to store recurrence rules. When a recurring event is created, generate 1 year of occurrences as individual event rows linked to the pattern. A weekly cron job extends the horizon. Edit/delete operations support "this event only" or "all events" scope.

**Tech Stack:** Drizzle ORM, PostgreSQL, React Hook Form, Zod, date-fns

---

## Task 1: Database Schema - Recurring Event Patterns Table

**Files:**

- Modify: `src/server/schema/calendars.ts`
- Modify: `src/server/schema/index.ts`

**Step 1: Add the recurring_event_patterns table to calendars.ts**

Add after the `eventParticipants` table definition (around line 92):

```typescript
/**
 * Recurring Event Patterns table - Stores recurrence rules for recurring events
 */
export const recurringEventPatterns = pgTable("recurring_event_patterns", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  frequency: text("frequency").notNull(), // 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: integer("interval").notNull().default(1), // e.g., 2 = "every 2 weeks"
  endType: text("end_type").notNull(), // 'never' | 'count' | 'date'
  endCount: integer("end_count"), // if endType='count'
  endDate: timestamp("end_date", { mode: "date" }), // if endType='date'
  generatedUntil: timestamp("generated_until", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

Add import for `integer` at the top of the file:

```typescript
import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
```

**Step 2: Add columns to events table**

Add these columns to the `events` table (after line 76, before `createdAt`):

```typescript
  // Recurring event reference
  recurringPatternId: text("recurring_pattern_id").references(
    () => recurringEventPatterns.id,
    { onDelete: "cascade" }
  ),
  occurrenceDate: timestamp("occurrence_date", { mode: "date" }), // identifies which instance
```

**Step 3: Add relations for recurring patterns**

Add after `eventParticipantsRelations` (around line 146):

```typescript
export const recurringEventPatternsRelations = relations(
  recurringEventPatterns,
  ({ one, many }) => ({
    family: one(families, {
      fields: [recurringEventPatterns.familyId],
      references: [families.id],
    }),
    events: many(events),
  })
);
```

Update `eventsRelations` to include the pattern reference:

```typescript
export const eventsRelations = relations(events, ({ one, many }) => ({
  family: one(families, {
    fields: [events.familyId],
    references: [families.id],
  }),
  googleCalendar: one(googleCalendars, {
    fields: [events.googleCalendarId],
    references: [googleCalendars.id],
  }),
  recurringPattern: one(recurringEventPatterns, {
    fields: [events.recurringPatternId],
    references: [recurringEventPatterns.id],
  }),
  participants: many(eventParticipants),
}));
```

**Step 4: Add type exports**

Add at the end of the file (around line 161):

```typescript
export type RecurringEventPattern = typeof recurringEventPatterns.$inferSelect;
export type NewRecurringEventPattern =
  typeof recurringEventPatterns.$inferInsert;
```

**Step 5: Export from index.ts**

Update `src/server/schema/index.ts` calendars section to include:

```typescript
// Calendars
export {
  googleCalendars,
  googleCalendarChannels,
  events,
  eventParticipants,
  recurringEventPatterns,
  googleCalendarsRelations,
  googleCalendarChannelsRelations,
  eventsRelations,
  eventParticipantsRelations,
  recurringEventPatternsRelations,
  type GoogleCalendar,
  type NewGoogleCalendar,
  type GoogleCalendarChannel,
  type NewGoogleCalendarChannel,
  type Event,
  type NewEvent,
  type EventParticipant,
  type NewEventParticipant,
  type RecurringEventPattern,
  type NewRecurringEventPattern,
} from "./calendars";
```

**Step 6: Generate and run migration**

Run: `pnpm db:generate`
Run: `pnpm db:migrate`

**Step 7: Verify migration**

Run: `pnpm db:studio`
Verify both tables exist with new columns.

**Step 8: Commit**

```bash
git add src/server/schema/calendars.ts src/server/schema/index.ts drizzle/
git commit -m "feat(db): add recurring_event_patterns table and event columns"
```

---

## Task 2: Recurrence Types and Validation Schemas

**Files:**

- Create: `src/lib/validations/recurrence.ts`
- Modify: `src/lib/validations/event.ts`
- Create: `src/components/calendar/types/recurrence.ts`

**Step 1: Create recurrence validation schema**

Create `src/lib/validations/recurrence.ts`:

```typescript
import { z } from "zod";

export const recurrenceFrequencySchema = z.enum([
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);

export const recurrenceEndTypeSchema = z.enum(["never", "count", "date"]);

export const recurrenceSchema = z
  .object({
    frequency: recurrenceFrequencySchema,
    interval: z.number().int().min(1).max(99).default(1),
    endType: recurrenceEndTypeSchema,
    endCount: z.number().int().min(1).max(365).optional(),
    endDate: z.coerce.date().optional(),
  })
  .refine(
    (data) => {
      if (data.endType === "count" && !data.endCount) return false;
      if (data.endType === "date" && !data.endDate) return false;
      return true;
    },
    {
      message: "End count or date required based on end type",
      path: ["endCount"],
    }
  );

export type RecurrenceInput = z.infer<typeof recurrenceSchema>;
export type RecurrenceFrequency = z.infer<typeof recurrenceFrequencySchema>;
export type RecurrenceEndType = z.infer<typeof recurrenceEndTypeSchema>;
```

**Step 2: Update event validation to include recurrence**

Modify `src/lib/validations/event.ts`, add import and extend schema:

```typescript
import { recurrenceSchema } from "./recurrence";

export const createEventSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().max(2000).nullable().optional(),
    location: z.string().max(500).nullable().optional(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    allDay: z.boolean().default(false),
    category: eventCategorySchema.default("family"),
    eventType: eventTypeSchema.default("event"),
    isCompleted: z.boolean().default(false),
    color: eventColorSchema.nullable().optional(),
    googleCalendarId: z.string().nullable().optional(),
    participantIds: z
      .array(z.string())
      .min(1, "At least one participant required"),
    ownerId: z.string().optional(),
    // NEW: Recurrence support
    recurrence: recurrenceSchema.nullable().optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

// Add edit scope enum
export const editScopeSchema = z.enum(["this", "all"]);
export type EditScope = z.infer<typeof editScopeSchema>;
```

**Step 3: Create frontend recurrence types**

Create `src/components/calendar/types/recurrence.ts`:

```typescript
export type TRecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type TRecurrenceEndType = "never" | "count" | "date";

export interface IRecurrence {
  frequency: TRecurrenceFrequency;
  interval: number;
  endType: TRecurrenceEndType;
  endCount?: number;
  endDate?: string;
}

export const RECURRENCE_FREQUENCIES: {
  value: TRecurrenceFrequency;
  label: string;
}[] = [
  { value: "daily", label: "Day" },
  { value: "weekly", label: "Week" },
  { value: "monthly", label: "Month" },
  { value: "yearly", label: "Year" },
];

export const RECURRENCE_END_TYPES: {
  value: TRecurrenceEndType;
  label: string;
}[] = [
  { value: "never", label: "Never" },
  { value: "count", label: "After" },
  { value: "date", label: "On date" },
];
```

**Step 4: Update IEvent interface**

Modify `src/components/calendar/interfaces.ts`:

```typescript
import type { TEventCategory, TEventType } from "@/components/calendar/types";
import type { IRecurrence } from "@/components/calendar/types/recurrence";

export interface IEvent {
  id: string;
  startDate: string;
  endDate: string;
  title: string;
  description: string;
  users: IUser[];
  isHidden?: boolean;
  category: TEventCategory;
  eventType: TEventType;
  allDay: boolean;
  isCompleted?: boolean;
  ownerId?: string;
  // NEW: Recurrence support
  recurringPatternId?: string;
  occurrenceDate?: string;
  recurrence?: IRecurrence;
}
```

**Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (or only unrelated errors)

**Step 6: Commit**

```bash
git add src/lib/validations/recurrence.ts src/lib/validations/event.ts src/components/calendar/types/recurrence.ts src/components/calendar/interfaces.ts
git commit -m "feat(types): add recurrence validation schemas and types"
```

---

## Task 3: Occurrence Generation Utility

**Files:**

- Create: `src/server/utils/recurrence.ts`
- Create: `src/server/utils/__tests__/recurrence.test.ts`

**Step 1: Write the failing tests first**

Create `src/server/utils/__tests__/recurrence.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  generateOccurrenceDates,
  calculateNextOccurrence,
} from "../recurrence";

describe("generateOccurrenceDates", () => {
  const baseDate = new Date("2025-01-01T10:00:00");

  describe("daily frequency", () => {
    it("generates daily occurrences with interval 1", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "daily",
        interval: 1,
        endType: "count",
        endCount: 5,
        untilDate: new Date("2025-12-31"),
      });

      expect(dates).toHaveLength(5);
      expect(dates[0]).toEqual(new Date("2025-01-01T10:00:00"));
      expect(dates[1]).toEqual(new Date("2025-01-02T10:00:00"));
      expect(dates[4]).toEqual(new Date("2025-01-05T10:00:00"));
    });

    it("generates daily occurrences with interval 2", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "daily",
        interval: 2,
        endType: "count",
        endCount: 3,
        untilDate: new Date("2025-12-31"),
      });

      expect(dates).toHaveLength(3);
      expect(dates[0]).toEqual(new Date("2025-01-01T10:00:00"));
      expect(dates[1]).toEqual(new Date("2025-01-03T10:00:00"));
      expect(dates[2]).toEqual(new Date("2025-01-05T10:00:00"));
    });
  });

  describe("weekly frequency", () => {
    it("generates weekly occurrences", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "weekly",
        interval: 1,
        endType: "count",
        endCount: 4,
        untilDate: new Date("2025-12-31"),
      });

      expect(dates).toHaveLength(4);
      expect(dates[0]).toEqual(new Date("2025-01-01T10:00:00"));
      expect(dates[1]).toEqual(new Date("2025-01-08T10:00:00"));
      expect(dates[2]).toEqual(new Date("2025-01-15T10:00:00"));
      expect(dates[3]).toEqual(new Date("2025-01-22T10:00:00"));
    });

    it("generates bi-weekly occurrences", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "weekly",
        interval: 2,
        endType: "count",
        endCount: 3,
        untilDate: new Date("2025-12-31"),
      });

      expect(dates).toHaveLength(3);
      expect(dates[1]).toEqual(new Date("2025-01-15T10:00:00"));
    });
  });

  describe("monthly frequency", () => {
    it("generates monthly occurrences", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "monthly",
        interval: 1,
        endType: "count",
        endCount: 3,
        untilDate: new Date("2025-12-31"),
      });

      expect(dates).toHaveLength(3);
      expect(dates[0]).toEqual(new Date("2025-01-01T10:00:00"));
      expect(dates[1]).toEqual(new Date("2025-02-01T10:00:00"));
      expect(dates[2]).toEqual(new Date("2025-03-01T10:00:00"));
    });

    it("handles month-end edge case (Jan 31 -> Feb 28)", () => {
      const jan31 = new Date("2025-01-31T10:00:00");
      const dates = generateOccurrenceDates({
        startDate: jan31,
        frequency: "monthly",
        interval: 1,
        endType: "count",
        endCount: 2,
        untilDate: new Date("2025-12-31"),
      });

      expect(dates).toHaveLength(2);
      expect(dates[0]).toEqual(new Date("2025-01-31T10:00:00"));
      // Feb doesn't have 31 days, should clamp to Feb 28
      expect(dates[1]).toEqual(new Date("2025-02-28T10:00:00"));
    });
  });

  describe("yearly frequency", () => {
    it("generates yearly occurrences", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "yearly",
        interval: 1,
        endType: "count",
        endCount: 3,
        untilDate: new Date("2030-12-31"),
      });

      expect(dates).toHaveLength(3);
      expect(dates[0]).toEqual(new Date("2025-01-01T10:00:00"));
      expect(dates[1]).toEqual(new Date("2026-01-01T10:00:00"));
      expect(dates[2]).toEqual(new Date("2027-01-01T10:00:00"));
    });

    it("handles leap year (Feb 29)", () => {
      const feb29 = new Date("2024-02-29T10:00:00");
      const dates = generateOccurrenceDates({
        startDate: feb29,
        frequency: "yearly",
        interval: 1,
        endType: "count",
        endCount: 2,
        untilDate: new Date("2030-12-31"),
      });

      expect(dates).toHaveLength(2);
      expect(dates[0]).toEqual(new Date("2024-02-29T10:00:00"));
      // 2025 is not a leap year, should clamp to Feb 28
      expect(dates[1]).toEqual(new Date("2025-02-28T10:00:00"));
    });
  });

  describe("end conditions", () => {
    it("stops at endDate", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "daily",
        interval: 1,
        endType: "date",
        endDate: new Date("2025-01-03"),
        untilDate: new Date("2025-12-31"),
      });

      expect(dates).toHaveLength(3);
      expect(dates[2]).toEqual(new Date("2025-01-03T10:00:00"));
    });

    it("stops at untilDate horizon", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "daily",
        interval: 1,
        endType: "never",
        untilDate: new Date("2025-01-05"),
      });

      expect(dates).toHaveLength(5);
    });

    it("respects max occurrences cap (365)", () => {
      const dates = generateOccurrenceDates({
        startDate: baseDate,
        frequency: "daily",
        interval: 1,
        endType: "never",
        untilDate: new Date("2027-01-01"), // 2 years out
      });

      expect(dates.length).toBeLessThanOrEqual(365);
    });
  });
});

describe("calculateNextOccurrence", () => {
  it("calculates next daily occurrence", () => {
    const current = new Date("2025-01-01T10:00:00");
    const next = calculateNextOccurrence(current, "daily", 1);
    expect(next).toEqual(new Date("2025-01-02T10:00:00"));
  });

  it("calculates next weekly occurrence with interval", () => {
    const current = new Date("2025-01-01T10:00:00");
    const next = calculateNextOccurrence(current, "weekly", 2);
    expect(next).toEqual(new Date("2025-01-15T10:00:00"));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/server/utils/__tests__/recurrence.test.ts`
Expected: FAIL with "Cannot find module '../recurrence'"

**Step 3: Implement the recurrence utility**

Create `src/server/utils/recurrence.ts`:

```typescript
import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  isBefore,
  isEqual,
  min,
  getDaysInMonth,
  setDate,
} from "date-fns";
import type {
  RecurrenceFrequency,
  RecurrenceEndType,
} from "@/lib/validations/recurrence";

const MAX_OCCURRENCES = 365;

interface GenerateOccurrencesOptions {
  startDate: Date;
  frequency: RecurrenceFrequency;
  interval: number;
  endType: RecurrenceEndType;
  endCount?: number;
  endDate?: Date;
  untilDate: Date; // generation horizon
}

/**
 * Calculate the next occurrence date based on frequency and interval
 */
export function calculateNextOccurrence(
  current: Date,
  frequency: RecurrenceFrequency,
  interval: number
): Date {
  switch (frequency) {
    case "daily":
      return addDays(current, interval);
    case "weekly":
      return addWeeks(current, interval);
    case "monthly":
      return addMonthsSafe(current, interval);
    case "yearly":
      return addYearsSafe(current, interval);
  }
}

/**
 * Add months while handling month-end edge cases
 * e.g., Jan 31 + 1 month = Feb 28 (not Mar 3)
 */
function addMonthsSafe(date: Date, months: number): Date {
  const originalDay = date.getDate();
  const result = addMonths(date, months);
  const maxDay = getDaysInMonth(result);

  if (originalDay > maxDay) {
    return setDate(result, maxDay);
  }
  return result;
}

/**
 * Add years while handling leap year edge cases
 * e.g., Feb 29, 2024 + 1 year = Feb 28, 2025
 */
function addYearsSafe(date: Date, years: number): Date {
  const originalDay = date.getDate();
  const result = addYears(date, years);
  const maxDay = getDaysInMonth(result);

  if (originalDay > maxDay) {
    return setDate(result, maxDay);
  }
  return result;
}

/**
 * Generate all occurrence dates for a recurring event pattern
 */
export function generateOccurrenceDates(
  options: GenerateOccurrencesOptions
): Date[] {
  const {
    startDate,
    frequency,
    interval,
    endType,
    endCount,
    endDate,
    untilDate,
  } = options;

  const dates: Date[] = [];
  let current = new Date(startDate);
  let count = 0;

  // Determine effective end date
  const effectiveEndDate =
    endType === "date" && endDate ? min([endDate, untilDate]) : untilDate;
  const effectiveMaxCount =
    endType === "count" && endCount ? endCount : MAX_OCCURRENCES;

  while (
    count < effectiveMaxCount &&
    count < MAX_OCCURRENCES &&
    (isBefore(current, effectiveEndDate) || isEqual(current, effectiveEndDate))
  ) {
    dates.push(new Date(current));
    count++;
    current = calculateNextOccurrence(current, frequency, interval);
  }

  return dates;
}

/**
 * Calculate the event duration in milliseconds
 */
export function getEventDuration(startTime: Date, endTime: Date): number {
  return endTime.getTime() - startTime.getTime();
}

/**
 * Apply a duration to an occurrence date to get the end time
 */
export function applyDuration(occurrenceDate: Date, durationMs: number): Date {
  return new Date(occurrenceDate.getTime() + durationMs);
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:run src/server/utils/__tests__/recurrence.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/utils/recurrence.ts src/server/utils/__tests__/recurrence.test.ts
git commit -m "feat(utils): add recurrence date calculation utility"
```

---

## Task 4: Event Service - Create Recurring Events

**Files:**

- Modify: `src/server/services/event-service.ts`
- Create: `src/server/services/__tests__/recurring-event-service.test.ts`

**Step 1: Write failing test for recurring event creation**

Create `src/server/services/__tests__/recurring-event-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("@/server/db", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
        leftJoin: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    }),
    transaction: vi.fn((fn) =>
      fn({
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      })
    ),
  },
}));

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(() => "test-id-" + Math.random().toString(36).slice(2, 9)),
}));

describe("createRecurringEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should be exported from event-service", async () => {
    const { createRecurringEvent } = await import("../event-service");
    expect(createRecurringEvent).toBeDefined();
    expect(typeof createRecurringEvent).toBe("function");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test:run src/server/services/__tests__/recurring-event-service.test.ts`
Expected: FAIL with "createRecurringEvent is not defined"

**Step 3: Add createRecurringEvent function**

Add to `src/server/services/event-service.ts` (after imports):

```typescript
import {
  generateOccurrenceDates,
  getEventDuration,
  applyDuration,
} from "@/server/utils/recurrence";
import { recurringEventPatterns } from "@/server/schema";
import { addYears } from "date-fns";
```

Add this interface after `EventWithParticipants` interface:

```typescript
export interface CreateRecurringEventInput extends CreateEventInput {
  recurrence: {
    frequency: "daily" | "weekly" | "monthly" | "yearly";
    interval: number;
    endType: "never" | "count" | "date";
    endCount?: number;
    endDate?: Date;
  };
}
```

Add this function at the end of the file:

```typescript
export async function createRecurringEvent(
  familyId: string,
  input: CreateRecurringEventInput,
  creatorMemberId: string
): Promise<{ patternId: string; eventCount: number }> {
  const { recurrence, ...eventData } = input;
  const patternId = createId();

  // Calculate generation horizon (1 year from now)
  const generationHorizon = addYears(new Date(), 1);

  // Generate occurrence dates
  const occurrenceDates = generateOccurrenceDates({
    startDate: input.startTime,
    frequency: recurrence.frequency,
    interval: recurrence.interval,
    endType: recurrence.endType,
    endCount: recurrence.endCount,
    endDate: recurrence.endDate,
    untilDate: generationHorizon,
  });

  if (occurrenceDates.length === 0) {
    throw new Error("No occurrences generated for recurring event");
  }

  // Calculate event duration
  const durationMs = getEventDuration(input.startTime, input.endTime);

  // Use transaction to ensure atomicity
  await db.transaction(async (tx) => {
    // Create the pattern
    await tx.insert(recurringEventPatterns).values({
      id: patternId,
      familyId,
      frequency: recurrence.frequency,
      interval: recurrence.interval,
      endType: recurrence.endType,
      endCount: recurrence.endCount ?? null,
      endDate: recurrence.endDate ?? null,
      generatedUntil: generationHorizon,
    });

    // Create all event occurrences
    for (const occurrenceDate of occurrenceDates) {
      const eventId = createId();
      const endTime = applyDuration(occurrenceDate, durationMs);

      await tx.insert(events).values({
        id: eventId,
        familyId,
        title: eventData.title,
        description: eventData.description ?? null,
        location: eventData.location ?? null,
        startTime: occurrenceDate,
        endTime,
        allDay: eventData.allDay,
        color: eventData.color ?? null,
        category: eventData.category ?? "family",
        eventType: eventData.eventType ?? "event",
        recurringPatternId: patternId,
        occurrenceDate,
        syncStatus: "synced",
        localUpdatedAt: new Date(),
      });

      // Add participants for each occurrence
      const participantValues = eventData.participantIds.map((memberId) => ({
        id: createId(),
        eventId,
        familyMemberId: memberId,
        isOwner: memberId === creatorMemberId,
      }));

      if (participantValues.length > 0) {
        await tx.insert(eventParticipants).values(participantValues);
      }
    }
  });

  return { patternId, eventCount: occurrenceDates.length };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test:run src/server/services/__tests__/recurring-event-service.test.ts`
Expected: PASS

**Step 5: Run all tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/server/services/event-service.ts src/server/services/__tests__/recurring-event-service.test.ts src/server/utils/recurrence.ts
git commit -m "feat(service): add createRecurringEvent function"
```

---

## Task 5: Event Service - Update and Delete with Scope

**Files:**

- Modify: `src/server/services/event-service.ts`

**Step 1: Add updateRecurringEvent function**

Add after `createRecurringEvent`:

```typescript
export async function updateRecurringEvent(
  eventId: string,
  familyId: string,
  input: Partial<CreateEventInput>,
  scope: "this" | "all"
): Promise<EventWithParticipants> {
  const existing = await getEventById(eventId, familyId);
  if (!existing) throw new Error("Event not found");

  if (scope === "this") {
    // Just update this single occurrence
    return updateEvent(eventId, familyId, input);
  }

  // scope === "all" - update all events in the series
  if (!existing.recurringPatternId) {
    // Not a recurring event, just update normally
    return updateEvent(eventId, familyId, input);
  }

  // Get all events in this series
  const seriesEvents = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.recurringPatternId, existing.recurringPatternId));

  // Update all events in the series
  for (const event of seriesEvents) {
    await db
      .update(events)
      .set({
        ...(input.title !== undefined && { title: input.title }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.location !== undefined && { location: input.location }),
        ...(input.allDay !== undefined && { allDay: input.allDay }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.eventType !== undefined && { eventType: input.eventType }),
        updatedAt: new Date(),
      })
      .where(eq(events.id, event.id));
  }

  // Return the updated event
  const updated = await getEventById(eventId, familyId);
  if (!updated) throw new Error("Failed to update event");
  return updated;
}
```

**Step 2: Add deleteRecurringEvent function**

Add after `updateRecurringEvent`:

```typescript
export async function deleteRecurringEvent(
  eventId: string,
  familyId: string,
  scope: "this" | "all"
): Promise<void> {
  const existing = await getEventById(eventId, familyId);
  if (!existing) throw new Error("Event not found");

  if (scope === "this") {
    // Just delete this single occurrence
    await deleteEvent(eventId, familyId);
    return;
  }

  // scope === "all" - delete entire series
  if (!existing.recurringPatternId) {
    // Not a recurring event, just delete normally
    await deleteEvent(eventId, familyId);
    return;
  }

  // Delete the pattern (cascade will delete all events)
  await db
    .delete(recurringEventPatterns)
    .where(eq(recurringEventPatterns.id, existing.recurringPatternId));
}
```

**Step 3: Add getRecurringPatternById function**

Add after `deleteRecurringEvent`:

```typescript
export async function getRecurringPatternById(
  patternId: string,
  familyId: string
): Promise<RecurringEventPattern | null> {
  const result = await db
    .select()
    .from(recurringEventPatterns)
    .where(
      and(
        eq(recurringEventPatterns.id, patternId),
        eq(recurringEventPatterns.familyId, familyId)
      )
    )
    .limit(1);

  return result[0] ?? null;
}
```

Add import for RecurringEventPattern type:

```typescript
import type { RecurringEventPattern } from "@/server/schema";
```

**Step 4: Update getEventById to include recurring pattern info**

Modify `getEventById` to also fetch the recurring pattern if present. Update the result object to include:

```typescript
// Add after fetching the event, before privacy filtering
let recurrence = undefined;
if (row.event.recurringPatternId) {
  const pattern = await getRecurringPatternById(
    row.event.recurringPatternId,
    familyId
  );
  if (pattern) {
    recurrence = {
      frequency: pattern.frequency as "daily" | "weekly" | "monthly" | "yearly",
      interval: pattern.interval,
      endType: pattern.endType as "never" | "count" | "date",
      endCount: pattern.endCount ?? undefined,
      endDate: pattern.endDate?.toISOString() ?? undefined,
    };
  }
}

// Then add to the result object:
const result = {
  // ...existing fields...
  recurringPatternId: row.event.recurringPatternId,
  occurrenceDate: row.event.occurrenceDate?.toISOString() ?? null,
  recurrence,
};
```

**Step 5: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 6: Run tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 7: Commit**

```bash
git add src/server/services/event-service.ts
git commit -m "feat(service): add update/delete recurring events with scope"
```

---

## Task 6: API Routes - Handle Recurrence

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/events/route.ts`
- Modify: `src/app/api/v1/families/[familyId]/events/[eventId]/route.ts`

**Step 1: Update POST route to handle recurrence**

Modify `src/app/api/v1/families/[familyId]/events/route.ts`:

Add import:

```typescript
import {
  getEventsForFamily,
  createEvent,
  createRecurringEvent,
} from "@/server/services/event-service";
```

Update the POST handler (around line 138):

```typescript
// Check if this is a recurring event
if (parsed.data.recurrence) {
  const result = await createRecurringEvent(
    familyId,
    {
      ...parsed.data,
      recurrence: parsed.data.recurrence,
    },
    member.id
  );

  return NextResponse.json(
    {
      success: true,
      data: {
        patternId: result.patternId,
        eventCount: result.eventCount,
        message: `Created ${result.eventCount} recurring events`,
      },
    },
    { status: 201 }
  );
}

// Non-recurring event (existing logic)
const event = await createEvent(familyId, parsed.data, member.id);
```

**Step 2: Update PATCH and DELETE routes to handle scope**

Modify `src/app/api/v1/families/[familyId]/events/[eventId]/route.ts`:

Add imports:

```typescript
import {
  getEventById,
  updateEvent,
  deleteEvent,
  updateRecurringEvent,
  deleteRecurringEvent,
} from "@/server/services/event-service";
import { editScopeSchema } from "@/lib/validations/event";
```

Update PATCH handler to accept scope:

```typescript
export async function PATCH(request: Request, { params }: Params) {
  try {
    // ...existing auth checks...

    const { familyId, eventId } = await params;

    // ...existing manager check...

    const body = await request.json();

    // Extract scope from body
    const scope = editScopeSchema.safeParse(body.scope);
    const editScope = scope.success ? scope.data : "this";

    // Remove scope from validation data
    const { scope: _, ...eventData } = body;
    const parsed = updateEventSchema.partial().safeParse(eventData);

    if (!parsed.success) {
      // ...existing error handling...
    }

    const event = await updateRecurringEvent(
      eventId,
      familyId,
      parsed.data,
      editScope
    );

    return NextResponse.json({
      success: true,
      data: { event },
    });
  } catch (error) {
    // ...existing error handling...
  }
}
```

Update DELETE handler to accept scope:

```typescript
export async function DELETE(request: Request, { params }: Params) {
  try {
    // ...existing auth checks...

    const { familyId, eventId } = await params;

    // ...existing manager check...

    // Get scope from query params
    const { searchParams } = new URL(request.url);
    const scopeParam = searchParams.get("scope");
    const scope = editScopeSchema.safeParse(scopeParam);
    const deleteScope = scope.success ? scope.data : "this";

    await deleteRecurringEvent(eventId, familyId, deleteScope);

    return NextResponse.json({ success: true });
  } catch (error) {
    // ...existing error handling...
  }
}
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/api/v1/families/[familyId]/events/route.ts src/app/api/v1/families/[familyId]/events/[eventId]/route.ts
git commit -m "feat(api): add recurrence support to event routes"
```

---

## Task 7: Form Schema - Add Recurrence Fields

**Files:**

- Modify: `src/components/calendar/schemas.ts`

**Step 1: Update the form schema**

Modify `src/components/calendar/schemas.ts`:

```typescript
import { z } from "zod";
import { CATEGORIES, EVENT_TYPES } from "@/components/calendar/types";

export const eventCategorySchema = z.enum(CATEGORIES as [string, ...string[]], {
  message: "Category is required",
});

export const eventTypeSchema = z.enum(EVENT_TYPES as [string, ...string[]], {
  message: "Event type is required",
});

export const recurrenceFrequencySchema = z.enum([
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
]);

export const recurrenceEndTypeSchema = z.enum(["never", "count", "date"]);

export const recurrenceFormSchema = z
  .object({
    frequency: recurrenceFrequencySchema,
    interval: z.number().int().min(1).max(99).default(1),
    endType: recurrenceEndTypeSchema.default("never"),
    endCount: z.number().int().min(1).max(365).optional(),
    endDate: z.date().optional(),
  })
  .refine(
    (data) => {
      if (data.frequency === "none") return true;
      if (data.endType === "count" && !data.endCount) return false;
      if (data.endType === "date" && !data.endDate) return false;
      return true;
    },
    {
      message: "End count or date required",
      path: ["endCount"],
    }
  );

export const eventSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    startDate: z.date({
      message: "Start date is required",
    }),
    endDate: z.date({
      message: "End date is required",
    }),
    category: eventCategorySchema,
    eventType: eventTypeSchema,
    allDay: z.boolean(),
    ownerId: z.string().min(1, "Owner is required"),
    participantIds: z.array(z.string()),
    recurrence: recurrenceFormSchema.default({
      frequency: "none",
      interval: 1,
      endType: "never",
    }),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export type TEventFormData = z.infer<typeof eventSchema>;
export type TRecurrenceFormData = z.infer<typeof recurrenceFormSchema>;
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/calendar/schemas.ts
git commit -m "feat(form): add recurrence fields to event schema"
```

---

## Task 8: RecurrenceFields Component

**Files:**

- Create: `src/components/calendar/fields/recurrence-fields.tsx`

**Step 1: Create the component**

Create `src/components/calendar/fields/recurrence-fields.tsx`:

```typescript
"use client";

import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Repeat } from "lucide-react";
import { useState } from "react";
import type { TEventFormData } from "@/components/calendar/schemas";

const FREQUENCY_OPTIONS = [
  { value: "none", labelKey: "doesNotRepeat" },
  { value: "daily", labelKey: "daily" },
  { value: "weekly", labelKey: "weekly" },
  { value: "monthly", labelKey: "monthly" },
  { value: "yearly", labelKey: "yearly" },
] as const;

const FREQUENCY_UNIT_LABELS: Record<string, string> = {
  daily: "days",
  weekly: "weeks",
  monthly: "months",
  yearly: "years",
};

const END_TYPE_OPTIONS = [
  { value: "never", labelKey: "never" },
  { value: "count", labelKey: "afterOccurrences" },
  { value: "date", labelKey: "onDate" },
] as const;

export function RecurrenceFields() {
  const form = useFormContext<TEventFormData>();
  const t = useTranslations("RecurrenceFields");
  const [isOpen, setIsOpen] = useState(false);

  const frequency = form.watch("recurrence.frequency");
  const endType = form.watch("recurrence.endType");
  const showRecurrenceOptions = frequency !== "none";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="flex w-full justify-between p-0 hover:bg-transparent"
        >
          <span className="flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            {t("repeat")}
          </span>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-4 space-y-4 rounded-lg border p-4">
        {/* Frequency */}
        <FormField
          control={form.control}
          name="recurrence.frequency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("frequency")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectFrequency")} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {showRecurrenceOptions && (
          <>
            {/* Interval */}
            <FormField
              control={form.control}
              name="recurrence.interval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("every")}</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        className="w-20"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 1)
                        }
                      />
                    </FormControl>
                    <span className="text-sm text-muted-foreground">
                      {t(FREQUENCY_UNIT_LABELS[frequency] ?? "days")}
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* End Type */}
            <FormField
              control={form.control}
              name="recurrence.endType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("ends")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {END_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* End Count */}
            {endType === "count" && (
              <FormField
                control={form.control}
                name="recurrence.endCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("occurrences")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || undefined)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* End Date */}
            {endType === "date" && (
              <FormField
                control={form.control}
                name="recurrence.endDate"
                render={({ field }) => (
                  <DateTimePicker
                    form={form}
                    field={field}
                    hideTime
                    label={t("endDate")}
                  />
                )}
              />
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS (or errors about missing translations)

**Step 3: Commit**

```bash
git add src/components/calendar/fields/recurrence-fields.tsx
git commit -m "feat(ui): add RecurrenceFields form component"
```

---

## Task 9: Add Translations

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/nl.json`

**Step 1: Add English translations**

Add to `messages/en.json` under a new "RecurrenceFields" key:

```json
"RecurrenceFields": {
  "repeat": "Repeat",
  "frequency": "Frequency",
  "selectFrequency": "Select frequency",
  "doesNotRepeat": "Does not repeat",
  "daily": "Daily",
  "weekly": "Weekly",
  "monthly": "Monthly",
  "yearly": "Yearly",
  "every": "Every",
  "days": "days",
  "weeks": "weeks",
  "months": "months",
  "years": "years",
  "ends": "Ends",
  "never": "Never",
  "afterOccurrences": "After occurrences",
  "onDate": "On date",
  "occurrences": "Number of occurrences",
  "endDate": "End date"
}
```

Also add to "EventDialog":

```json
"editThisEvent": "Edit this event",
"editAllEvents": "Edit all events in series",
"deleteThisEvent": "Delete this event",
"deleteAllEvents": "Delete all events in series",
"recurringEventTitle": "Recurring Event",
"editRecurringDescription": "This is a recurring event. What would you like to edit?",
"deleteRecurringDescription": "This is a recurring event. What would you like to delete?"
```

**Step 2: Add Dutch translations**

Add to `messages/nl.json`:

```json
"RecurrenceFields": {
  "repeat": "Herhalen",
  "frequency": "Frequentie",
  "selectFrequency": "Selecteer frequentie",
  "doesNotRepeat": "Herhaalt niet",
  "daily": "Dagelijks",
  "weekly": "Wekelijks",
  "monthly": "Maandelijks",
  "yearly": "Jaarlijks",
  "every": "Elke",
  "days": "dagen",
  "weeks": "weken",
  "months": "maanden",
  "years": "jaren",
  "ends": "Eindigt",
  "never": "Nooit",
  "afterOccurrences": "Na aantal keer",
  "onDate": "Op datum",
  "occurrences": "Aantal herhalingen",
  "endDate": "Einddatum"
}
```

Also add to "EventDialog":

```json
"editThisEvent": "Bewerk deze afspraak",
"editAllEvents": "Bewerk alle afspraken in serie",
"deleteThisEvent": "Verwijder deze afspraak",
"deleteAllEvents": "Verwijder alle afspraken in serie",
"recurringEventTitle": "Terugkerende afspraak",
"editRecurringDescription": "Dit is een terugkerende afspraak. Wat wilt u bewerken?",
"deleteRecurringDescription": "Dit is een terugkerende afspraak. Wat wilt u verwijderen?"
```

**Step 3: Commit**

```bash
git add messages/en.json messages/nl.json
git commit -m "feat(i18n): add recurrence field translations"
```

---

## Task 10: Update AddEditEventDialog

**Files:**

- Modify: `src/components/calendar/dialogs/add-edit-event-dialog.tsx`

**Step 1: Add RecurrenceFields to the form**

Add import at the top:

```typescript
import { RecurrenceFields } from "@/components/calendar/fields/recurrence-fields";
```

Update the form's defaultValues to include recurrence:

```typescript
const form = useForm<TEventFormData>({
  resolver: zodResolver(eventSchema),
  defaultValues: {
    title: event?.title ?? "",
    description: event?.description ?? "",
    startDate: initialDates.startDate,
    endDate: initialDates.endDate,
    category: event?.category ?? "family",
    eventType: event?.eventType ?? "event",
    allDay: event?.allDay ?? false,
    ownerId: event?.ownerId ?? defaultOwnerId,
    participantIds:
      event?.users.filter((u) => u.id !== event?.ownerId).map((u) => u.id) ??
      [],
    recurrence: event?.recurrence ?? {
      frequency: "none",
      interval: 1,
      endType: "never",
    },
  },
});
```

Also update the `useEffect` reset to include recurrence.

Add `<RecurrenceFields />` after the End Date field (around line 261):

```tsx
{
  /* End Date */
}
<FormField
  control={form.control}
  name="endDate"
  render={({ field }) => (
    <DateTimePicker
      form={form}
      field={field}
      hideTime={allDay}
      label={t("endDateLabel")}
    />
  )}
/>;

{
  /* Recurrence - Only show for new events */
}
{
  !isEditing && <RecurrenceFields />;
}
```

**Step 2: Update onSubmit to handle recurrence**

Update the `onSubmit` function to include recurrence data when calling the API:

```typescript
const onSubmit = async (values: TEventFormData) => {
  try {
    // Build users array from ownerId and participantIds
    const owner = users.find((u) => u.id === values.ownerId);
    const participants = users.filter((u) =>
      values.participantIds.includes(u.id)
    );
    const eventUsers = owner ? [owner, ...participants] : participants;

    const hasRecurrence = values.recurrence?.frequency !== "none";

    const formattedEvent: IEvent = {
      id: isEditing ? event.id : Math.floor(Math.random() * 1000000).toString(),
      title: values.title,
      description: values.description ?? "",
      startDate: format(values.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
      endDate: format(values.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
      category: values.category as TEventCategory,
      eventType: values.eventType as TEventType,
      allDay: values.allDay,
      ownerId: values.ownerId,
      users: eventUsers,
      recurrence: hasRecurrence
        ? {
            frequency: values.recurrence.frequency as
              | "daily"
              | "weekly"
              | "monthly"
              | "yearly",
            interval: values.recurrence.interval,
            endType: values.recurrence.endType,
            endCount: values.recurrence.endCount,
            endDate: values.recurrence.endDate?.toISOString(),
          }
        : undefined,
    };

    if (isEditing) {
      updateEvent(formattedEvent);
      toast.success(t("successUpdate"));
    } else {
      addEvent(formattedEvent);
      toast.success(
        hasRecurrence ? t("successCreateRecurring") : t("successCreate")
      );
    }

    onClose();
    form.reset();
  } catch (error) {
    console.error(`Error ${isEditing ? "editing" : "adding"} event:`, error);
    toast.error(isEditing ? t("errorUpdate") : t("errorCreate"));
  }
};
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 4: Run dev server and test**

Run: `pnpm dev`
Navigate to calendar, click add event, verify recurrence fields appear.

**Step 5: Commit**

```bash
git add src/components/calendar/dialogs/add-edit-event-dialog.tsx
git commit -m "feat(ui): integrate RecurrenceFields into AddEditEventDialog"
```

---

## Task 11: Edit/Delete Scope Dialog

**Files:**

- Create: `src/components/calendar/dialogs/recurring-event-scope-dialog.tsx`

**Step 1: Create the scope selection dialog**

Create `src/components/calendar/dialogs/recurring-event-scope-dialog.tsx`:

```typescript
"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface RecurringEventScopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "edit" | "delete";
  onSelectScope: (scope: "this" | "all") => void;
}

export function RecurringEventScopeDialog({
  open,
  onOpenChange,
  mode,
  onSelectScope,
}: RecurringEventScopeDialogProps) {
  const t = useTranslations("EventDialog");

  const handleThis = () => {
    onSelectScope("this");
    onOpenChange(false);
  };

  const handleAll = () => {
    onSelectScope("all");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("recurringEventTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {mode === "edit"
              ? t("editRecurringDescription")
              : t("deleteRecurringDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleThis} variant="outline">
            {mode === "edit" ? t("editThisEvent") : t("deleteThisEvent")}
          </AlertDialogAction>
          <AlertDialogAction onClick={handleAll}>
            {mode === "edit" ? t("editAllEvents") : t("deleteAllEvents")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/components/calendar/dialogs/recurring-event-scope-dialog.tsx
git commit -m "feat(ui): add RecurringEventScopeDialog component"
```

---

## Task 12: Integration Testing

**Files:**

- Create: `e2e/tests/calendar/recurring-events.spec.ts`

**Step 1: Create E2E test**

Create `e2e/tests/calendar/recurring-events.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { authenticatedTest } from "../../fixtures/auth-fixture";

authenticatedTest.describe("Recurring Events", () => {
  authenticatedTest(
    "can create a weekly recurring event",
    async ({ authenticatedPage: page }) => {
      // Navigate to calendar
      await page.goto("/nl/calendar");
      await page.waitForLoadState("networkidle");

      // Click add event button (adjust selector as needed)
      await page.click('[data-testid="add-event-button"]');

      // Fill in event details
      await page.fill('[name="title"]', "Weekly Team Meeting");

      // Open recurrence section
      await page.click('button:has-text("Repeat")');

      // Select weekly frequency
      await page.click('[name="recurrence.frequency"]');
      await page.click("text=Weekly");

      // Set to repeat 4 times
      await page.click('[name="recurrence.endType"]');
      await page.click("text=After occurrences");
      await page.fill('[name="recurrence.endCount"]', "4");

      // Submit form
      await page.click('button[type="submit"]');

      // Verify success toast
      await expect(page.locator("text=Created")).toBeVisible();
    }
  );

  authenticatedTest(
    "shows recurring indicator on events",
    async ({ authenticatedPage: page }) => {
      // This test assumes a recurring event exists
      await page.goto("/nl/calendar");
      await page.waitForLoadState("networkidle");

      // Look for recurring event indicator (adjust based on your UI)
      // This is a placeholder - implement based on actual UI
    }
  );
});
```

**Step 2: Run E2E tests**

Run: `pnpm e2e e2e/tests/calendar/recurring-events.spec.ts`
Expected: Tests run (may fail if UI elements differ - adjust selectors)

**Step 3: Commit**

```bash
git add e2e/tests/calendar/recurring-events.spec.ts
git commit -m "test(e2e): add recurring events test"
```

---

## Task 13: Cron Job for Horizon Extension

**Files:**

- Create: `src/server/jobs/extend-recurring-events.ts`
- Create: `src/app/api/cron/extend-recurring-events/route.ts`

**Step 1: Create the job logic**

Create `src/server/jobs/extend-recurring-events.ts`:

```typescript
import { db } from "@/server/db";
import {
  events,
  eventParticipants,
  recurringEventPatterns,
} from "@/server/schema";
import { eq, and, lte } from "drizzle-orm";
import { addYears, addDays } from "date-fns";
import { createId } from "@paralleldrive/cuid2";
import {
  generateOccurrenceDates,
  getEventDuration,
  applyDuration,
} from "@/server/utils/recurrence";

const EXTENSION_THRESHOLD_DAYS = 30;
const EXTENSION_HORIZON_YEARS = 1;

export async function extendRecurringEvents(): Promise<{
  patternsExtended: number;
  eventsCreated: number;
}> {
  const thresholdDate = addDays(new Date(), EXTENSION_THRESHOLD_DAYS);

  // Find patterns that need extension
  const patternsToExtend = await db
    .select()
    .from(recurringEventPatterns)
    .where(lte(recurringEventPatterns.generatedUntil, thresholdDate));

  let eventsCreated = 0;

  for (const pattern of patternsToExtend) {
    // Get the most recent event as template
    const templateEvents = await db
      .select()
      .from(events)
      .where(eq(events.recurringPatternId, pattern.id))
      .orderBy(events.startTime)
      .limit(1);

    if (templateEvents.length === 0) continue;

    const templateEvent = templateEvents[0];

    // Get participants from template
    const templateParticipants = await db
      .select()
      .from(eventParticipants)
      .where(eq(eventParticipants.eventId, templateEvent.id));

    // Calculate new horizon
    const newHorizon = addYears(new Date(), EXTENSION_HORIZON_YEARS);

    // Generate new occurrences from where we left off
    const newOccurrences = generateOccurrenceDates({
      startDate: addDays(pattern.generatedUntil, 1), // Start from day after last generated
      frequency: pattern.frequency as "daily" | "weekly" | "monthly" | "yearly",
      interval: pattern.interval,
      endType: pattern.endType as "never" | "count" | "date",
      endCount: pattern.endCount ?? undefined,
      endDate: pattern.endDate ?? undefined,
      untilDate: newHorizon,
    });

    // Calculate duration from template
    const durationMs = getEventDuration(
      templateEvent.startTime,
      templateEvent.endTime
    );

    // Create new event occurrences
    await db.transaction(async (tx) => {
      for (const occurrenceDate of newOccurrences) {
        const eventId = createId();
        const endTime = applyDuration(occurrenceDate, durationMs);

        await tx.insert(events).values({
          id: eventId,
          familyId: templateEvent.familyId,
          title: templateEvent.title,
          description: templateEvent.description,
          location: templateEvent.location,
          startTime: occurrenceDate,
          endTime,
          allDay: templateEvent.allDay,
          color: templateEvent.color,
          category: templateEvent.category,
          eventType: templateEvent.eventType,
          recurringPatternId: pattern.id,
          occurrenceDate,
          syncStatus: "synced",
          localUpdatedAt: new Date(),
        });

        // Copy participants
        for (const participant of templateParticipants) {
          await tx.insert(eventParticipants).values({
            id: createId(),
            eventId,
            familyMemberId: participant.familyMemberId,
            isOwner: participant.isOwner,
          });
        }

        eventsCreated++;
      }

      // Update pattern's generatedUntil
      await tx
        .update(recurringEventPatterns)
        .set({ generatedUntil: newHorizon })
        .where(eq(recurringEventPatterns.id, pattern.id));
    });
  }

  return {
    patternsExtended: patternsToExtend.length,
    eventsCreated,
  };
}
```

**Step 2: Create the API endpoint**

Create `src/app/api/cron/extend-recurring-events/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { extendRecurringEvents } from "@/server/jobs/extend-recurring-events";

// Vercel Cron config
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

export async function GET(request: Request) {
  try {
    // Verify cron secret (for security)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await extendRecurringEvents();

    console.log(
      `[CRON] Extended ${result.patternsExtended} patterns, created ${result.eventsCreated} events`
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[CRON] Error extending recurring events:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to extend recurring events",
      },
      { status: 500 }
    );
  }
}
```

**Step 3: Add to vercel.json (if using Vercel)**

If deploying to Vercel, add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/extend-recurring-events",
      "schedule": "0 2 * * 0"
    }
  ]
}
```

**Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: Commit**

```bash
git add src/server/jobs/extend-recurring-events.ts src/app/api/cron/extend-recurring-events/route.ts
git commit -m "feat(cron): add recurring events horizon extension job"
```

---

## Task 14: Final Verification

**Step 1: Run full test suite**

Run: `pnpm test:run`
Expected: All tests pass

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Run linting**

Run: `pnpm lint`
Expected: No errors (or only warnings)

**Step 4: Run build**

Run: `pnpm build`
Expected: Build succeeds

**Step 5: Manual testing**

1. Start dev server: `pnpm dev`
2. Create a weekly recurring event ending after 4 occurrences
3. Verify 4 events appear on the calendar
4. Edit one occurrence (scope: this)
5. Edit all occurrences (scope: all)
6. Delete one occurrence
7. Delete all occurrences

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete recurring events implementation"
```
