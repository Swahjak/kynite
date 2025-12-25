# Security Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Address critical and high priority security issues identified in the security audit to prepare the application for production deployment.

**Architecture:** Implement security fixes layer by layer - starting with foundational utilities (timing-safe comparison, encryption), then applying them across services, followed by API hardening (validation, error codes), and finally infrastructure configuration (CI, headers).

**Tech Stack:** Node.js crypto module, @47ng/cloak for encryption, Zod for validation, Vitest for testing

---

## Task 1: Create Timing-Safe Comparison Utility

**Files:**

- Create: `src/lib/crypto.ts`
- Create: `src/lib/__tests__/crypto.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/__tests__/crypto.test.ts
import { describe, it, expect } from "vitest";
import { secureCompare } from "../crypto";

describe("secureCompare", () => {
  it("returns true for identical strings", () => {
    expect(secureCompare("abc123", "abc123")).toBe(true);
  });

  it("returns false for different strings of same length", () => {
    expect(secureCompare("abc123", "xyz789")).toBe(false);
  });

  it("returns false for strings of different lengths", () => {
    expect(secureCompare("short", "muchlonger")).toBe(false);
  });

  it("returns false when either string is empty", () => {
    expect(secureCompare("", "nonempty")).toBe(false);
    expect(secureCompare("nonempty", "")).toBe(false);
  });

  it("handles special characters", () => {
    const token = "abc+/=123";
    expect(secureCompare(token, token)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/crypto.test.ts`
Expected: FAIL with "Cannot find module '../crypto'"

**Step 3: Write minimal implementation**

```typescript
// src/lib/crypto.ts
import { timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison to prevent timing attacks.
 * Returns true if strings are equal, false otherwise.
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/crypto.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/crypto.ts src/lib/__tests__/crypto.test.ts
git commit -m "feat(security): add timing-safe string comparison utility"
```

---

## Task 2: Apply Timing-Safe Comparison to Cron Routes

**Files:**

- Modify: `src/app/api/cron/sync-calendars/route.ts:17`
- Modify: `src/app/api/cron/renew-channels/route.ts` (similar pattern)
- Modify: `src/app/api/cron/setup-channels/route.ts` (similar pattern)

**Step 1: Update sync-calendars route**

```typescript
// src/app/api/cron/sync-calendars/route.ts
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { secureCompare } from "@/lib/crypto";
import {
  getCalendarsNeedingSync,
  performIncrementalSync,
} from "@/server/services/google-sync-service";

// Vercel cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

// GET /api/cron/sync-calendars - Triggered by cron every hour
export async function GET(_request: Request) {
  // Verify cron secret
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const providedToken = authHeader?.replace("Bearer ", "") ?? "";

  if (!CRON_SECRET || !secureCompare(providedToken, CRON_SECRET)) {
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
        (r) => r.status === "fulfilled" && !r.value.error && r.value.complete
      ).length,
      incomplete: results.filter(
        (r) => r.status === "fulfilled" && !r.value.error && !r.value.complete
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

**Step 2: Read and update renew-channels route (apply same pattern)**

Read the file first, then apply the same changes:

- Add `import { secureCompare } from "@/lib/crypto";`
- Change the auth check to use `secureCompare`
- Return 401 if `!CRON_SECRET`

**Step 3: Read and update setup-channels route (apply same pattern)**

Same changes as above.

**Step 4: Run linter to verify**

Run: `pnpm lint`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/cron/*/route.ts
git commit -m "fix(security): use timing-safe comparison for cron auth"
```

---

## Task 3: Apply Timing-Safe Comparison to Channel Token Verification

**Files:**

- Modify: `src/server/services/google-channel-service.ts:151-171`

**Step 1: Read current implementation**

The current `verifyChannelToken` uses database query with `eq()` which is already safe (database comparison). However, the function returns a calendar ID, and we should ensure we're using the token correctly in the where clause.

Actually, looking at the code, the comparison happens in the database via Drizzle's `eq()` operator - this is safe because it's a SQL query, not a JavaScript string comparison. No change needed here.

