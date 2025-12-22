# Google Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable 2-way synchronization between Family Planner and Google Calendar, supporting multiple Google accounts per family.

**Architecture:** Build on existing multi-account OAuth (accounts table). Add `google_calendars` table to track selected calendars per family. Sync service pulls events from Google (5-min intervals via cron) and pushes local changes immediately. Events table extended with sync metadata (`google_calendar_id`, `google_event_id`, `sync_status`).

**Tech Stack:** Drizzle ORM, Google Calendar API v3, Next.js 16 Server Actions, Better-Auth tokens, incremental sync with `syncToken`

**Prerequisites:**

- Multi-account Google OAuth implemented (see `2025-12-21-multi-account-google-oauth.md`) - **DONE**
- Families feature with `families` and `family_members` tables - **DONE**
- Calendar scope upgraded from `readonly` to `events` for 2-way sync

---

## Phase 1: Database Schema

### Task 1: Add google_calendars Table Schema

**Files:**

- Modify: `src/server/schema.ts`

**Step 1: Add the google_calendars table definition**

After the `familyInvites` table definition (~line 124), add:

```typescript
// ============================================================================
// Google Calendar Sync Tables
// ============================================================================

/**
 * Google Calendars table - Tracks synced calendars per family
 */
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
  accessRole: text("access_role").notNull().default("reader"), // 'owner' | 'writer' | 'reader'
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at", { mode: "date" }),
  syncCursor: text("sync_cursor"), // Google's sync token for incremental updates
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 2: Add relations for google_calendars**

After existing relations (~line 155), add:

```typescript
export const googleCalendarsRelations = relations(
  googleCalendars,
  ({ one }) => ({
    family: one(families, {
      fields: [googleCalendars.familyId],
      references: [families.id],
    }),
    account: one(accounts, {
      fields: [googleCalendars.accountId],
      references: [accounts.id],
    }),
  })
);
```

**Step 3: Add type exports**

At end of file, add:

```typescript
export type GoogleCalendar = typeof googleCalendars.$inferSelect;
export type NewGoogleCalendar = typeof googleCalendars.$inferInsert;
```

**Step 4: Verify TypeScript compiles**

Run: `pnpm build`
Expected: Build succeeds without schema errors

**Step 5: Commit**

```bash
git add src/server/schema.ts
git commit -m "feat(schema): add google_calendars table for sync tracking"
```

---

### Task 2: Generate and Run Migration

**Files:**

- Generate: `drizzle/*.sql` migration files

**Step 1: Generate the migration**

Run: `pnpm db:generate`
Expected: New migration file created in `drizzle/` directory

**Step 2: Review the migration**

Read the generated SQL file and verify it creates:

- `google_calendars` table with all columns
- Foreign key constraints to `families` and `accounts`
- Proper indexes

**Step 3: Run the migration**

Run: `pnpm db:migrate`
Expected: Migration applies successfully

**Step 4: Verify in Drizzle Studio**

Run: `pnpm db:studio`
Navigate to: http://localhost:4983
Expected: `google_calendars` table visible with correct schema

**Step 5: Commit**

```bash
git add drizzle/
git commit -m "feat(db): add google_calendars migration"
```

---

### Task 3: Add Events Table Sync Metadata

**Files:**

- Create: `src/server/schema/events.ts` (or modify existing if events table exists)

**Note:** If no events table exists yet, create it with sync fields. If it exists, add sync metadata columns.

**Step 1: Create or modify events table**

```typescript
/**
 * Events table - Calendar events with Google sync metadata
 */
