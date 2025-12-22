# Calendar Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect the existing calendar UI to the database with full CRUD operations, multi-participant events, and interaction mode support (Wall Display vs Management).

**Architecture:** Add `event_participants` junction table for multi-member events, create REST API routes under `/api/v1/families/[familyId]/events`, replace mock data with TanStack Query hooks, and implement mode-based UI restrictions.

**Tech Stack:** Next.js 16, Drizzle ORM, PostgreSQL, TanStack Query, Zod validation

---

## Current State

**Already Built:**

- Full calendar UI (Day, Week, Month, Year, Agenda views)
- CalendarProvider context for local state
- DndProvider for drag-and-drop
- Events schema in database (missing participants)
- Google Calendar sync infrastructure
- Mock data in `requests.ts`

**Missing (this plan):**

1. `event_participants` table
2. Event CRUD API routes
3. Database queries replacing mocks
4. Frontend API integration
5. Interaction mode restrictions

---

## Task 1: Add event_participants Schema

**Files:**

- Modify: `src/server/schema.ts`

**Step 1: Read current schema**

Verify current events table structure exists.

**Step 2: Add event_participants table**

Add after the `events` table definition in `src/server/schema.ts`:

```typescript
/**
 * Event Participants table - Junction table for multi-participant events
 */
export const eventParticipants = pgTable("event_participants", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  familyMemberId: text("family_member_id")
    .notNull()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  isOwner: boolean("is_owner").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 3: Add relations**

Add after existing relations:

```typescript
export const eventParticipantsRelations = relations(
  eventParticipants,
  ({ one }) => ({
    event: one(events, {
      fields: [eventParticipants.eventId],
      references: [events.id],
    }),
    familyMember: one(familyMembers, {
      fields: [eventParticipants.familyMemberId],
      references: [familyMembers.id],
    }),
  })
);
```

**Step 4: Update events relations**

Modify `eventsRelations` to include participants:

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
  participants: many(eventParticipants),
}));
```

**Step 5: Add type exports**

```typescript
export type EventParticipant = typeof eventParticipants.$inferSelect;
export type NewEventParticipant = typeof eventParticipants.$inferInsert;
```

**Step 6: Run test to verify schema compiles**

Run: `pnpm tsc --noEmit`
Expected: No TypeScript errors

**Step 7: Generate migration**

Run: `pnpm db:generate`
Expected: Migration file created in `drizzle/`

**Step 8: Apply migration**

Run: `pnpm db:migrate`
Expected: Migration applied successfully

**Step 9: Commit**

```bash
git add src/server/schema.ts drizzle/
git commit -m "feat(calendar): add event_participants table"
```

---

## Task 2: Create Event Validation Schemas

**Files:**

- Create: `src/lib/validations/event.ts`

**Step 1: Create validation file**

Create `src/lib/validations/event.ts`:

```typescript
import { z } from "zod";

export const eventColorSchema = z.enum([
  "blue",
  "green",
  "red",
  "yellow",
  "purple",
  "orange",
]);

export const createEventSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().max(2000).nullable().optional(),
    location: z.string().max(500).nullable().optional(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date(),
    allDay: z.boolean().default(false),
    color: eventColorSchema.nullable().optional(),
    googleCalendarId: z.string().nullable().optional(),
    participantIds: z
      .array(z.string())
      .min(1, "At least one participant required"),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export const updateEventSchema = createEventSchema.partial().extend({
  id: z.string(),
});

export const eventQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  participantIds: z.array(z.string()).optional(),
  colors: z.array(eventColorSchema).optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type EventQueryInput = z.infer<typeof eventQuerySchema>;
```

**Step 2: Run test to verify schema**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/validations/event.ts
git commit -m "feat(calendar): add event validation schemas"
```

---

## Task 3: Create Event Service

**Files:**

- Create: `src/server/services/event-service.ts`

**Step 1: Create service file**

Create `src/server/services/event-service.ts`:

```typescript
import { db } from "@/server/db";
import {
  events,
  eventParticipants,
  familyMembers,
  users,
  googleCalendars,
} from "@/server/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type {
  CreateEventInput,
  UpdateEventInput,
  EventQueryInput,
} from "@/lib/validations/event";

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
  participants: {
    id: string;
    familyMemberId: string;
    displayName: string | null;
    avatarColor: string | null;
    userName: string;
    userImage: string | null;
    isOwner: boolean;
  }[];
}