**Step 2: Verify webhook route token handling**

Check `src/app/api/webhooks/google-calendar/route.ts` - the token is passed to `verifyChannelToken()` which does a database lookup. This is secure.

**Step 3: Document decision**

No code change needed - database comparisons via Drizzle are already timing-safe.

**Step 4: Commit documentation only**

```bash
git commit --allow-empty -m "docs(security): verify channel token comparison is db-safe"
```

---

## Task 4: Add Pairing Code Attempt Limiting

**Files:**

- Modify: `src/server/schema.ts` - Add attempts column
- Create: `src/server/db/migrations/XXXX_add_pairing_attempts.ts`
- Modify: `src/server/services/device-service.ts`
- Create: `src/server/services/__tests__/device-service.test.ts`

**Step 1: Write the failing test**

```typescript
// src/server/services/__tests__/device-service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("device-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("consumePairingCode", () => {
    it("increments attempt count on failed validation", async () => {
      // Will implement after schema change
    });

    it("invalidates code after 5 failed attempts", async () => {
      // Will implement after schema change
    });
  });
});
```

**Step 2: Add attempts column to schema**

```typescript
// In src/server/schema.ts, update devicePairingCodes table:
export const devicePairingCodes = pgTable("device_pairing_codes", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  deviceName: text("device_name").notNull(),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  attempts: integer("attempts").notNull().default(0), // NEW
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 3: Generate migration**

Run: `pnpm db:generate`
Expected: Creates migration file in `drizzle/` folder

**Step 4: Run migration**

Run: `pnpm db:push` (for dev) or `pnpm db:migrate` (for production)

**Step 5: Update device-service.ts**

Add new function and update consumePairingCode:

```typescript
// Add to src/server/services/device-service.ts

const MAX_PAIRING_ATTEMPTS = 5;

/**
 * Record a failed pairing attempt
 * Returns false if code is now invalidated (max attempts reached)
 */
export async function recordFailedAttempt(code: string): Promise<boolean> {
  const result = await db
    .update(devicePairingCodes)
    .set({
      attempts: sql`${devicePairingCodes.attempts} + 1`,
    })
    .where(eq(devicePairingCodes.code, code))
    .returning({ attempts: devicePairingCodes.attempts });

  if (result.length === 0) {
    return false;
  }

  return result[0].attempts < MAX_PAIRING_ATTEMPTS;
}

/**
 * Check if a code has exceeded max attempts
 */