export const events = pgTable("events", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  startTime: timestamp("start_time", { mode: "date" }).notNull(),
  endTime: timestamp("end_time", { mode: "date" }).notNull(),
  allDay: boolean("all_day").notNull().default(false),
  color: text("color"),
  // Google Sync Metadata
  googleCalendarId: text("google_calendar_id").references(
    () => googleCalendars.id,
    { onDelete: "set null" }
  ),
  googleEventId: text("google_event_id"),
  syncStatus: text("sync_status").default("synced"), // 'synced' | 'pending' | 'conflict' | 'error'
  localUpdatedAt: timestamp("local_updated_at", { mode: "date" }),
  remoteUpdatedAt: timestamp("remote_updated_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 2: Generate and run migration**

Run: `pnpm db:generate && pnpm db:migrate`

**Step 3: Commit**

```bash
git add src/server/schema.ts drizzle/
git commit -m "feat(schema): add events table with Google sync metadata"
```

---

## Phase 2: Google Calendar API Service

### Task 4: Update Auth Scopes for 2-Way Sync

**Files:**

- Modify: `src/server/auth.ts`

**Step 1: Update Google OAuth scopes**

Change from readonly to read/write scopes at ~line 46:

```typescript
scope: [
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
],
```

**Step 2: Commit**

```bash
git add src/server/auth.ts
git commit -m "feat(auth): upgrade Google scopes for 2-way calendar sync"
```

---

### Task 5: Create Google Calendar API Types

**Files:**

- Create: `src/types/google-calendar.ts`

**Step 1: Create the types file**

```typescript
/**
 * Google Calendar API response types
 */

export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole: "owner" | "writer" | "reader" | "freeBusyReader";
  primary?: boolean;
  selected?: boolean;
}

export interface GoogleCalendarListResponse {
  kind: "calendar#calendarList";
  items: GoogleCalendarListItem[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export interface GoogleEventDateTime {
  dateTime?: string; // ISO 8601 for timed events
  date?: string; // YYYY-MM-DD for all-day events
  timeZone?: string;
}

export interface GoogleCalendarEvent {
  id: string;
  status: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  location?: string;
  start: GoogleEventDateTime;
  end: GoogleEventDateTime;
  created: string;
  updated: string;
  colorId?: string;
  recurringEventId?: string;
}

export interface GoogleEventsListResponse {
  kind: "calendar#events";
  items: GoogleCalendarEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

export interface GoogleApiError {
  error: {
    code: number;
    message: string;
    errors: Array<{
      domain: string;
      reason: string;
      message: string;
    }>;
  };
}

export type SyncStatus = "synced" | "pending" | "conflict" | "error";
```

**Step 2: Commit**

```bash
git add src/types/google-calendar.ts
git commit -m "feat(types): add Google Calendar API type definitions"
```

---

### Task 6: Create Google Calendar API Client

**Files:**

- Create: `src/server/services/google-calendar-client.ts`

**Step 1: Create the API client**

```typescript
import type {
  GoogleCalendarListResponse,
  GoogleEventsListResponse,
  GoogleCalendarEvent,
  GoogleApiError,
} from "@/types/google-calendar";

const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

export class GoogleCalendarClient {
  constructor(private accessToken: string) {}

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${CALENDAR_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = (await response.json()) as GoogleApiError;
      throw new GoogleCalendarApiError(response.status, error);
    }

    return response.json() as Promise<T>;
  }

  /**
   * List all calendars accessible by this account
   */
  async listCalendars(): Promise<GoogleCalendarListResponse> {
    return this.fetch<GoogleCalendarListResponse>("/users/me/calendarList");
  }

  /**
   * Fetch events from a calendar with optional sync token
   */
  async listEvents(
    calendarId: string,
    options: {
      syncToken?: string;
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      pageToken?: string;
    } = {}
  ): Promise<GoogleEventsListResponse> {
    const params = new URLSearchParams();

    if (options.syncToken) {
      params.set("syncToken", options.syncToken);
    } else {
      // Initial sync - use time bounds
      if (options.timeMin) params.set("timeMin", options.timeMin);
      if (options.timeMax) params.set("timeMax", options.timeMax);
      params.set("singleEvents", "true"); // Expand recurring events
    }

    if (options.maxResults)
      params.set("maxResults", String(options.maxResults));
    if (options.pageToken) params.set("pageToken", options.pageToken);

    const query = params.toString();
    return this.fetch<GoogleEventsListResponse>(
      `/calendars/${encodeURIComponent(calendarId)}/events${query ? `?${query}` : ""}`
    );
  }

  /**
   * Create an event on Google Calendar
   */
  async createEvent(
    calendarId: string,
    event: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent> {
    return this.fetch<GoogleCalendarEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        body: JSON.stringify(event),
      }
    );
  }

  /**
   * Update an event on Google Calendar
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    event: Partial<GoogleCalendarEvent>
  ): Promise<GoogleCalendarEvent> {
    return this.fetch<GoogleCalendarEvent>(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(event),
      }
    );
  }

  /**
   * Delete an event from Google Calendar
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.fetch(
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE" }
    );
  }
}

export class GoogleCalendarApiError extends Error {
  constructor(
    public status: number,
    public apiError: GoogleApiError
  ) {
    super(apiError.error.message);
    this.name = "GoogleCalendarApiError";
  }

  get isRateLimited(): boolean {
    return (
      this.status === 429 ||
      this.apiError.error.errors?.[0]?.reason === "rateLimitExceeded"
    );
  }

  get requiresFullSync(): boolean {
    return this.status === 410;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}
```

**Step 2: Commit**

```bash
git add src/server/services/google-calendar-client.ts
git commit -m "feat(services): add Google Calendar API client"
```

---

### Task 7: Create Token Refresh Service

**Files:**

- Modify: `src/server/services/google-token-service.ts`

**Step 1: Add token refresh functionality**

Add to existing file:

```typescript
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

interface RefreshedToken {
  accessToken: string;
  expiresAt: Date;
}

/**
 * Refresh an expired Google access token
 */
export async function refreshGoogleToken(
  refreshToken: string
): Promise<RefreshedToken> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/**
 * Update stored token after refresh
 */
export async function updateStoredToken(
  accountId: string,
  accessToken: string,
  expiresAt: Date
): Promise<void> {
  await db
    .update(accounts)
    .set({
      accessToken,
      accessTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, accountId));
}

/**
 * Get a valid access token, refreshing if needed
 */
export async function getValidAccessToken(
  accountDbId: string
): Promise<string | null> {
  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountDbId))
    .limit(1);

  if (account.length === 0 || !account[0].accessToken) {
    return null;
  }

  const { accessToken, refreshToken, accessTokenExpiresAt } = account[0];

  // Check if token needs refresh
  if (isTokenExpired(accessTokenExpiresAt) && refreshToken) {
    try {
      const refreshed = await refreshGoogleToken(refreshToken);
      await updateStoredToken(
        accountDbId,
        refreshed.accessToken,
        refreshed.expiresAt
      );
      return refreshed.accessToken;
    } catch (error) {
      console.error("Failed to refresh token:", error);
      return null;
    }
  }

  return accessToken;
}
```

**Step 2: Commit**

```bash
git add src/server/services/google-token-service.ts
git commit -m "feat(services): add Google token refresh functionality"
```

---

## Phase 3: Calendar Selection API

### Task 8: Create API to List Available Google Calendars

**Files:**

- Create: `src/app/api/v1/google/calendars/route.ts`

**Step 1: Create directory**

Run: `mkdir -p src/app/api/v1/google/calendars`

**Step 2: Create the route**

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { getValidAccessToken } from "@/server/services/google-token-service";
import { GoogleCalendarClient } from "@/server/services/google-calendar-client";
import { db } from "@/server/db";
import { accounts } from "@/server/schema";
import { eq, and } from "drizzle-orm";

// GET /api/v1/google/calendars?accountId=xxx
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "BAD_REQUEST", message: "accountId required" },
        },
        { status: 400 }
      );
    }

    // Verify account belongs to user
    const account = await db
      .select()
      .from(accounts)
      .where(
        and(eq(accounts.id, accountId), eq(accounts.userId, session.user.id))
      )
      .limit(1);

    if (account.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Account not found" },
        },
        { status: 404 }
      );
    }

    const accessToken = await getValidAccessToken(accountId);
    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "TOKEN_ERROR", message: "Could not get valid token" },
        },
        { status: 401 }
      );
    }

    const client = new GoogleCalendarClient(accessToken);
    const calendars = await client.listCalendars();

    return NextResponse.json({
      success: true,
      data: {
        calendars: calendars.items.map((cal) => ({
          id: cal.id,
          name: cal.summary,
          color: cal.backgroundColor,
          accessRole: cal.accessRole,
          primary: cal.primary ?? false,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching Google calendars:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch calendars" },
      },
      { status: 500 }
    );
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/v1/google/calendars/route.ts
git commit -m "feat(api): add endpoint to list Google calendars for account"
```

---

### Task 9: Create API to Enable/Disable Calendar Sync

**Files:**

- Create: `src/app/api/v1/families/[familyId]/calendars/route.ts`

**Step 1: Create directory**

Run: `mkdir -p "src/app/api/v1/families/[familyId]/calendars"`

**Step 2: Create the route**

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { googleCalendars, familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

type RouteParams = { params: Promise<{ familyId: string }> };

// GET /api/v1/families/[familyId]/calendars - List synced calendars
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
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

    // Verify user is family member
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a family member" },
        },
        { status: 403 }
      );
    }

    const calendars = await db
      .select()
      .from(googleCalendars)
      .where(eq(googleCalendars.familyId, familyId));

    return NextResponse.json({
      success: true,
      data: { calendars },
    });
  } catch (error) {
    console.error("Error fetching family calendars:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch calendars" },
      },
      { status: 500 }
    );
  }
}

// POST /api/v1/families/[familyId]/calendars - Add calendar to sync
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
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
    const body = await request.json();
    const { accountId, googleCalendarId, name, color, accessRole } = body;

    // Verify user is family manager
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id),
          eq(familyMembers.role, "manager")
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Manager access required" },
        },
        { status: 403 }
      );
    }

    // Check if calendar already linked
    const existing = await db
      .select()
      .from(googleCalendars)
      .where(
        and(
          eq(googleCalendars.familyId, familyId),
          eq(googleCalendars.accountId, accountId),
          eq(googleCalendars.googleCalendarId, googleCalendarId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CONFLICT", message: "Calendar already linked" },
        },
        { status: 409 }
      );
    }

    const newCalendar = await db
      .insert(googleCalendars)
      .values({
        id: createId(),
        familyId,
        accountId,
        googleCalendarId,
        name,
        color,
        accessRole: accessRole || "reader",
        syncEnabled: true,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: { calendar: newCalendar[0] },
    });
  } catch (error) {
    console.error("Error adding calendar:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to add calendar" },
      },
      { status: 500 }
    );
  }
}
```

**Step 3: Commit**

```bash
git add "src/app/api/v1/families/[familyId]/calendars/route.ts"
git commit -m "feat(api): add endpoints for family calendar management"
```

---

### Task 10: Create API to Toggle/Delete Calendar

**Files:**

- Create: `src/app/api/v1/families/[familyId]/calendars/[calendarId]/route.ts`

**Step 1: Create directory**

Run: `mkdir -p "src/app/api/v1/families/[familyId]/calendars/[calendarId]"`

**Step 2: Create the route**

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { googleCalendars, familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";

type RouteParams = {
  params: Promise<{ familyId: string; calendarId: string }>;
};

// PATCH /api/v1/families/[familyId]/calendars/[calendarId] - Toggle sync
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, calendarId } = await params;
    const body = await request.json();
    const { syncEnabled } = body;

    // Verify user is family manager
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id),
          eq(familyMembers.role, "manager")
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Manager access required" },
        },
        { status: 403 }
      );
    }

    const updated = await db
      .update(googleCalendars)
      .set({ syncEnabled, updatedAt: new Date() })
      .where(
        and(
          eq(googleCalendars.id, calendarId),
          eq(googleCalendars.familyId, familyId)
        )
      )
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Calendar not found" },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { calendar: updated[0] },
    });
  } catch (error) {
    console.error("Error updating calendar:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to update calendar" },
      },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/families/[familyId]/calendars/[calendarId] - Remove calendar
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, calendarId } = await params;

    // Verify user is family manager
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id),
          eq(familyMembers.role, "manager")
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Manager access required" },
        },
        { status: 403 }
      );
    }

    await db
      .delete(googleCalendars)
      .where(
        and(
          eq(googleCalendars.id, calendarId),
          eq(googleCalendars.familyId, familyId)
        )
      );

    return NextResponse.json({
      success: true,
      data: { message: "Calendar removed" },
    });
  } catch (error) {
    console.error("Error removing calendar:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to remove calendar" },
      },
      { status: 500 }
    );
  }
}
```

**Step 3: Commit**

```bash
git add "src/app/api/v1/families/[familyId]/calendars/[calendarId]/route.ts"
git commit -m "feat(api): add calendar toggle and delete endpoints"
```

---

## Phase 4: Sync Service

### Task 11: Create Sync Service Core

**Files:**

- Create: `src/server/services/google-sync-service.ts`

**Step 1: Create the sync service**

```typescript
import { db } from "@/server/db";
import { googleCalendars, events } from "@/server/schema";
import { eq, and, isNull, or, lt } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { getValidAccessToken } from "./google-token-service";
import {
  GoogleCalendarClient,
  GoogleCalendarApiError,
} from "./google-calendar-client";
import type { GoogleCalendarEvent } from "@/types/google-calendar";