export async function getEventsForFamily(
  familyId: string,
  query?: EventQueryInput
): Promise<EventWithParticipants[]> {
  const conditions = [eq(events.familyId, familyId)];

  if (query?.startDate) {
    conditions.push(gte(events.startTime, query.startDate));
  }
  if (query?.endDate) {
    conditions.push(lte(events.endTime, query.endDate));
  }
  if (query?.colors && query.colors.length > 0) {
    conditions.push(inArray(events.color, query.colors));
  }

  const eventRows = await db
    .select({
      event: events,
      calendar: googleCalendars,
    })
    .from(events)
    .leftJoin(googleCalendars, eq(events.googleCalendarId, googleCalendars.id))
    .where(and(...conditions))
    .orderBy(events.startTime);

  const eventIds = eventRows.map((r) => r.event.id);
  if (eventIds.length === 0) return [];

  const participantRows = await db
    .select({
      eventParticipant: eventParticipants,
      familyMember: familyMembers,
      user: users,
    })
    .from(eventParticipants)
    .innerJoin(
      familyMembers,
      eq(eventParticipants.familyMemberId, familyMembers.id)
    )
    .innerJoin(users, eq(familyMembers.userId, users.id))
    .where(inArray(eventParticipants.eventId, eventIds));

  const participantsByEvent = new Map<
    string,
    EventWithParticipants["participants"]
  >();
  for (const row of participantRows) {
    const eventId = row.eventParticipant.eventId;
    if (!participantsByEvent.has(eventId)) {
      participantsByEvent.set(eventId, []);
    }
    participantsByEvent.get(eventId)!.push({
      id: row.eventParticipant.id,
      familyMemberId: row.familyMember.id,
      displayName: row.familyMember.displayName,
      avatarColor: row.familyMember.avatarColor,
      userName: row.user.name,
      userImage: row.user.image,
      isOwner: row.eventParticipant.isOwner,
    });
  }

  let result = eventRows.map((row) => ({
    id: row.event.id,
    familyId: row.event.familyId,
    title: row.event.title,
    description: row.event.description,
    location: row.event.location,
    startTime: row.event.startTime,
    endTime: row.event.endTime,
    allDay: row.event.allDay,
    color: row.event.color,
    googleCalendarId: row.event.googleCalendarId,
    googleEventId: row.event.googleEventId,
    syncStatus: row.event.syncStatus,
    calendarName: row.calendar?.name ?? null,
    calendarColor: row.calendar?.color ?? null,
    accessRole: row.calendar?.accessRole ?? null,
    participants: participantsByEvent.get(row.event.id) ?? [],
  }));

  // Filter by participant if requested
  if (query?.participantIds && query.participantIds.length > 0) {
    result = result.filter((event) =>
      event.participants.some((p) =>
        query.participantIds!.includes(p.familyMemberId)
      )
    );
  }

  return result;
}

export async function getEventById(
  eventId: string,
  familyId: string
): Promise<EventWithParticipants | null> {
  const eventRows = await db
    .select({
      event: events,
      calendar: googleCalendars,
    })
    .from(events)
    .leftJoin(googleCalendars, eq(events.googleCalendarId, googleCalendars.id))
    .where(and(eq(events.id, eventId), eq(events.familyId, familyId)))
    .limit(1);

  if (eventRows.length === 0) return null;

  const row = eventRows[0];

  const participantRows = await db
    .select({
      eventParticipant: eventParticipants,
      familyMember: familyMembers,
      user: users,
    })
    .from(eventParticipants)
    .innerJoin(
      familyMembers,
      eq(eventParticipants.familyMemberId, familyMembers.id)
    )
    .innerJoin(users, eq(familyMembers.userId, users.id))
    .where(eq(eventParticipants.eventId, eventId));

  return {
    id: row.event.id,
    familyId: row.event.familyId,
    title: row.event.title,
    description: row.event.description,
    location: row.event.location,
    startTime: row.event.startTime,
    endTime: row.event.endTime,
    allDay: row.event.allDay,
    color: row.event.color,
    googleCalendarId: row.event.googleCalendarId,
    googleEventId: row.event.googleEventId,
    syncStatus: row.event.syncStatus,
    calendarName: row.calendar?.name ?? null,
    calendarColor: row.calendar?.color ?? null,
    accessRole: row.calendar?.accessRole ?? null,
    participants: participantRows.map((p) => ({
      id: p.eventParticipant.id,
      familyMemberId: p.familyMember.id,
      displayName: p.familyMember.displayName,
      avatarColor: p.familyMember.avatarColor,
      userName: p.user.name,
      userImage: p.user.image,
      isOwner: p.eventParticipant.isOwner,
    })),
  };
}