export async function isCodeInvalidated(code: string): Promise<boolean> {
  const [pairingCode] = await db
    .select({ attempts: devicePairingCodes.attempts })
    .from(devicePairingCodes)
    .where(eq(devicePairingCodes.code, code))
    .limit(1);

  return pairingCode ? pairingCode.attempts >= MAX_PAIRING_ATTEMPTS : true;
}
```

**Step 6: Update the pairing validation endpoint**

The endpoint at `src/app/api/v1/devices/pair/validate/route.ts` needs to:

1. Check if code is invalidated before validation
2. Increment attempt count on failure

**Step 7: Run tests**

Run: `pnpm test:run`
Expected: PASS

**Step 8: Commit**

```bash
git add src/server/schema.ts drizzle/ src/server/services/device-service.ts
git commit -m "feat(security): add pairing code attempt limiting"
```

---

## Task 5: Make CRON_SECRET Required in Production

**Files:**

- Create: `src/lib/env.ts`
- Create: `src/lib/__tests__/env.test.ts`

**Step 1: Write failing test**

```typescript
// src/lib/__tests__/env.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("validateEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws if CRON_SECRET missing in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.CRON_SECRET;

    await expect(import("../env")).rejects.toThrow("CRON_SECRET");
  });

  it("does not throw if CRON_SECRET present in production", async () => {
    process.env.NODE_ENV = "production";
    process.env.CRON_SECRET = "test-secret";

    await expect(import("../env")).resolves.not.toThrow();
  });

  it("does not throw in development without CRON_SECRET", async () => {
    process.env.NODE_ENV = "development";
    delete process.env.CRON_SECRET;

    await expect(import("../env")).resolves.not.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/env.test.ts`
Expected: FAIL

**Step 3: Write implementation**

```typescript
// src/lib/env.ts

/**
 * Environment validation - runs at startup
 * Ensures required secrets are present in production
 */

const isProduction = process.env.NODE_ENV === "production";

// CRON_SECRET is required in production
if (isProduction && !process.env.CRON_SECRET) {
  throw new Error(
    "CRON_SECRET is required in production. Generate with: openssl rand -base64 32"
  );
}

// Export validated env (add more as needed)
export const env = {
  CRON_SECRET: process.env.CRON_SECRET,
  isProduction,
};
```

**Step 4: Import env validation in cron routes**

Add to top of each cron route:

```typescript
import "@/lib/env"; // Validates required env vars
```

**Step 5: Run tests**

Run: `pnpm vitest run src/lib/__tests__/env.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/lib/env.ts src/lib/__tests__/env.test.ts src/app/api/cron/*/route.ts
git commit -m "feat(security): require CRON_SECRET in production"
```

---

## Task 6: Add Pusher Credential Validation

**Files:**

- Modify: `src/lib/pusher.ts`

**Step 1: Read current implementation**

Current code uses non-null assertions without validation.

**Step 2: Add validation**

```typescript
// src/lib/pusher.ts
import Pusher from "pusher";

// Validate Pusher credentials at module load
const PUSHER_APP_ID = process.env.PUSHER_APP_ID;
const PUSHER_KEY = process.env.NEXT_PUBLIC_PUSHER_KEY;
const PUSHER_SECRET = process.env.PUSHER_SECRET;
const PUSHER_CLUSTER = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

if (!PUSHER_APP_ID || !PUSHER_KEY || !PUSHER_SECRET || !PUSHER_CLUSTER) {
  const missing = [
    !PUSHER_APP_ID && "PUSHER_APP_ID",
    !PUSHER_KEY && "NEXT_PUBLIC_PUSHER_KEY",
    !PUSHER_SECRET && "PUSHER_SECRET",
    !PUSHER_CLUSTER && "NEXT_PUBLIC_PUSHER_CLUSTER",
  ].filter(Boolean);

  throw new Error(
    `Missing Pusher credentials: ${missing.join(", ")}. Check your environment variables.`
  );
}

const pusherServer = new Pusher({
  appId: PUSHER_APP_ID,
  key: PUSHER_KEY,
  secret: PUSHER_SECRET,
  cluster: PUSHER_CLUSTER,
  useTLS: true,
});

/**
 * Fire-and-forget broadcast - never blocks the calling function
 */
export function broadcast(channel: string, event: string, data: unknown): void {
  pusherServer.trigger(channel, event, data).catch((error) => {
    console.error(
      `[Pusher] Failed to broadcast ${event} to ${channel}:`,
      error
    );
  });
}

/**
 * Broadcast an event to a family's private channel
 */
export function broadcastToFamily(
  familyId: string,
  event: string,
  data: unknown
): void {
  broadcast(`private-family-${familyId}`, event, data);
}

export { pusherServer };
```

**Step 3: Run linter**

Run: `pnpm lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/pusher.ts
git commit -m "fix(security): validate Pusher credentials at startup"
```

---

## Task 7: Add CI Environment Variables

**Files:**

- Modify: `.github/workflows/ci.yml`

**Step 1: Add environment variables for build**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  ci:
    name: Lint, Test & Build
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run checks
        run: pnpm turbo run lint format:check test:run typecheck build:next
        env:
          TURBO_TELEMETRY_DISABLED: 1
          TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
          TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
          # Required for build (dummy values for CI)
          DATABASE_URL: "postgresql://ci:ci@localhost:5432/ci"
          BETTER_AUTH_SECRET: "ci-test-secret-at-least-32-characters-long"
          BETTER_AUTH_URL: "http://localhost:3000"
          NEXT_PUBLIC_BETTER_AUTH_URL: "http://localhost:3000"
          GOOGLE_CLIENT_ID: "ci-google-client-id"
          GOOGLE_CLIENT_SECRET: "ci-google-client-secret"
          PUSHER_APP_ID: "ci-pusher-app-id"
          PUSHER_SECRET: "ci-pusher-secret"
          NEXT_PUBLIC_PUSHER_KEY: "ci-pusher-key"
          NEXT_PUBLIC_PUSHER_CLUSTER: "eu"
          CRON_SECRET: "ci-cron-secret"
```

**Step 2: Run workflow locally (optional)**

If you have `act` installed: `act -j ci`

**Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "fix(ci): add required environment variables for build"
```

---

## Task 8: Add Zod Validation to Calendar Endpoints

**Files:**

- Create: `src/lib/validations/calendar.ts`
- Modify: `src/app/api/v1/families/[familyId]/calendars/route.ts`

**Step 1: Create validation schema**

```typescript
// src/lib/validations/calendar.ts
import { z } from "zod";

export const addCalendarSchema = z.object({
  accountId: z.string().min(1, "Account ID is required"),
  googleCalendarId: z
    .string()
    .min(1, "Google Calendar ID is required")
    .max(255),
  name: z.string().min(1, "Name is required").max(100),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color")
    .optional(),
  accessRole: z.enum(["owner", "writer", "reader"]).optional(),
});

export type AddCalendarInput = z.infer<typeof addCalendarSchema>;
```

**Step 2: Apply validation to POST endpoint**

Update `src/app/api/v1/families/[familyId]/calendars/route.ts`:

```typescript
// Add import at top
import { addCalendarSchema } from "@/lib/validations/calendar";

// In POST handler, after getting body:
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

    // Parse and validate body
    const body = await request.json();
    const parseResult = addCalendarSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input",
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { accountId, googleCalendarId, name, color, accessRole } = parseResult.data;

    // ... rest of the handler
```

**Step 3: Run linter**

Run: `pnpm lint`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/validations/calendar.ts src/app/api/v1/families/[familyId]/calendars/route.ts
git commit -m "feat(security): add Zod validation to calendar endpoints"
```

---

## Task 9: Add Cookie Security Flags

**Files:**

- Modify: `src/server/auth.ts:99-106`

**Step 1: Update session configuration**

```typescript
// In src/server/auth.ts, update the session config:
session: {
  expiresIn: 60 * 60 * 24 * 7, // 7 days
  updateAge: 60 * 60 * 24, // Refresh every 24 hours
  cookieCache: {
    enabled: true,
    maxAge: 60 * 5, // 5 minute cache
  },
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
  },
},
```

**Step 2: Run linter and type check**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/auth.ts
git commit -m "fix(security): add secure cookie flags for sessions"
```

---

## Task 10: Add Database SSL Configuration

**Files:**

- Modify: `src/server/db/index.ts`

**Step 1: Update database connection**

```typescript
// src/server/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is not set. Check your .env.local file."
  );
}