const SYNC_RANGE = {
  pastMonths: 3,
  futureMonths: 12,
};

interface SyncResult {
  calendarId: string;
  eventsCreated: number;
  eventsUpdated: number;
  eventsDeleted: number;
  error?: string;
}

/**
 * Perform initial sync for a newly linked calendar
 */
export async function performInitialSync(
  calendarId: string
): Promise<SyncResult> {
  const calendar = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.id, calendarId))
    .limit(1);

  if (calendar.length === 0) {
    return {
      calendarId,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      error: "Calendar not found",
    };
  }

  const cal = calendar[0];
  const accessToken = await getValidAccessToken(cal.accountId);

  if (!accessToken) {
    return {
      calendarId,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      error: "Invalid token",
    };
  }

  const client = new GoogleCalendarClient(accessToken);
  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setMonth(timeMin.getMonth() - SYNC_RANGE.pastMonths);
  const timeMax = new Date(now);
  timeMax.setMonth(timeMax.getMonth() + SYNC_RANGE.futureMonths);

  let eventsCreated = 0;
  let pageToken: string | undefined;
  let syncToken: string | undefined;

  try {
    do {
      const response = await client.listEvents(cal.googleCalendarId, {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: 250,
        pageToken,
      });

      for (const googleEvent of response.items) {
        if (googleEvent.status === "cancelled") continue;

        await upsertEventFromGoogle(cal.familyId, calendarId, googleEvent);
        eventsCreated++;
      }

      pageToken = response.nextPageToken;
      if (!pageToken) {
        syncToken = response.nextSyncToken;
      }
    } while (pageToken);

    // Save sync token for incremental sync
    await db
      .update(googleCalendars)
      .set({
        syncCursor: syncToken,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(googleCalendars.id, calendarId));

    return { calendarId, eventsCreated, eventsUpdated: 0, eventsDeleted: 0 };
  } catch (error) {
    console.error("Initial sync failed:", error);
    return {
      calendarId,
      eventsCreated,
      eventsUpdated: 0,
      eventsDeleted: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Perform incremental sync using stored sync token
 */
export async function performIncrementalSync(
  calendarId: string
): Promise<SyncResult> {
  const calendar = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.id, calendarId))
    .limit(1);

  if (calendar.length === 0) {
    return {
      calendarId,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      error: "Calendar not found",
    };
  }

  const cal = calendar[0];

  // No sync token = need initial sync
  if (!cal.syncCursor) {
    return performInitialSync(calendarId);
  }

  const accessToken = await getValidAccessToken(cal.accountId);
  if (!accessToken) {
    return {
      calendarId,
      eventsCreated: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      error: "Invalid token",
    };
  }

  const client = new GoogleCalendarClient(accessToken);
  let eventsCreated = 0;
  let eventsUpdated = 0;
  let eventsDeleted = 0;
  let pageToken: string | undefined;
  let syncToken = cal.syncCursor;

  try {
    do {
      const response = await client.listEvents(cal.googleCalendarId, {
        syncToken,
        pageToken,
      });

      for (const googleEvent of response.items) {
        if (googleEvent.status === "cancelled") {
          await deleteEventByGoogleId(calendarId, googleEvent.id);
          eventsDeleted++;
        } else {
          const result = await upsertEventFromGoogle(
            cal.familyId,
            calendarId,
            googleEvent
          );
          if (result === "created") eventsCreated++;
          else eventsUpdated++;
        }
      }

      pageToken = response.nextPageToken;
      if (!pageToken && response.nextSyncToken) {
        syncToken = response.nextSyncToken;
      }
    } while (pageToken);

    await db
      .update(googleCalendars)
      .set({
        syncCursor: syncToken,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(googleCalendars.id, calendarId));

    return { calendarId, eventsCreated, eventsUpdated, eventsDeleted };
  } catch (error) {
    if (error instanceof GoogleCalendarApiError && error.requiresFullSync) {
      // 410 Gone - need full sync
      await db
        .update(googleCalendars)
        .set({ syncCursor: null, updatedAt: new Date() })
        .where(eq(googleCalendars.id, calendarId));
      return performInitialSync(calendarId);
    }

    console.error("Incremental sync failed:", error);
    return {
      calendarId,
      eventsCreated,
      eventsUpdated,
      eventsDeleted,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Convert Google event to local event and upsert
 */
async function upsertEventFromGoogle(
  familyId: string,
  googleCalendarId: string,
  googleEvent: GoogleCalendarEvent
): Promise<"created" | "updated"> {
  const startTime = googleEvent.start.dateTime
    ? new Date(googleEvent.start.dateTime)
    : new Date(googleEvent.start.date + "T00:00:00");

  const endTime = googleEvent.end.dateTime
    ? new Date(googleEvent.end.dateTime)
    : new Date(googleEvent.end.date + "T00:00:00");

  const allDay = !googleEvent.start.dateTime;

  // Check if event exists
  const existing = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.googleCalendarId, googleCalendarId),
        eq(events.googleEventId, googleEvent.id)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(events)
      .set({
        title: googleEvent.summary || "(No title)",
        description: googleEvent.description,
        location: googleEvent.location,
        startTime,
        endTime,
        allDay,
        remoteUpdatedAt: new Date(googleEvent.updated),
        syncStatus: "synced",
        updatedAt: new Date(),
      })
      .where(eq(events.id, existing[0].id));
    return "updated";
  }

  await db.insert(events).values({
    id: createId(),
    familyId,
    title: googleEvent.summary || "(No title)",
    description: googleEvent.description,
    location: googleEvent.location,
    startTime,
    endTime,
    allDay,
    googleCalendarId,
    googleEventId: googleEvent.id,
    remoteUpdatedAt: new Date(googleEvent.updated),
    syncStatus: "synced",
  });
  return "created";
}

async function deleteEventByGoogleId(
  googleCalendarId: string,
  googleEventId: string
): Promise<void> {
  await db
    .delete(events)
    .where(
      and(
        eq(events.googleCalendarId, googleCalendarId),
        eq(events.googleEventId, googleEventId)
      )
    );
}

/**
 * Get calendars that need syncing (older than interval or never synced)
 */
export async function getCalendarsNeedingSync(intervalMinutes: number = 5) {
  const threshold = new Date(Date.now() - intervalMinutes * 60 * 1000);

  return db
    .select()
    .from(googleCalendars)
    .where(
      and(
        eq(googleCalendars.syncEnabled, true),
        or(
          isNull(googleCalendars.lastSyncedAt),
          lt(googleCalendars.lastSyncedAt, threshold)
        )
      )
    );
}
```

**Step 2: Commit**

```bash
git add src/server/services/google-sync-service.ts
git commit -m "feat(services): add Google Calendar sync service"
```

---

### Task 12: Create Manual Sync API Endpoint

**Files:**

- Create: `src/app/api/v1/families/[familyId]/calendars/[calendarId]/sync/route.ts`

**Step 1: Create directory**

Run: `mkdir -p "src/app/api/v1/families/[familyId]/calendars/[calendarId]/sync"`

**Step 2: Create the route**

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { googleCalendars, familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import {
  performIncrementalSync,
  performInitialSync,
} from "@/server/services/google-sync-service";

type RouteParams = {
  params: Promise<{ familyId: string; calendarId: string }>;
};

// POST /api/v1/families/[familyId]/calendars/[calendarId]/sync - Trigger sync
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, calendarId } = await params;

    // Verify user is family member
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a family member" },
        },
        { status: 403 }
      );
    }

    // Verify calendar exists
    const calendar = await db
      .select()
      .from(googleCalendars)
      .where(
        and(
          eq(googleCalendars.id, calendarId),
          eq(googleCalendars.familyId, familyId)
        )
      )
      .limit(1);

    if (calendar.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Calendar not found" },
        },
        { status: 404 }
      );
    }

    // Perform sync (initial or incremental based on sync cursor)
    const result = calendar[0].syncCursor
      ? await performIncrementalSync(calendarId)
      : await performInitialSync(calendarId);

    if (result.error) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "SYNC_ERROR", message: result.error },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        eventsCreated: result.eventsCreated,
        eventsUpdated: result.eventsUpdated,
        eventsDeleted: result.eventsDeleted,
      },
    });
  } catch (error) {
    console.error("Error triggering sync:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to sync" },
      },
      { status: 500 }
    );
  }
}
```

**Step 3: Commit**

```bash
git add "src/app/api/v1/families/[familyId]/calendars/[calendarId]/sync/route.ts"
git commit -m "feat(api): add manual calendar sync endpoint"
```

---

### Task 13: Create Cron Sync Job (Vercel Cron or Custom)

**Files:**

- Create: `src/app/api/cron/sync-calendars/route.ts`

**Step 1: Create directory**

Run: `mkdir -p src/app/api/cron/sync-calendars`

**Step 2: Create the cron route**

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  getCalendarsNeedingSync,
  performIncrementalSync,
} from "@/server/services/google-sync-service";

// Vercel cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

// GET /api/cron/sync-calendars - Triggered by cron every 5 minutes
export async function GET(request: Request) {
  // Verify cron secret
  const headersList = await headers();
  const authHeader = headersList.get("authorization");

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const calendars = await getCalendarsNeedingSync(5);

    const results = await Promise.allSettled(
      calendars.map((cal) => performIncrementalSync(cal.id))
    );

    const summary = {
      total: calendars.length,
      successful: results.filter(
        (r) => r.status === "fulfilled" && !r.value.error
      ).length,
      failed: results.filter(
        (r) =>
          r.status === "rejected" || (r.status === "fulfilled" && r.value.error)
      ).length,
    };

    console.log("Cron sync completed:", summary);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Cron sync failed:", error);
    return NextResponse.json(
      { success: false, error: "Sync job failed" },
      { status: 500 }
    );
  }
}
```

**Step 3: Add vercel.json cron config (if using Vercel)**

Create or modify `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-calendars",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

**Step 4: Add CRON_SECRET to env**

Add to `.env.example`:

```env
# Cron job authentication
CRON_SECRET="your-secure-cron-secret"
```

**Step 5: Commit**

```bash
git add src/app/api/cron/sync-calendars/route.ts vercel.json .env.example
git commit -m "feat(cron): add calendar sync cron job"
```

---

## Phase 5: UI Components

### Task 14: Create SyncStatusBadge Component

**Files:**

- Create: `src/components/sync/sync-status-badge.tsx`

**Step 1: Create directory**

Run: `mkdir -p src/components/sync`

**Step 2: Create the component**

```typescript
"use client";

import { Check, Loader2, Clock, AlertTriangle, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SyncStatus = "synced" | "syncing" | "pending" | "conflict" | "error" | "offline";

interface SyncStatusBadgeProps {
  status: SyncStatus;
  lastSyncedAt?: Date;
  errorMessage?: string;
  className?: string;
}

const statusConfig = {
  synced: {
    icon: Check,
    label: "Synced",
    className: "text-green-600 bg-green-50",
  },
  syncing: {
    icon: Loader2,
    label: "Syncing",
    className: "text-blue-600 bg-blue-50",
    iconClassName: "animate-spin",
  },
  pending: {
    icon: Clock,
    label: "Pending",
    className: "text-amber-600 bg-amber-50",
  },
  conflict: {
    icon: AlertTriangle,
    label: "Conflict",
    className: "text-orange-600 bg-orange-50",
  },
  error: {
    icon: AlertTriangle,
    label: "Error",
    className: "text-red-600 bg-red-50",
  },
  offline: {
    icon: CloudOff,
    label: "Offline",
    className: "text-gray-600 bg-gray-50",
  },
};

export function SyncStatusBadge({
  status,
  lastSyncedAt,
  errorMessage,
  className,
}: SyncStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const tooltipContent = () => {
    if (errorMessage) return errorMessage;
    if (lastSyncedAt) {
      return `Last synced: ${lastSyncedAt.toLocaleString()}`;
    }
    return config.label;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
              config.className,
              className
            )}
          >
            <Icon className={cn("size-3", "iconClassName" in config && config.iconClassName)} />
            <span>{config.label}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/sync/sync-status-badge.tsx
git commit -m "feat(ui): add SyncStatusBadge component"
```

---

### Task 15: Create CalendarToggle Component

**Files:**

- Create: `src/components/sync/calendar-toggle.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CalendarToggleProps {
  calendar: {
    id: string;
    name: string;
    color?: string | null;
    accessRole: string;
    syncEnabled: boolean;
  };
  onToggle: (calendarId: string, enabled: boolean) => Promise<void>;
}

export function CalendarToggle({ calendar, onToggle }: CalendarToggleProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [enabled, setEnabled] = useState(calendar.syncEnabled);
  const isReadOnly = calendar.accessRole === "reader" || calendar.accessRole === "freeBusyReader";

  const handleToggle = async (checked: boolean) => {
    setIsLoading(true);
    setEnabled(checked);
    try {
      await onToggle(calendar.id, checked);
    } catch {
      setEnabled(!checked); // Revert on error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        {/* Color swatch */}
        <div
          className="size-4 rounded-full border"
          style={{ backgroundColor: calendar.color || "#4285f4" }}
        />

        {/* Calendar name */}
        <span className="text-sm font-medium">{calendar.name}</span>

        {/* Read-only indicator */}
        {isReadOnly && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Lock className="size-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>This calendar is read-only</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      <Switch
        checked={enabled}
        onCheckedChange={handleToggle}
        disabled={isLoading}
        className={cn(isLoading && "opacity-50")}
      />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/sync/calendar-toggle.tsx
git commit -m "feat(ui): add CalendarToggle component"
```

---

### Task 16: Create Google Calendar Selection Section

**Files:**

- Create: `src/components/sync/calendar-selection-section.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarToggle } from "./calendar-toggle";
import { SyncStatusBadge } from "./sync-status-badge";
import { toast } from "sonner";
import type { GoogleCalendar } from "@/server/schema";

interface CalendarSelectionSectionProps {
  familyId: string;
  account: {
    id: string;
    googleAccountId: string;
  };
}

interface AvailableCalendar {
  id: string;
  name: string;
  color: string;
  accessRole: string;
  primary: boolean;
}

export function CalendarSelectionSection({
  familyId,
  account,
}: CalendarSelectionSectionProps) {
  const [availableCalendars, setAvailableCalendars] = useState<AvailableCalendar[]>([]);
  const [linkedCalendars, setLinkedCalendars] = useState<GoogleCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchCalendars = async () => {
    try {
      // Fetch available calendars from Google
      const availableRes = await fetch(`/api/v1/google/calendars?accountId=${account.id}`);
      const availableData = await availableRes.json();

      // Fetch already linked calendars
      const linkedRes = await fetch(`/api/v1/families/${familyId}/calendars`);
      const linkedData = await linkedRes.json();

      if (availableData.success) {
        setAvailableCalendars(availableData.data.calendars);
      }
      if (linkedData.success) {
        setLinkedCalendars(
          linkedData.data.calendars.filter((c: GoogleCalendar) => c.accountId === account.id)
        );
      }
    } catch (error) {
      console.error("Failed to fetch calendars:", error);
      toast.error("Failed to load calendars");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendars();
  }, [familyId, account.id]);

  const handleAddCalendar = async (googleCal: AvailableCalendar) => {
    try {
      const response = await fetch(`/api/v1/families/${familyId}/calendars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          googleCalendarId: googleCal.id,
          name: googleCal.name,
          color: googleCal.color,
          accessRole: googleCal.accessRole,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setLinkedCalendars((prev) => [...prev, data.data.calendar]);
        toast.success(`Added "${googleCal.name}" to sync`);
      }
    } catch {
      toast.error("Failed to add calendar");
    }
  };

  const handleToggleSync = async (calendarId: string, enabled: boolean) => {
    const response = await fetch(`/api/v1/families/${familyId}/calendars/${calendarId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ syncEnabled: enabled }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || "Failed to toggle sync");
    }

    setLinkedCalendars((prev) =>
      prev.map((c) => (c.id === calendarId ? { ...c, syncEnabled: enabled } : c))
    );
  };

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      for (const cal of linkedCalendars.filter((c) => c.syncEnabled)) {
        await fetch(`/api/v1/families/${familyId}/calendars/${cal.id}/sync`, {
          method: "POST",
        });
      }
      toast.success("Sync completed");
      await fetchCalendars();
    } catch {
      toast.error("Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  const linkedCalendarIds = new Set(linkedCalendars.map((c) => c.googleCalendarId));
  const unlinkedCalendars = availableCalendars.filter((c) => !linkedCalendarIds.has(c.id));

  return (
    <div className="space-y-4">
      {/* Linked calendars */}
      {linkedCalendars.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Synced Calendars</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSyncNow}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 size-3" />
              )}
              Sync Now
            </Button>
          </div>
          <div className="divide-y rounded-md border">
            {linkedCalendars.map((cal) => (
              <div key={cal.id} className="flex items-center justify-between px-3 py-2">
                <CalendarToggle
                  calendar={cal}
                  onToggle={handleToggleSync}
                />
                <SyncStatusBadge
                  status={cal.lastSyncedAt ? "synced" : "pending"}
                  lastSyncedAt={cal.lastSyncedAt ?? undefined}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available calendars to add */}
      {unlinkedCalendars.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Available Calendars</h4>
          <div className="divide-y rounded-md border border-dashed">
            {unlinkedCalendars.map((cal) => (
              <button
                key={cal.id}
                onClick={() => handleAddCalendar(cal)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/50"
              >
                <div
                  className="size-4 rounded-full border"
                  style={{ backgroundColor: cal.color }}
                />
                <span className="text-sm">{cal.name}</span>
                {cal.primary && (
                  <span className="text-xs text-muted-foreground">(Primary)</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/sync/calendar-selection-section.tsx
git commit -m "feat(ui): add CalendarSelectionSection component"
```

---

### Task 17: Update Linked Account Card with Calendar Selection

**Files:**

- Modify: `src/components/settings/linked-google-account-card.tsx`

**Step 1: Add calendar selection toggle**

Update the component to include an expandable calendar selection section:

```typescript
"use client";

import { useState } from "react";
import { Trash2, Mail, Calendar, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import type { LinkedGoogleAccount } from "@/types/accounts";
import { CalendarSelectionSection } from "@/components/sync/calendar-selection-section";

interface LinkedGoogleAccountCardProps {
  account: LinkedGoogleAccount;
  familyId?: string;
  onUnlink: (accountId: string) => Promise<void>;
}

export function LinkedGoogleAccountCard({
  account,
  familyId,
  onUnlink,
}: LinkedGoogleAccountCardProps) {
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleUnlink = async () => {
    setIsUnlinking(true);
    try {
      await onUnlink(account.id);
      toast.success("Google account unlinked successfully");
    } catch (error) {
      toast.error("Failed to unlink account");
      console.error(error);
    } finally {
      setIsUnlinking(false);
    }
  };

  const hasCalendarScope = account.scopes.some((scope) =>
    scope.includes("calendar")
  );

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div className="rounded-lg border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <Mail className="size-5" />
            </div>
            <div>
              <p className="font-medium">{account.email || account.googleAccountId}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {hasCalendarScope && (
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    Calendar access
                  </span>
                )}
                <span>
                  Linked {new Date(account.linkedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {familyId && hasCalendarScope && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isExpanded ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" disabled={isUnlinking}>
                  {isUnlinking ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unlink Google Account</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove access to calendars from this Google account.
                    You can re-link it at any time.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleUnlink}>
                    Unlink Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {familyId && hasCalendarScope && (
          <CollapsibleContent>
            <div className="border-t px-4 py-3">
              <CalendarSelectionSection
                familyId={familyId}
                account={{
                  id: account.id,
                  googleAccountId: account.googleAccountId,
                }}
              />
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}
```

**Step 2: Update LinkedAccountsSection to pass familyId**

Modify `src/components/settings/linked-accounts-section.tsx` to accept and pass `familyId`:

```typescript
// Add to props interface
interface LinkedAccountsSectionProps {
  familyId?: string;
}

export function LinkedAccountsSection({ familyId }: LinkedAccountsSectionProps) {
  // ... existing code ...

  // Update card rendering
  {accounts.map((account) => (
    <LinkedGoogleAccountCard
      key={account.id}
      account={account}
      familyId={familyId}
      onUnlink={handleUnlink}
    />
  ))}
}
```

**Step 3: Commit**

```bash
git add src/components/settings/linked-google-account-card.tsx src/components/settings/linked-accounts-section.tsx
git commit -m "feat(ui): add calendar selection to linked account cards"
```

---

### Task 18: Create Google Sync Settings Tab

**Files:**

- Create: `src/components/settings/google-sync-settings.tsx`

**Step 1: Create the settings component**

```typescript
"use client";

import { LinkedAccountsSection } from "./linked-accounts-section";

interface GoogleSyncSettingsProps {
  familyId: string;
}

export function GoogleSyncSettings({ familyId }: GoogleSyncSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Google Calendar Sync</h3>
        <p className="text-sm text-muted-foreground">
          Link Google accounts and select which calendars to sync with your family planner.
        </p>
      </div>

      <div className="rounded-lg border p-6">
        <h4 className="mb-4 text-sm font-medium">Linked Google Accounts</h4>
        <LinkedAccountsSection familyId={familyId} />
      </div>

      <div className="rounded-lg border p-6">
        <h4 className="mb-4 text-sm font-medium">Sync Settings</h4>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-sync interval</p>
              <p className="text-xs text-muted-foreground">
                Calendars sync automatically every 5 minutes
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/settings/google-sync-settings.tsx
git commit -m "feat(ui): add GoogleSyncSettings component"
```

---

## Phase 6: Testing & Verification

### Task 19: Write Unit Tests for Sync Service

**Files:**

- Create: `src/server/services/__tests__/google-sync-service.test.ts`

**Step 1: Create test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  performInitialSync,
  performIncrementalSync,
} from "../google-sync-service";

// Mock dependencies
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../google-token-service", () => ({
  getValidAccessToken: vi.fn(),
}));