export async function createEvent(
  familyId: string,
  input: CreateEventInput,
  creatorMemberId: string
): Promise<EventWithParticipants> {
  const eventId = createId();

  await db.insert(events).values({
    id: eventId,
    familyId,
    title: input.title,
    description: input.description ?? null,
    location: input.location ?? null,
    startTime: input.startTime,
    endTime: input.endTime,
    allDay: input.allDay,
    color: input.color ?? null,
    googleCalendarId: input.googleCalendarId ?? null,
    syncStatus: input.googleCalendarId ? "pending" : "synced",
    localUpdatedAt: new Date(),
  });

  // Add participants
  const participantValues = input.participantIds.map((memberId) => ({
    id: createId(),
    eventId,
    familyMemberId: memberId,
    isOwner: memberId === creatorMemberId,
  }));

  await db.insert(eventParticipants).values(participantValues);

  const created = await getEventById(eventId, familyId);
  if (!created) throw new Error("Failed to create event");

  return created;
}

export async function updateEvent(
  eventId: string,
  familyId: string,
  input: Partial<CreateEventInput>
): Promise<EventWithParticipants> {
  const existing = await getEventById(eventId, familyId);
  if (!existing) throw new Error("Event not found");

  // Check if event is read-only (from read-only Google Calendar)
  if (existing.accessRole === "reader") {
    throw new Error("Cannot edit events from read-only calendars");
  }

  await db
    .update(events)
    .set({
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.startTime !== undefined && { startTime: input.startTime }),
      ...(input.endTime !== undefined && { endTime: input.endTime }),
      ...(input.allDay !== undefined && { allDay: input.allDay }),
      ...(input.color !== undefined && { color: input.color }),
      syncStatus: existing.googleCalendarId ? "pending" : "synced",
      localUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId));

  // Update participants if provided
  if (input.participantIds) {
    await db
      .delete(eventParticipants)
      .where(eq(eventParticipants.eventId, eventId));

    const participantValues = input.participantIds.map((memberId) => ({
      id: createId(),
      eventId,
      familyMemberId: memberId,
      isOwner:
        existing.participants.find((p) => p.isOwner)?.familyMemberId ===
        memberId,
    }));

    await db.insert(eventParticipants).values(participantValues);
  }

  const updated = await getEventById(eventId, familyId);
  if (!updated) throw new Error("Failed to update event");

  return updated;
}

export async function deleteEvent(
  eventId: string,
  familyId: string
): Promise<void> {
  const existing = await getEventById(eventId, familyId);
  if (!existing) throw new Error("Event not found");

  // Check if event is read-only
  if (existing.accessRole === "reader") {
    throw new Error("Cannot delete events from read-only calendars");
  }

  // Cascade will handle eventParticipants
  await db.delete(events).where(eq(events.id, eventId));
}

export async function isEventEditable(
  eventId: string,
  familyId: string
): Promise<boolean> {
  const event = await getEventById(eventId, familyId);
  if (!event) return false;
  return event.accessRole !== "reader";
}
```

**Step 2: Run test to verify service compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/event-service.ts
git commit -m "feat(calendar): add event service with CRUD operations"
```

---

## Task 4: Create Events API Routes

**Files:**

- Create: `src/app/api/v1/families/[familyId]/events/route.ts`
- Create: `src/app/api/v1/families/[familyId]/events/[eventId]/route.ts`

**Step 1: Create events list/create route**