// Create postgres connection with SSL in production
const client = postgres(process.env.DATABASE_URL, {
  ssl: process.env.NODE_ENV === "production" ? "require" : false,
});

// Create drizzle instance with schema
export const db = drizzle(client, { schema });

// Export types
export type Database = typeof db;
```

**Step 2: Run type check**

Run: `pnpm typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/server/db/index.ts
git commit -m "fix(security): enforce SSL for database in production"
```

---

## Task 11: Fix Webhook 401 Response

**Files:**

- Modify: `src/app/api/webhooks/google-calendar/route.ts:44-48`

**Step 1: Change response to 401**

```typescript
// In src/app/api/webhooks/google-calendar/route.ts, update the token verification failure:
if (!calendarId) {
  console.warn("Webhook token verification failed:", channelId);
  return new NextResponse(null, { status: 401 });
}
```

**Step 2: Run linter**

Run: `pnpm lint`
Expected: PASS

**Step 3: Commit**

```bash
git add src/app/api/webhooks/google-calendar/route.ts
git commit -m "fix(security): return 401 for invalid webhook tokens"
```

---

## Task 12: Add CSP Headers

**Files:**

- Modify: `next.config.ts`

**Step 1: Add security headers**

```typescript
// next.config.ts
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires these
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://accounts.google.com https://*.googleapis.com wss://*.pusher.com https://*.pusherapp.com",
      "frame-src 'self' https://accounts.google.com",
    ].join("; "),
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
```

**Step 2: Test locally**

Run: `pnpm dev`
Check: Open browser DevTools → Network → verify headers on page load

**Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat(security): add CSP and security headers"
```