vi.mock("../google-calendar-client", () => ({
  GoogleCalendarClient: vi.fn().mockImplementation(() => ({
    listEvents: vi.fn(),
  })),
}));

describe("google-sync-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("performInitialSync", () => {
    it("returns error when calendar not found", async () => {
      const { db } = await import("@/server/db");
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as never);

      const result = await performInitialSync("nonexistent");

      expect(result.error).toBe("Calendar not found");
    });

    it("returns error when token is invalid", async () => {
      const { db } = await import("@/server/db");
      const { getValidAccessToken } = await import("../google-token-service");

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([
                { id: "cal1", accountId: "acc1", googleCalendarId: "primary" },
              ]),
          }),
        }),
      } as never);

      vi.mocked(getValidAccessToken).mockResolvedValue(null);

      const result = await performInitialSync("cal1");

      expect(result.error).toBe("Invalid token");
    });
  });

  describe("performIncrementalSync", () => {
    it("falls back to initial sync when no sync cursor", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([{ id: "cal1", syncCursor: null }]),
          }),
        }),
      } as never);

      // This will call performInitialSync internally
      const result = await performIncrementalSync("cal1");

      // Verify it attempted initial sync
      expect(result.calendarId).toBe("cal1");
    });
  });
});
```

**Step 2: Run tests**

Run: `pnpm test:run src/server/services/__tests__/google-sync-service.test.ts`
Expected: Tests pass

**Step 3: Commit**

```bash
git add src/server/services/__tests__/google-sync-service.test.ts
git commit -m "test: add unit tests for Google sync service"
```

---

### Task 20: End-to-End Verification

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Test OAuth flow with calendar scope**

1. Navigate to: `http://localhost:3000/settings/accounts`
2. Link a Google account
3. Verify Google consent screen shows calendar permissions
4. Complete authorization

