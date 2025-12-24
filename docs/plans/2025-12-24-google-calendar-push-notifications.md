# Google Calendar Push Notifications Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace polling-based sync (5-minute cron) with real-time Google Calendar push notifications for instant event updates.

**Architecture:** Webhooks receive push notifications from Google, triggering incremental syncs on-demand. Channels are created per-calendar with token verification, auto-renewed before expiration. Polling remains as fallback for missed notifications (Google warns "not 100% reliable").

**Tech Stack:** Next.js 16 API routes, Drizzle ORM, Google Calendar API v3, cuid2 for IDs, crypto for tokens

---

## Task 1: Add Webhook Channels Database Table

**Files:**

- Modify: `src/server/schema.ts:332-356` (after googleCalendars table)
- Create: `drizzle/migrations/XXXX_add_webhook_channels.sql` (auto-generated)

**Step 1: Write the schema addition**

Add to `src/server/schema.ts` after line 356 (after googleCalendars table):

```typescript
/**
 * Google Calendar Webhook Channels table - Tracks active push notification subscriptions
 */
export const googleCalendarChannels = pgTable("google_calendar_channels", {
  id: text("id").primaryKey(), // Our UUID, sent to Google as channel id
  googleCalendarId: text("google_calendar_id")
    .notNull()
    .references(() => googleCalendars.id, { onDelete: "cascade" }),
  resourceId: text("resource_id").notNull(), // Google's resource identifier (from watch response)
  token: text("token").notNull(), // Verification token (X-Goog-Channel-Token)
  expiration: timestamp("expiration", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 2: Add relations**

Add after `googleCalendarsRelations` (around line 448):

```typescript
export const googleCalendarChannelsRelations = relations(
  googleCalendarChannels,
  ({ one }) => ({
    calendar: one(googleCalendars, {
      fields: [googleCalendarChannels.googleCalendarId],
      references: [googleCalendars.id],
    }),
  })
);
```

**Step 3: Add type exports**

Add to type exports section (around line 632):

```typescript
export type GoogleCalendarChannel = typeof googleCalendarChannels.$inferSelect;
export type NewGoogleCalendarChannel =
  typeof googleCalendarChannels.$inferInsert;
```

**Step 4: Generate migration**

Run: `pnpm db:generate`
Expected: New migration file created in `drizzle/` directory

**Step 5: Apply migration**

Run: `pnpm db:migrate`
Expected: Migration applied successfully

**Step 6: Commit**

```bash
git add src/server/schema.ts drizzle/
git commit -m "feat(db): add google_calendar_channels table for push notifications"
```

---

## Task 2: Add Environment Variable for Webhook URL

**Files:**

- Modify: `.env.example` (add documentation)
- Modify: `CLAUDE.md:57-63` (document new env var)

**Step 1: Document the environment variable**

Add to `.env.example`:

```bash
# Google Calendar Push Notifications
# Required for production: Your public HTTPS URL (e.g., https://app.example.com)
# In development, use a tunnel like ngrok: https://abc123.ngrok.io
GOOGLE_WEBHOOK_BASE_URL=
```

**Step 2: Update CLAUDE.md**

Add to Environment Variables section:

```markdown
GOOGLE_WEBHOOK_BASE_URL=https://your-app.vercel.app # Required for push notifications
```

**Step 3: Commit**

```bash
git add .env.example CLAUDE.md
git commit -m "docs: add GOOGLE_WEBHOOK_BASE_URL environment variable"
```

---

## Task 3: Extend Google Calendar Client with Watch Methods

**Files:**

- Modify: `src/server/services/google-calendar-client.ts`
- Modify: `src/types/google-calendar.ts` (add types)

**Step 1: Add types to google-calendar.ts**

First, read current types file, then add these interfaces:

```typescript
export interface GoogleWatchRequest {
  id: string; // Channel UUID (max 64 chars)
  type: "web_hook";
  address: string; // HTTPS webhook URL
  token?: string; // Verification token (max 256 chars)
  expiration?: string; // Unix timestamp in milliseconds
}

export interface GoogleWatchResponse {
  kind: "api#channel";
  id: string; // Echoes our channel id
  resourceId: string; // Google's resource identifier
  resourceUri: string; // Version-specific resource URI
  expiration: string; // Unix timestamp in milliseconds
}

export interface GoogleStopChannelRequest {
  id: string; // Channel id
  resourceId: string; // Resource id from watch response
}
```

**Step 2: Add watch method to GoogleCalendarClient**

Add to `src/server/services/google-calendar-client.ts`:

```typescript
/**
 * Create a watch channel for calendar events
 * @see https://developers.google.com/workspace/calendar/api/guides/push
 */