Create directory and file `src/app/api/v1/families/[familyId]/events/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import {
  isUserFamilyMember,
  isUserFamilyManager,
  getMemberByUserId,
} from "@/server/services/family-service";
import {
  getEventsForFamily,
  createEvent,
} from "@/server/services/event-service";
import { createEventSchema, eventQuerySchema } from "@/lib/validations/event";

type Params = { params: Promise<{ familyId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a member of this family" },
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = eventQuerySchema.parse({
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      participantIds: searchParams.getAll("participantIds"),
      colors: searchParams.getAll("colors"),
    });

    const events = await getEventsForFamily(familyId, query);

    return NextResponse.json({
      success: true,
      data: { events },
    });
  } catch (error) {
    console.error("Error getting events:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to get events" },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can create events",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0].message,
          },
        },
        { status: 400 }
      );
    }

    const member = await getMemberByUserId(session.user.id, familyId);
    if (!member) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Member not found" },
        },
        { status: 404 }
      );
    }

    const event = await createEvent(familyId, parsed.data, member.id);

    return NextResponse.json(
      { success: true, data: { event } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create event" },
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Create single event route**

Create `src/app/api/v1/families/[familyId]/events/[eventId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import {
  isUserFamilyMember,
  isUserFamilyManager,
} from "@/server/services/family-service";
import {
  getEventById,
  updateEvent,
  deleteEvent,
} from "@/server/services/event-service";
import { updateEventSchema } from "@/lib/validations/event";

type Params = { params: Promise<{ familyId: string; eventId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, eventId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a member of this family" },
        },
        { status: 403 }
      );
    }

    const event = await getEventById(eventId, familyId);
    if (!event) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Event not found" },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { event },
    });
  } catch (error) {
    console.error("Error getting event:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to get event" },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, eventId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can edit events",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateEventSchema.partial().safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0].message,
          },
        },
        { status: 400 }
      );
    }

    const event = await updateEvent(eventId, familyId, parsed.data);

    return NextResponse.json({
      success: true,
      data: { event },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update event";
    console.error("Error updating event:", error);

    if (message.includes("read-only")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message },
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, eventId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can delete events",
          },
        },
        { status: 403 }
      );
    }

    await deleteEvent(eventId, familyId);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete event";
    console.error("Error deleting event:", error);

    if (message.includes("read-only")) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message },
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message },
      },
      { status: 500 }
    );
  }
}
```

**Step 3: Run test to verify routes compile**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/events/
git commit -m "feat(calendar): add event CRUD API routes"
```

---

## Task 5: Add getMemberByUserId to Family Service

**Files:**

- Modify: `src/server/services/family-service.ts`

**Step 1: Read current family service**

Check if `getMemberByUserId` already exists.

**Step 2: Add function if missing**

Add to `src/server/services/family-service.ts`:

```typescript
export async function getMemberByUserId(
  userId: string,
  familyId: string
): Promise<FamilyMember | null> {
  const result = await db
    .select()
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.userId, userId),
        eq(familyMembers.familyId, familyId)
      )
    )
    .limit(1);

  return result[0] ?? null;
}
```

**Step 3: Verify compilation**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/services/family-service.ts
git commit -m "feat(calendar): add getMemberByUserId helper"
```

---

## Task 6: Create TanStack Query Hooks for Events

**Files:**

- Create: `src/hooks/use-events.ts`

**Step 1: Create hooks file**

Create `src/hooks/use-events.ts`:

```typescript
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { EventWithParticipants } from "@/server/services/event-service";
import type {
  CreateEventInput,
  UpdateEventInput,
} from "@/lib/validations/event";