**Step 3: Test calendar selection**

1. Expand the linked account card
2. Verify available calendars are listed
3. Click a calendar to add it to sync
4. Verify calendar appears in "Synced Calendars" section

**Step 4: Test manual sync**

1. Click "Sync Now" button
2. Verify loading state shows
3. Verify events are imported (check database or UI)

**Step 5: Test sync toggle**

1. Toggle a calendar off
2. Verify it stops syncing
3. Toggle back on
4. Verify sync resumes

**Step 6: Verify cron job (if deployed)**

1. Wait 5 minutes or manually trigger `/api/cron/sync-calendars`
2. Verify calendars are synced automatically

---

## Verification Checklist

- [ ] `google_calendars` table created with all columns
- [ ] Events table has sync metadata columns
- [ ] Google OAuth scopes include calendar.events
- [ ] Token refresh works when tokens expire
- [ ] Calendar list API returns available calendars
- [ ] Calendar selection UI shows available calendars
- [ ] Calendars can be added/removed from sync
- [ ] Initial sync imports events within date range
- [ ] Incremental sync uses sync token
- [ ] Manual "Sync Now" triggers sync
- [ ] Cron job syncs calendars every 5 minutes
- [ ] Sync status badge shows correct state
- [ ] Read-only calendars show lock icon
- [ ] Errors display appropriate messages