async watchEvents(
  calendarId: string,
  watchRequest: GoogleWatchRequest
): Promise<GoogleWatchResponse> {
  return this.fetch<GoogleWatchResponse>(
    `/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    {
      method: "POST",
      body: JSON.stringify(watchRequest),
    }
  );
}

/**
 * Stop receiving notifications for a channel
 */
async stopChannel(channelId: string, resourceId: string): Promise<void> {
  await this.fetch(
    "/channels/stop",
    {
      method: "POST",
      body: JSON.stringify({ id: channelId, resourceId }),
    }
  );
}
```

**Step 3: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/server/services/google-calendar-client.ts src/types/google-calendar.ts
git commit -m "feat(google-api): add watch and stop channel methods"
```

---

## Task 4: Create Channel Management Service

**Files:**

- Create: `src/server/services/google-channel-service.ts`

**Step 1: Write the channel service**

Create `src/server/services/google-channel-service.ts`:

```typescript
import { db } from "@/server/db";
import { googleCalendars, googleCalendarChannels } from "@/server/schema";
import { eq, and, lt } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { randomBytes } from "crypto";
import { getValidAccessToken } from "./google-token-service";
import { GoogleCalendarClient } from "./google-calendar-client";

const WEBHOOK_BASE_URL = process.env.GOOGLE_WEBHOOK_BASE_URL;

// Renew channels 1 hour before expiration
const RENEWAL_BUFFER_MS = 60 * 60 * 1000;

// Default channel TTL: 7 days (Google max varies, typically up to 1 week)
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Generate a secure verification token
 */
function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Create a watch channel for a calendar's events
 */
export async function createWatchChannel(
  calendarId: string
): Promise<{ success: boolean; error?: string }> {
  if (!WEBHOOK_BASE_URL) {
    return { success: false, error: "GOOGLE_WEBHOOK_BASE_URL not configured" };
  }

  const calendar = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.id, calendarId))
    .limit(1);

  if (calendar.length === 0) {
    return { success: false, error: "Calendar not found" };
  }

  const cal = calendar[0];
  const accessToken = await getValidAccessToken(cal.accountId);

  if (!accessToken) {
    return { success: false, error: "Invalid access token" };
  }

  // Stop any existing channel first
  await stopExistingChannel(calendarId);

  const client = new GoogleCalendarClient(accessToken);
  const channelId = createId();
  const token = generateToken();
  const expiration = Date.now() + DEFAULT_TTL_MS;

  try {
    const response = await client.watchEvents(cal.googleCalendarId, {
      id: channelId,
      type: "web_hook",
      address: `${WEBHOOK_BASE_URL}/api/webhooks/google-calendar`,
      token,
      expiration: String(expiration),
    });

    // Store channel in database
    await db.insert(googleCalendarChannels).values({
      id: channelId,
      googleCalendarId: calendarId,
      resourceId: response.resourceId,
      token,
      expiration: new Date(parseInt(response.expiration, 10)),
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to create watch channel:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Stop an existing channel for a calendar
 */
async function stopExistingChannel(calendarId: string): Promise<void> {
  const existing = await db
    .select()
    .from(googleCalendarChannels)
    .where(eq(googleCalendarChannels.googleCalendarId, calendarId))
    .limit(1);

  if (existing.length === 0) return;

  const channel = existing[0];
  const calendar = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.id, calendarId))
    .limit(1);

  if (calendar.length > 0) {
    const accessToken = await getValidAccessToken(calendar[0].accountId);
    if (accessToken) {
      const client = new GoogleCalendarClient(accessToken);
      try {
        await client.stopChannel(channel.id, channel.resourceId);
      } catch {
        // Channel may already be expired, continue with cleanup
      }
    }
  }

  // Delete from database
  await db
    .delete(googleCalendarChannels)
    .where(eq(googleCalendarChannels.id, channel.id));
}

/**
 * Stop a channel by ID (called when calendar is unlinked)
 */
export async function stopWatchChannel(calendarId: string): Promise<void> {
  await stopExistingChannel(calendarId);
}

/**
 * Get channels that need renewal (expiring within buffer time)
 */
export async function getChannelsNeedingRenewal() {
  const threshold = new Date(Date.now() + RENEWAL_BUFFER_MS);

  return db
    .select({
      channelId: googleCalendarChannels.id,
      calendarId: googleCalendarChannels.googleCalendarId,
      expiration: googleCalendarChannels.expiration,
    })
    .from(googleCalendarChannels)
    .where(lt(googleCalendarChannels.expiration, threshold));
}

/**
 * Verify webhook notification token
 */
export async function verifyChannelToken(
  channelId: string,
  token: string
): Promise<string | null> {
  const channel = await db
    .select()
    .from(googleCalendarChannels)
    .where(
      and(
        eq(googleCalendarChannels.id, channelId),
        eq(googleCalendarChannels.token, token)
      )
    )
    .limit(1);

  if (channel.length === 0) {
    return null;
  }

  return channel[0].googleCalendarId;
}

/**
 * Get calendar ID for a channel (for sync notifications)
 */
export async function getCalendarIdForChannel(
  channelId: string
): Promise<string | null> {
  const channel = await db
    .select()
    .from(googleCalendarChannels)
    .where(eq(googleCalendarChannels.id, channelId))
    .limit(1);

  return channel.length > 0 ? channel[0].googleCalendarId : null;
}
```

**Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/server/services/google-channel-service.ts
git commit -m "feat(services): add google channel management service"
```

---

## Task 5: Create Webhook Endpoint

**Files:**

- Create: `src/app/api/webhooks/google-calendar/route.ts`

**Step 1: Write the webhook route**

Create `src/app/api/webhooks/google-calendar/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  verifyChannelToken,
  getCalendarIdForChannel,
} from "@/server/services/google-channel-service";
import { performIncrementalSync } from "@/server/services/google-sync-service";

/**
 * Google Calendar Push Notification Webhook
 * @see https://developers.google.com/workspace/calendar/api/guides/push
 *
 * Headers received:
 * - X-Goog-Channel-ID: Our channel UUID
 * - X-Goog-Channel-Token: Our verification token
 * - X-Goog-Resource-State: 'sync' | 'exists' | 'not_exists'
 * - X-Goog-Resource-ID: Google's resource identifier
 * - X-Goog-Message-Number: Notification sequence number
 */
export async function POST(_request: Request) {
  const headersList = await headers();

  const channelId = headersList.get("x-goog-channel-id");
  const token = headersList.get("x-goog-channel-token");
  const resourceState = headersList.get("x-goog-resource-state");
  const messageNumber = headersList.get("x-goog-message-number");

  // Log notification receipt
  console.log("Google Calendar webhook received:", {
    channelId,
    resourceState,
    messageNumber,
  });

  // Validate required headers
  if (!channelId || !token) {
    console.warn("Webhook missing required headers");
    return new NextResponse(null, { status: 400 });
  }

  // Verify token matches our stored token
  const calendarId = await verifyChannelToken(channelId, token);

  if (!calendarId) {
    console.warn("Webhook token verification failed:", channelId);
    // Still return 200 to prevent Google from retrying
    return new NextResponse(null, { status: 200 });
  }

  // Handle different resource states
  if (resourceState === "sync") {
    // Initial sync message - channel successfully created
    console.log("Channel sync confirmed for calendar:", calendarId);
    return new NextResponse(null, { status: 200 });
  }

  if (resourceState === "exists") {
    // Resource changed - trigger incremental sync
    console.log("Triggering incremental sync for calendar:", calendarId);

    // Run sync in background (don't block webhook response)
    performIncrementalSync(calendarId)
      .then((result) => {
        console.log("Webhook-triggered sync completed:", {
          calendarId,
          created: result.eventsCreated,
          updated: result.eventsUpdated,
          deleted: result.eventsDeleted,
          error: result.error,
        });
      })
      .catch((error) => {
        console.error("Webhook-triggered sync failed:", calendarId, error);
      });

    return new NextResponse(null, { status: 200 });
  }

  if (resourceState === "not_exists") {
    // Resource was deleted - could indicate calendar was deleted
    console.warn("Resource not_exists for calendar:", calendarId);
    return new NextResponse(null, { status: 200 });
  }

  // Unknown state - acknowledge anyway
  return new NextResponse(null, { status: 200 });
}

// Google also sends GET for webhook verification during setup
export async function GET() {
  return new NextResponse(null, { status: 200 });
}
```

**Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/app/api/webhooks/google-calendar/route.ts
git commit -m "feat(api): add Google Calendar push notification webhook"
```

---

## Task 6: Create Channel Auto-Setup on Calendar Link

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/calendars/route.ts`

**Step 1: Read current file**

Read the file to understand existing POST handler structure.

**Step 2: Add channel creation after calendar insert**

Add import at top:

```typescript
import { createWatchChannel } from "@/server/services/google-channel-service";
```

After successful calendar insert (after the `await db.insert(googleCalendars)...` line), add:

```typescript
// Create push notification channel for real-time updates
const channelResult = await createWatchChannel(newCalendar.id);
if (!channelResult.success) {
  console.warn(
    "Failed to create push notification channel:",
    channelResult.error
  );
  // Continue - calendar is linked, sync will work via polling fallback
}
```

**Step 3: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/app/api/v1/families/[familyId]/calendars/route.ts
git commit -m "feat(api): auto-create push notification channel on calendar link"
```

---

## Task 7: Stop Channel When Calendar is Unlinked

**Files:**

- Modify: `src/app/api/v1/families/[familyId]/calendars/[calendarId]/route.ts`

**Step 1: Read current file**

Read the file to understand existing DELETE handler.

**Step 2: Add channel cleanup before calendar delete**

Add import at top:

```typescript
import { stopWatchChannel } from "@/server/services/google-channel-service";
```

In DELETE handler, before deleting the calendar, add:

```typescript
// Stop push notification channel
await stopWatchChannel(calendarId);
```

**Step 3: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/app/api/v1/families/[familyId]/calendars/[calendarId]/route.ts
git commit -m "feat(api): stop push notification channel when calendar unlinked"
```

---

## Task 8: Create Channel Renewal Cron Job

**Files:**

- Create: `src/app/api/cron/renew-channels/route.ts`
- Modify: `vercel.json` (add cron schedule)

**Step 1: Write the renewal cron route**

Create `src/app/api/cron/renew-channels/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  getChannelsNeedingRenewal,
  createWatchChannel,
} from "@/server/services/google-channel-service";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Cron job to renew expiring push notification channels
 * Runs every hour to renew channels expiring within 1 hour
 */
export async function GET(_request: Request) {
  // Verify cron secret
  const headersList = await headers();
  const authHeader = headersList.get("authorization");

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const channelsToRenew = await getChannelsNeedingRenewal();

    if (channelsToRenew.length === 0) {
      return NextResponse.json({
        success: true,
        data: { renewed: 0, failed: 0 },
      });
    }

    console.log(`Renewing ${channelsToRenew.length} expiring channels`);

    const results = await Promise.allSettled(
      channelsToRenew.map((channel) => createWatchChannel(channel.calendarId))
    );

    const summary = {
      renewed: results.filter(
        (r) => r.status === "fulfilled" && r.value.success
      ).length,
      failed: results.filter(
        (r) =>
          r.status === "rejected" ||
          (r.status === "fulfilled" && !r.value.success)
      ).length,
    };

    console.log("Channel renewal completed:", summary);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Channel renewal failed:", error);
    return NextResponse.json(
      { success: false, error: "Renewal job failed" },
      { status: 500 }
    );
  }
}
```

**Step 2: Check if vercel.json exists and add cron**

Read `vercel.json` if exists, or create with cron configuration:

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-calendars",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/renew-channels",
      "schedule": "0 * * * *"
    }
  ]
}
```

**Step 3: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/app/api/cron/renew-channels/route.ts vercel.json
git commit -m "feat(cron): add channel renewal job (hourly)"
```

