# Session Additional Fields Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate session custom fields (`isDevice`, `memberRole`) from `customSession` plugin to `additionalFields` for proper cookie cache support.

**Architecture:** Add `isDevice` and `memberRole` as session table columns via better-auth's `additionalFields` config. Use `databaseHooks.session.create.before` to populate these fields when sessions are created. This allows the cookie cache to include these fields, fixing the device account permission bug.

**Tech Stack:** better-auth 1.4.7, Drizzle ORM, PostgreSQL

**References:**

- [Session Management | Better Auth](https://www.better-auth.com/docs/concepts/session-management)
- [Database Hooks | Better Auth](https://www.better-auth.com/docs/concepts/database)
- [GitHub Issue #5700](https://github.com/better-auth/better-auth/issues/5700) - additionalFields now cached

---

## Task 1: Add Session Columns to Schema

**Files:**

- Modify: `src/server/schema.ts:33-44`

**Step 1: Add isDevice and memberRole columns to sessions table**

```typescript
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  // Additional fields for cookie cache support
  isDevice: boolean("is_device").default(false),
  memberRole: text("member_role"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 2: Generate migration**

Run: `pnpm db:generate`
Expected: New migration file created in `drizzle/` folder

**Step 3: Apply migration**

Run: `pnpm db:migrate`
Expected: Migration applied successfully

**Step 4: Commit**

```bash
git add src/server/schema.ts drizzle/
git commit -m "feat(auth): add isDevice and memberRole to sessions schema"
```

---

## Task 2: Configure Session additionalFields

**Files:**

- Modify: `src/server/auth.ts:28-70`

**Step 1: Add session additionalFields configuration**

Add `session.additionalFields` to the auth config. Update the session config section:

```typescript
session: {
  expiresIn: 60 * 60 * 24 * 7, // 7 days
  updateAge: 60 * 60 * 24, // Refresh every 24 hours
  additionalFields: {
    isDevice: {
      type: "boolean",
      defaultValue: false,
    },
    memberRole: {
      type: "string",
      required: false,
    },
  },
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

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/server/auth.ts
git commit -m "feat(auth): configure session additionalFields for cookie cache"
```

---

## Task 3: Add Database Hook for Session Creation

**Files:**

- Modify: `src/server/auth.ts`

**Step 1: Add databaseHooks to populate session fields**

Add `databaseHooks` configuration after the `plugins` array in the auth config:

```typescript
databaseHooks: {
  session: {
    create: {
      before: async (session) => {
        // Get user to check if device
        const user = await db
          .select({ type: users.type })
          .from(users)
          .where(eq(users.id, session.userId))
          .limit(1);

        const isDevice = user[0]?.type === "device";

        // Get family membership for role
        const membership = await db
          .select({ role: familyMembers.role })
          .from(familyMembers)
          .where(eq(familyMembers.userId, session.userId))
          .limit(1);

        const memberRole = membership[0]?.role ?? null;

        return {
          data: {
            ...session,
            isDevice,
            memberRole,
          },
        };
      },
    },
  },
},
```

**Step 2: Add required imports at top of file**

Ensure these imports exist:

```typescript
import { users, familyMembers } from "./schema";
import { eq } from "drizzle-orm";
```

**Step 3: Run typecheck**

Run: `pnpm typecheck`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/server/auth.ts
git commit -m "feat(auth): add databaseHooks to populate session fields on create"
```

---

## Task 4: Simplify customSession Plugin

**Files:**

- Modify: `src/server/auth.ts`

**Step 1: Update customSession to use session fields instead of computing**

The `customSession` plugin can now read from session fields for `isDevice` and `memberRole`, but still needs to compute `familyId`, `memberId`, and `deviceName`:

```typescript
customSession(async ({ user, session }) => {
  // Query user's family membership for IDs (not cached, but not used for permissions)
  const membership = await db
    .select({
      familyId: familyMembers.familyId,
      memberId: familyMembers.id,
      displayName: familyMembers.displayName,
    })
    .from(familyMembers)
    .where(eq(familyMembers.userId, user.id))
    .limit(1);

  const member = membership[0];
  // isDevice and memberRole now come from session additionalFields (cookie cached)
  const sessionWithFields = session as { isDevice?: boolean; memberRole?: string };
  const isDevice = sessionWithFields.isDevice ?? false;

  return {
    user,
    session: {
      ...session,
      familyId: member?.familyId ?? null,
      memberId: member?.memberId ?? null,
      memberRole: sessionWithFields.memberRole ?? null, // Use cached value
      isDevice, // Use cached value
      deviceName: isDevice ? member?.displayName : null,
    },
  };
}),
```

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/server/auth.ts
git commit -m "refactor(auth): simplify customSession to use cached session fields"
```

---

## Task 5: Test with Device Account

**Step 1: Start dev server**

Run: `pnpm dev`
Expected: Server starts without errors

**Step 2: Clear existing session (if any)**

In browser, clear cookies for localhost or sign out

**Step 3: Sign in with device account**

Use the device pairing flow to create a new device session

**Step 4: Navigate to dashboard**

Go to the dashboard page

**Step 5: Verify quick action buttons are enabled**

Check that the quick action FAB buttons are NOT grayed out for the device account

**Step 6: Start a timer**

Click a quick action and select a family member to start a timer

Expected: Timer starts successfully

---

## Task 6: Test with Regular Account

**Step 1: Sign out and sign in with regular manager account**

**Step 2: Verify dashboard works normally**

**Step 3: Verify quick actions work for managers**

---

## Task 7: Run All Tests

**Step 1: Run unit tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Run linter**

Run: `pnpm lint`
Expected: No errors

---

## Rollback Plan

If issues occur:

1. Revert auth.ts changes: `git checkout HEAD~3 -- src/server/auth.ts`
2. Drop new columns (if needed): Create migration to remove `is_device` and `member_role` from sessions table
3. The `customSession` plugin alone should work (just without cookie caching)

---

## Notes

- The `databaseHooks.session.create.before` hook runs for ALL session creations, including those from the `deviceAuth` plugin
- Existing sessions won't have the new fields populated - they'll use `null`/`false` defaults until the user re-authenticates
- The `customSession` plugin still runs on each request but now uses the cached `isDevice` and `memberRole` values