---

## Files Created/Modified Summary

| File                                                                      | Action    |
| ------------------------------------------------------------------------- | --------- |
| `src/server/schema.ts`                                                    | Modified  |
| `drizzle/*.sql`                                                           | Generated |
| `src/server/auth.ts`                                                      | Modified  |
| `src/types/google-calendar.ts`                                            | Created   |
| `src/server/services/google-calendar-client.ts`                           | Created   |
| `src/server/services/google-token-service.ts`                             | Modified  |
| `src/server/services/google-sync-service.ts`                              | Created   |
| `src/app/api/v1/google/calendars/route.ts`                                | Created   |
| `src/app/api/v1/families/[familyId]/calendars/route.ts`                   | Created   |
| `src/app/api/v1/families/[familyId]/calendars/[calendarId]/route.ts`      | Created   |
| `src/app/api/v1/families/[familyId]/calendars/[calendarId]/sync/route.ts` | Created   |
| `src/app/api/cron/sync-calendars/route.ts`                                | Created   |
| `src/components/sync/sync-status-badge.tsx`                               | Created   |
| `src/components/sync/calendar-toggle.tsx`                                 | Created   |
| `src/components/sync/calendar-selection-section.tsx`                      | Created   |
| `src/components/settings/linked-google-account-card.tsx`                  | Modified  |
| `src/components/settings/linked-accounts-section.tsx`                     | Modified  |
| `src/components/settings/google-sync-settings.tsx`                        | Created   |
| `vercel.json`                                                             | Modified  |
| `.env.example`                                                            | Modified  |
| `src/server/services/__tests__/google-sync-service.test.ts`               | Created   |