---

## Task 9: Add Manual Channel Setup Endpoint

**Files:**

- Create: `src/app/api/v1/families/[familyId]/calendars/[calendarId]/channel/route.ts`

**Step 1: Write the channel management route**

Create `src/app/api/v1/families/[familyId]/calendars/[calendarId]/channel/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  googleCalendars,
  googleCalendarChannels,
  familyMembers,
} from "@/server/schema";
import { eq, and } from "drizzle-orm";
import {
  createWatchChannel,
  stopWatchChannel,
} from "@/server/services/google-channel-service";

type RouteParams = {
  params: Promise<{ familyId: string; calendarId: string }>;
};

/**
 * GET - Get channel status for a calendar
 */
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

    // Get channel status
    const channel = await db
      .select()
      .from(googleCalendarChannels)
      .where(eq(googleCalendarChannels.googleCalendarId, calendarId))
      .limit(1);

    if (channel.length === 0) {
      return NextResponse.json({
        success: true,
        data: { active: false },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        active: true,
        expiration: channel[0].expiration.toISOString(),
        expiresIn: channel[0].expiration.getTime() - Date.now(),
      },
    });
  } catch (error) {
    console.error("Error getting channel status:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get channel status",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Create/recreate channel for a calendar
 */
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

    // Verify user is manager
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

    if (membership.length === 0 || membership[0].role !== "manager") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Manager role required" },
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

    const result = await createWatchChannel(calendarId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CHANNEL_ERROR", message: result.error },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: "Push notification channel created" },
    });
  } catch (error) {
    console.error("Error creating channel:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create channel" },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Stop channel for a calendar
 */
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

    // Verify user is manager
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

    if (membership.length === 0 || membership[0].role !== "manager") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Manager role required" },
        },
        { status: 403 }
      );
    }

    await stopWatchChannel(calendarId);

    return NextResponse.json({
      success: true,
      data: { message: "Push notification channel stopped" },
    });
  } catch (error) {
    console.error("Error stopping channel:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to stop channel" },
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Run type check**

Run: `pnpm tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/app/api/v1/families/[familyId]/calendars/[calendarId]/channel/route.ts
git commit -m "feat(api): add manual channel management endpoint"
```

---

## Task 10: Write Unit Tests for Channel Service

**Files:**

- Create: `src/server/services/__tests__/google-channel-service.test.ts`

**Step 1: Write failing tests**

Create `src/server/services/__tests__/google-channel-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before imports
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => Promise.resolve()),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  },
}));