interface EventsQueryParams {
  startDate?: Date;
  endDate?: Date;
  participantIds?: string[];
  colors?: string[];
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function fetchEvents(
  familyId: string,
  params?: EventsQueryParams
): Promise<EventWithParticipants[]> {
  const searchParams = new URLSearchParams();

  if (params?.startDate) {
    searchParams.set("startDate", params.startDate.toISOString());
  }
  if (params?.endDate) {
    searchParams.set("endDate", params.endDate.toISOString());
  }
  if (params?.participantIds) {
    params.participantIds.forEach((id) =>
      searchParams.append("participantIds", id)
    );
  }
  if (params?.colors) {
    params.colors.forEach((color) => searchParams.append("colors", color));
  }

  const response = await fetch(
    `/api/v1/families/${familyId}/events?${searchParams.toString()}`
  );
  const json: ApiResponse<{ events: EventWithParticipants[] }> =
    await response.json();

  if (!json.success) {
    throw new Error(json.error?.message ?? "Failed to fetch events");
  }

  return json.data?.events ?? [];
}

export function useEvents(familyId: string, params?: EventsQueryParams) {
  return useQuery({
    queryKey: ["events", familyId, params],
    queryFn: () => fetchEvents(familyId, params),
    enabled: !!familyId,
  });
}

export function useEvent(familyId: string, eventId: string) {
  return useQuery({
    queryKey: ["events", familyId, eventId],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/families/${familyId}/events/${eventId}`
      );
      const json: ApiResponse<{ event: EventWithParticipants }> =
        await response.json();

      if (!json.success) {
        throw new Error(json.error?.message ?? "Failed to fetch event");
      }

      return json.data?.event;
    },
    enabled: !!familyId && !!eventId,
  });
}

export function useCreateEvent(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateEventInput) => {
      const response = await fetch(`/api/v1/families/${familyId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const json: ApiResponse<{ event: EventWithParticipants }> =
        await response.json();

      if (!json.success) {
        throw new Error(json.error?.message ?? "Failed to create event");
      }

      return json.data?.event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", familyId] });
    },
  });
}

export function useUpdateEvent(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      ...input
    }: Partial<CreateEventInput> & { eventId: string }) => {
      const response = await fetch(
        `/api/v1/families/${familyId}/events/${eventId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      );
      const json: ApiResponse<{ event: EventWithParticipants }> =
        await response.json();

      if (!json.success) {
        throw new Error(json.error?.message ?? "Failed to update event");
      }

      return json.data?.event;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", familyId] });
    },
  });
}

export function useDeleteEvent(familyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (eventId: string) => {
      const response = await fetch(
        `/api/v1/families/${familyId}/events/${eventId}`,
        { method: "DELETE" }
      );
      const json: ApiResponse<void> = await response.json();

      if (!json.success) {
        throw new Error(json.error?.message ?? "Failed to delete event");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", familyId] });
    },
  });
}
```

**Step 2: Verify compilation**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/use-events.ts
git commit -m "feat(calendar): add TanStack Query hooks for events"
```

---

## Task 7: Update Calendar Requests to Use API

**Files:**

- Modify: `src/components/calendar/requests.ts`

**Step 1: Update requests.ts**

Replace `src/components/calendar/requests.ts`:

```typescript
import type { IEvent, IUser } from "@/components/calendar/interfaces";
import type { EventWithParticipants } from "@/server/services/event-service";

// Transform API response to calendar IEvent format
export function transformEventToIEvent(event: EventWithParticipants): IEvent {
  return {
    id: event.id,
    title: event.title,
    description: event.description ?? "",
    startDate: event.startTime.toISOString(),
    endDate: event.endTime.toISOString(),
    color: (event.color as IEvent["color"]) ?? "blue",
    users: event.participants.map((p) => ({
      id: p.familyMemberId,
      name: p.displayName ?? p.userName,
      avatarFallback: (p.displayName ?? p.userName).slice(0, 2).toUpperCase(),
      avatarColor: p.avatarColor ?? "bg-primary",
      avatarUrl: p.userImage ?? undefined,
    })),
  };
}

// Transform family members to calendar IUser format
export function transformMemberToIUser(member: {
  id: string;
  displayName: string | null;
  avatarColor: string | null;
  user: { name: string; image: string | null };
}): IUser {
  const name = member.displayName ?? member.user.name;
  return {
    id: member.id,
    name,
    avatarFallback: name.slice(0, 2).toUpperCase(),
    avatarColor: member.avatarColor ?? "bg-primary",
    avatarUrl: member.user.image ?? undefined,
  };
}

// Legacy exports for backward compatibility during migration
export { CALENDAR_ITEMS_MOCK, USERS_MOCK } from "@/components/calendar/mocks";
```

**Step 2: Verify compilation**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/calendar/requests.ts
git commit -m "feat(calendar): add API response transformers"
```

---

## Task 8: Create Calendar Data Provider

**Files:**

- Create: `src/components/calendar/providers/calendar-data-provider.tsx`

**Step 1: Create provider file**

Create directory and file `src/components/calendar/providers/calendar-data-provider.tsx`:

```typescript
"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useEvents, useCreateEvent, useUpdateEvent, useDeleteEvent } from "@/hooks/use-events";
import { transformEventToIEvent, transformMemberToIUser } from "@/components/calendar/requests";
import type { IEvent, IUser } from "@/components/calendar/interfaces";

interface CalendarDataContextValue {
  events: IEvent[];
  users: IUser[];
  isLoading: boolean;
  error: Error | null;
  createEvent: (input: Parameters<ReturnType<typeof useCreateEvent>["mutateAsync"]>[0]) => Promise<void>;
  updateEvent: (input: Parameters<ReturnType<typeof useUpdateEvent>["mutateAsync"]>[0]) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

const CalendarDataContext = createContext<CalendarDataContextValue | null>(null);

interface CalendarDataProviderProps {
  familyId: string;
  members: Array<{
    id: string;
    displayName: string | null;
    avatarColor: string | null;
    user: { name: string; image: string | null };
  }>;
  children: ReactNode;
}

export function CalendarDataProvider({
  familyId,
  members,
  children,
}: CalendarDataProviderProps) {
  const { data: eventsData, isLoading, error } = useEvents(familyId);
  const createMutation = useCreateEvent(familyId);
  const updateMutation = useUpdateEvent(familyId);
  const deleteMutation = useDeleteEvent(familyId);

  const events = useMemo(
    () => (eventsData ?? []).map(transformEventToIEvent),
    [eventsData]
  );

  const users = useMemo(
    () => members.map(transformMemberToIUser),
    [members]
  );

  const value: CalendarDataContextValue = useMemo(
    () => ({
      events,
      users,
      isLoading,
      error: error as Error | null,
      createEvent: async (input) => {
        await createMutation.mutateAsync(input);
      },
      updateEvent: async (input) => {
        await updateMutation.mutateAsync(input);
      },
      deleteEvent: async (eventId) => {
        await deleteMutation.mutateAsync(eventId);
      },
      isCreating: createMutation.isPending,
      isUpdating: updateMutation.isPending,
      isDeleting: deleteMutation.isPending,
    }),
    [
      events,
      users,
      isLoading,
      error,
      createMutation,
      updateMutation,
      deleteMutation,
    ]
  );

  return (
    <CalendarDataContext.Provider value={value}>
      {children}
    </CalendarDataContext.Provider>
  );
}

export function useCalendarData() {
  const context = useContext(CalendarDataContext);
  if (!context) {
    throw new Error(
      "useCalendarData must be used within a CalendarDataProvider"
    );
  }
  return context;
}
```

**Step 2: Verify compilation**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/calendar/providers/
git commit -m "feat(calendar): add CalendarDataProvider for API integration"
```

---

## Task 9: Add Interaction Mode Context

**Files:**

- Create: `src/components/calendar/contexts/interaction-mode-context.tsx`

**Step 1: Create mode context**

Create `src/components/calendar/contexts/interaction-mode-context.tsx`:

```typescript
"use client";

import { createContext, useContext, type ReactNode } from "react";

export type InteractionMode = "wall" | "management";

interface InteractionModeContextValue {
  mode: InteractionMode;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  canDragDrop: boolean;
}

const InteractionModeContext = createContext<InteractionModeContextValue | null>(null);

interface InteractionModeProviderProps {
  mode: InteractionMode;
  children: ReactNode;
}

export function InteractionModeProvider({
  mode,
  children,
}: InteractionModeProviderProps) {
  const isManagement = mode === "management";

  const value: InteractionModeContextValue = {
    mode,
    canEdit: isManagement,
    canCreate: isManagement,
    canDelete: isManagement,
    canDragDrop: isManagement,
  };

  return (
    <InteractionModeContext.Provider value={value}>
      {children}
    </InteractionModeContext.Provider>
  );
}

export function useInteractionMode() {
  const context = useContext(InteractionModeContext);
  if (!context) {
    throw new Error(
      "useInteractionMode must be used within an InteractionModeProvider"
    );
  }
  return context;
}
```

**Step 2: Verify compilation**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/calendar/contexts/interaction-mode-context.tsx
git commit -m "feat(calendar): add interaction mode context (wall vs management)"
```

---

## Task 10: Update Calendar Page to Use Real Data

**Files:**

- Modify: `src/app/[locale]/(family-required)/(manage)/calendar/page.tsx`
- Modify: `src/app/[locale]/(family-required)/(manage)/calendar/calendar-page-client.tsx`

**Step 1: Read current calendar page**

Review current implementation to understand the structure.

**Step 2: Update server page**

Update `src/app/[locale]/(family-required)/(manage)/calendar/page.tsx`:

```typescript
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { getFamilyFromSession } from "@/server/services/session-family-service";
import { getFamilyMembers } from "@/server/services/family-service";
import { CalendarPageClient } from "./calendar-page-client";

export default async function CalendarPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/login");
  }

  const family = await getFamilyFromSession();
  if (!family) {
    redirect("/families");
  }

  const members = await getFamilyMembers(family.id);

  return (
    <CalendarPageClient
      familyId={family.id}
      members={members}
      mode="management"
    />
  );
}
```

**Step 3: Update client page**

Update `src/app/[locale]/(family-required)/(manage)/calendar/calendar-page-client.tsx`:

```typescript
"use client";

import { Calendar } from "@/components/calendar/calendar";
import { CalendarDataProvider } from "@/components/calendar/providers/calendar-data-provider";
import { InteractionModeProvider, type InteractionMode } from "@/components/calendar/contexts/interaction-mode-context";

interface CalendarPageClientProps {
  familyId: string;
  members: Array<{
    id: string;
    displayName: string | null;
    avatarColor: string | null;
    user: { name: string; image: string | null };
  }>;
  mode: InteractionMode;
}

export function CalendarPageClient({
  familyId,
  members,
  mode,
}: CalendarPageClientProps) {
  return (
    <InteractionModeProvider mode={mode}>
      <CalendarDataProvider familyId={familyId} members={members}>
        <CalendarWithData />
      </CalendarDataProvider>
    </InteractionModeProvider>
  );
}

function CalendarWithData() {
  // Calendar component will be updated in Task 11 to use useCalendarData
  return <Calendar />;
}
```

**Step 4: Verify compilation**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/app/\[locale\]/\(family-required\)/\(manage\)/calendar/
git commit -m "feat(calendar): integrate real data in management calendar page"
```

---

## Task 11: Update Calendar Component to Use Data Provider

**Files:**

- Modify: `src/components/calendar/calendar.tsx`

**Step 1: Read current calendar component**

Review current props and structure.

**Step 2: Update calendar to use providers**

The Calendar component needs to:

1. Accept optional `events` and `users` props (for backward compatibility)
2. Fall back to `useCalendarData` if props not provided
3. Use `useInteractionMode` for edit restrictions

Update the component to conditionally use the data provider:

```typescript
// Add to calendar.tsx
import { useCalendarData } from "@/components/calendar/providers/calendar-data-provider";
import { useInteractionMode } from "@/components/calendar/contexts/interaction-mode-context";

// In the component, conditionally use context or props
const calendarDataContext = useCalendarData?.() ?? null;
const { events: contextEvents, users: contextUsers } =
  calendarDataContext ?? {};
const finalEvents = events ?? contextEvents ?? [];
const finalUsers = users ?? contextUsers ?? [];
```

**Step 3: Verify compilation**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Test the page**

Run: `pnpm dev`
Navigate to `/calendar` and verify it loads without errors.

**Step 5: Commit**

```bash
git add src/components/calendar/calendar.tsx
git commit -m "feat(calendar): support data provider in calendar component"
```

---

## Task 12: Update Wall Calendar Page

**Files:**

- Modify: `src/app/[locale]/(family-required)/(wall)/wall/calendar/page.tsx`
- Modify: `src/app/[locale]/(family-required)/(wall)/wall/calendar/wall-calendar-page-client.tsx`

**Step 1: Update wall calendar server page**

Update to pass `mode="wall"`:

```typescript
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { getFamilyFromSession } from "@/server/services/session-family-service";
import { getFamilyMembers } from "@/server/services/family-service";
import { WallCalendarPageClient } from "./wall-calendar-page-client";

export default async function WallCalendarPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/auth/login");
  }

  const family = await getFamilyFromSession();
  if (!family) {
    redirect("/families");
  }

  const members = await getFamilyMembers(family.id);

  return (
    <WallCalendarPageClient
      familyId={family.id}
      members={members}
      mode="wall"
    />
  );
}
```

**Step 2: Update wall calendar client**

Reuse same pattern as management page but with `mode="wall"`.

**Step 3: Verify compilation**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/\[locale\]/\(family-required\)/\(wall\)/wall/calendar/
git commit -m "feat(calendar): integrate real data in wall calendar page"
```