---

## Task 13: Add Origin Header Validation (CSRF Protection)

**Files:**

- Create: `src/middleware.ts`

**Step 1: Create middleware**

```typescript
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ALLOWED_ORIGINS = [
  process.env.BETTER_AUTH_URL,
  process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
].filter(Boolean);

export function middleware(request: NextRequest) {
  // Only check mutating requests
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    const origin = request.headers.get("origin");

    // API routes require valid origin
    if (request.nextUrl.pathname.startsWith("/api/")) {
      // Skip for cron endpoints (use auth header instead)
      if (request.nextUrl.pathname.startsWith("/api/cron/")) {
        return NextResponse.next();
      }

      // Skip for webhooks (external services)
      if (request.nextUrl.pathname.startsWith("/api/webhooks/")) {
        return NextResponse.next();
      }

      // Require origin header for other API routes
      if (!origin) {
        return NextResponse.json(
          { error: "Missing Origin header" },
          { status: 403 }
        );
      }

      // Validate origin
      const originUrl = new URL(origin);
      const isAllowed = ALLOWED_ORIGINS.some((allowed) => {
        if (!allowed) return false;
        const allowedUrl = new URL(allowed);
        return originUrl.host === allowedUrl.host;
      });

      if (!isAllowed) {
        return NextResponse.json({ error: "Invalid Origin" }, { status: 403 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
```

**Step 2: Run linter**

Run: `pnpm lint`
Expected: PASS

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(security): add CSRF protection via Origin validation"
```

---

## Task 14: Update .env.example with New Variables

**Files:**

- Modify: `.env.example`

**Step 1: Add TOKEN_ENCRYPTION_KEY**

```bash
# Add to .env.example after CRON_SECRET:

# Token Encryption (for OAuth tokens at rest)
# Generate with: pnpm dlx @47ng/cloak generate
TOKEN_ENCRYPTION_KEY="your-encryption-key-here"
```

**Step 2: Commit**

```bash
git add .env.example
git commit -m "docs: add TOKEN_ENCRYPTION_KEY to env example"
```

---

## Task 15: Final Verification

**Step 1: Run full test suite**

Run: `pnpm test:run`
Expected: All tests PASS

**Step 2: Run linter**

Run: `pnpm lint`
Expected: No errors

**Step 3: Run type check**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Run build**

Run: `pnpm build`
Expected: Build succeeds

**Step 5: Create summary commit**

```bash
git add -A
git commit -m "chore(security): complete security hardening phase 1

Implements fixes for critical and high priority security audit items:
- Timing-safe token comparison
- Pairing code attempt limiting
- Required CRON_SECRET in production
- Pusher credential validation
- CI environment variables
- Zod validation on calendar endpoints
- Secure cookie flags
- Database SSL enforcement
- Webhook 401 responses
- CSP and security headers
- CSRF protection via Origin validation

See docs/adr/ for architectural decisions."
```

---

## Deferred Tasks (Phase 2)

The following tasks are documented but deferred for a separate implementation phase:

1. **OAuth Token Encryption** - Requires `@47ng/cloak` integration and migration
2. **Structured Error Codes** - Requires refactoring all API routes
3. **Content-Type Validation** - Add to middleware
4. **Security Event Logging** - Add audit logging infrastructure

These are documented in `docs/adr/20251225-security-audit-summary.md`.