vi.mock("./google-token-service", () => ({
  getValidAccessToken: vi.fn(() => Promise.resolve("mock-token")),
}));

vi.mock("./google-calendar-client", () => ({
  GoogleCalendarClient: vi.fn().mockImplementation(() => ({
    watchEvents: vi.fn(() =>
      Promise.resolve({
        id: "channel-123",
        resourceId: "resource-456",
        expiration: String(Date.now() + 86400000),
      })
    ),
    stopChannel: vi.fn(() => Promise.resolve()),
  })),
}));

describe("google-channel-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createWatchChannel", () => {
    it("returns error when GOOGLE_WEBHOOK_BASE_URL not configured", async () => {
      // Dynamically import after mocks are set up
      const originalEnv = process.env.GOOGLE_WEBHOOK_BASE_URL;
      delete process.env.GOOGLE_WEBHOOK_BASE_URL;

      const { createWatchChannel } = await import("../google-channel-service");
      const result = await createWatchChannel("cal-123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("GOOGLE_WEBHOOK_BASE_URL");

      process.env.GOOGLE_WEBHOOK_BASE_URL = originalEnv;
    });
  });

  describe("verifyChannelToken", () => {
    it("returns null for non-existent channel", async () => {
      const { verifyChannelToken } = await import("../google-channel-service");
      const result = await verifyChannelToken("invalid-id", "invalid-token");
      expect(result).toBeNull();
    });
  });

  describe("getCalendarIdForChannel", () => {
    it("returns null for non-existent channel", async () => {
      const { getCalendarIdForChannel } =
        await import("../google-channel-service");
      const result = await getCalendarIdForChannel("invalid-id");
      expect(result).toBeNull();
    });
  });
});
```

**Step 2: Run tests to verify they fail appropriately**

Run: `pnpm test src/server/services/__tests__/google-channel-service.test.ts`
Expected: Tests should run (some may fail due to mock setup, but structure is correct)

**Step 3: Commit**

```bash
git add src/server/services/__tests__/google-channel-service.test.ts
git commit -m "test: add unit tests for google channel service"
```

---

## Task 11: Write E2E Test for Webhook Endpoint

**Files:**

- Create: `e2e/tests/webhooks/google-calendar-webhook.spec.ts`

**Step 1: Write E2E test**

Create `e2e/tests/webhooks/google-calendar-webhook.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Google Calendar Webhook", () => {
  const webhookUrl = "/api/webhooks/google-calendar";

  test("returns 400 for missing headers", async ({ request }) => {
    const response = await request.post(webhookUrl);
    expect(response.status()).toBe(400);
  });

  test("returns 200 for invalid token (security: no retry)", async ({
    request,
  }) => {
    const response = await request.post(webhookUrl, {
      headers: {
        "x-goog-channel-id": "invalid-channel-id",
        "x-goog-channel-token": "invalid-token",
        "x-goog-resource-state": "exists",
        "x-goog-message-number": "1",
      },
    });
    // Returns 200 to prevent Google from retrying invalid requests
    expect(response.status()).toBe(200);
  });

  test("GET endpoint returns 200 (verification support)", async ({
    request,
  }) => {
    const response = await request.get(webhookUrl);
    expect(response.status()).toBe(200);
  });
});
```

**Step 2: Run E2E test**

Run: `pnpm e2e e2e/tests/webhooks/google-calendar-webhook.spec.ts`
Expected: Tests pass

**Step 3: Commit**

```bash
git add e2e/tests/webhooks/google-calendar-webhook.spec.ts
git commit -m "test(e2e): add webhook endpoint tests"
```

---

## Task 12: Update Existing Cron Job to Reduce Polling Frequency

**Files:**

- Modify: `vercel.json`
- Modify: `src/server/services/google-sync-service.ts:411`

**Step 1: Update polling interval**

Since push notifications handle real-time updates, reduce polling to 15 minutes as a fallback:

In `vercel.json`, change sync-calendars schedule:

```json
{
  "path": "/api/cron/sync-calendars",
  "schedule": "*/15 * * * *"
}
```

In `google-sync-service.ts`, update `getCalendarsNeedingSync` default:

```typescript
export async function getCalendarsNeedingSync(intervalMinutes: number = 15) {
```

**Step 2: Commit**

```bash
git add vercel.json src/server/services/google-sync-service.ts
git commit -m "perf: reduce polling frequency to 15min (push notifications handle real-time)"
```

---

## Task 13: Add Setup Channels for Existing Calendars Script

**Files:**

- Create: `scripts/setup-push-channels.ts`

**Step 1: Write the script**

Create `scripts/setup-push-channels.ts`:

```typescript
/**
 * One-time script to set up push notification channels for existing calendars
 * Run with: pnpm tsx scripts/setup-push-channels.ts
 */

import { db } from "../src/server/db";
import { googleCalendars } from "../src/server/schema";
import { eq } from "drizzle-orm";
import { createWatchChannel } from "../src/server/services/google-channel-service";

async function main() {
  console.log(
    "Setting up push notification channels for existing calendars...\n"
  );

  const calendars = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.syncEnabled, true));

  console.log(`Found ${calendars.length} enabled calendars\n`);

  let success = 0;
  let failed = 0;

  for (const calendar of calendars) {
    process.stdout.write(`Setting up channel for ${calendar.name}... `);

    const result = await createWatchChannel(calendar.id);

    if (result.success) {
      console.log("OK");
      success++;
    } else {
      console.log(`FAILED: ${result.error}`);
      failed++;
    }
  }

  console.log(`\nComplete: ${success} success, ${failed} failed`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
```

**Step 2: Add script to package.json**

Add to scripts section:

```json
"setup-channels": "tsx scripts/setup-push-channels.ts"
```

**Step 3: Commit**

```bash
git add scripts/setup-push-channels.ts package.json
git commit -m "feat(scripts): add setup-push-channels for existing calendars"
```

---

## Task 14: Update Documentation

**Files:**

- Modify: `CLAUDE.md`

**Step 1: Add push notifications section**

Add new section after "Google Calendar Integration" or update existing sync documentation:

````markdown
### Google Calendar Push Notifications

Real-time sync using Google Calendar push notifications:

- **Webhook**: `POST /api/webhooks/google-calendar` - Receives Google notifications
- **Channel Management**: Channels created automatically when calendar linked
- **Renewal**: Hourly cron job renews channels expiring within 1 hour
- **Fallback**: Polling still runs every 15 minutes for missed notifications

**Environment Variables**:

- `GOOGLE_WEBHOOK_BASE_URL`: Required in production (e.g., `https://app.vercel.app`)

**Development**: Use ngrok or similar to expose local webhook endpoint:

```bash
ngrok http 3000
# Set GOOGLE_WEBHOOK_BASE_URL=https://abc123.ngrok.io
```
````

````

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add Google Calendar push notifications documentation"
````

---

## Summary

This implementation provides:

1. **Real-time updates**: Events sync within seconds of changes in Google Calendar
2. **Security**: Token verification prevents unauthorized webhook calls
3. **Reliability**: Polling fallback handles missed notifications
4. **Auto-renewal**: Channels renew automatically before expiration
5. **Clean lifecycle**: Channels created/destroyed with calendar link/unlink

**API Endpoints Added**:

- `POST /api/webhooks/google-calendar` - Webhook receiver
- `GET/POST/DELETE /api/v1/families/[familyId]/calendars/[calendarId]/channel` - Manual channel management
- `GET /api/cron/renew-channels` - Channel renewal cron

**Database Changes**:

- New `google_calendar_channels` table

**Required Environment Variables**:

- `GOOGLE_WEBHOOK_BASE_URL` (production only)