---

## Task 13: Hide Edit Controls in Wall Mode

**Files:**

- Modify: `src/components/calendar/calendar-header.tsx`
- Modify: `src/components/calendar/dialogs/event-details-dialog.tsx`
- Modify: `src/components/calendar/dnd/draggable-event.tsx`

**Step 1: Update calendar header**

Hide "Add Event" button in wall mode:

```typescript
import { useInteractionMode } from "@/components/calendar/contexts/interaction-mode-context";

// In component:
const { canCreate } = useInteractionMode();

// In JSX, wrap add button:
{canCreate && (
  <Button onClick={() => setIsAddEventOpen(true)}>
    Add Event
  </Button>
)}
```

**Step 2: Update event details dialog**

Hide edit/delete buttons in wall mode:

```typescript
import { useInteractionMode } from "@/components/calendar/contexts/interaction-mode-context";

// In component:
const { canEdit, canDelete } = useInteractionMode();

// In JSX:
{canEdit && <Button onClick={handleEdit}>Edit</Button>}
{canDelete && <Button onClick={handleDelete}>Delete</Button>}
```

**Step 3: Disable drag in wall mode**

Update draggable to check mode:

```typescript
import { useInteractionMode } from "@/components/calendar/contexts/interaction-mode-context";

// In component:
const { canDragDrop } = useInteractionMode();

// Disable drag behavior when !canDragDrop
```

**Step 4: Verify compilation**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/calendar/
git commit -m "feat(calendar): hide edit controls in wall display mode"
```

---

## Task 14: Add Read-Only Event Indicator

**Files:**

- Modify: `src/components/calendar/views/week-and-day-view/event-block.tsx`
- Modify: `src/components/calendar/views/month-view/month-event-badge.tsx`

**Step 1: Update IEvent interface**

Add `isReadOnly` field to event interface in `interfaces.ts`:

```typescript
export interface IEvent {
  // ... existing fields
  isReadOnly?: boolean;
}
```

**Step 2: Update transformers**

In `requests.ts`, add read-only flag:

```typescript
export function transformEventToIEvent(event: EventWithParticipants): IEvent {
  return {
    // ... existing fields
    isReadOnly: event.accessRole === "reader",
  };
}
```

**Step 3: Add lock icon to event blocks**

In event display components, show lock icon for read-only events:

```tsx
import { Lock } from "lucide-react";

// In JSX:
{
  event.isReadOnly && (
    <Lock
      className="text-muted-foreground h-3 w-3"
      aria-label="Read-only event"
    />
  );
}
```

**Step 4: Verify compilation**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add src/components/calendar/
git commit -m "feat(calendar): add read-only indicator for Google Calendar events"
```

---

## Task 15: Final Verification

**Files:** None (verification only)

**Step 1: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 2: Run linting**

Run: `pnpm lint`
Expected: No errors

**Step 3: Run build**

Run: `pnpm build`
Expected: Build completes successfully

**Step 4: Test manually**

1. Start dev server: `pnpm dev`
2. Navigate to `/calendar`
3. Verify events load from database (initially empty)
4. Create a test event
5. Verify event appears
6. Edit the event
7. Delete the event
8. Navigate to `/wall/calendar`
9. Verify edit controls are hidden

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore(calendar): cleanup and final verification" || echo "No changes"
```

---

## Verification Checklist

After completing all tasks:

- [ ] `event_participants` table exists in database
- [ ] Events CRUD API returns proper responses
- [ ] Calendar loads events from API (not mocks)
- [ ] Create event saves to database
- [ ] Edit event updates database
- [ ] Delete event removes from database
- [ ] Wall mode hides edit controls
- [ ] Management mode shows all controls
- [ ] Read-only events show lock icon
- [ ] Read-only events cannot be edited/deleted
- [ ] Drag-and-drop works in management mode
- [ ] Drag-and-drop disabled in wall mode
- [ ] Type check passes
- [ ] Lint passes
- [ ] Build succeeds

---

## Dependencies

This plan depends on:

- Families feature (for `familyMembers` table)
- Google Sync feature (for `googleCalendars` table and sync status)
- Auth system (for session and user context)

---

## Out of Scope

Not included in this plan (future work):

- Google Calendar 2-way sync (push changes back to Google)
- Recurring events
- Event reminders/notifications
- Event search
- Bulk operations
- Offline support
