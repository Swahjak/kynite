# Calendar Sync Error Handling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve debugging of calendar sync failures by adding account context to logs and showing sync errors to users in the UI.

**Architecture:** Add error tracking fields to the accounts table, update token service to log with account context and persist errors, expose errors via API, and display them in settings (account cards) and calendar header.

**Tech Stack:** Drizzle ORM, PostgreSQL, Next.js API routes, React components with shadcn/ui

---

## Task 1: Add Error Fields to Schema

**Files:**

- Modify: `src/server/schema.ts:54-71`
- Create: `drizzle/0021_add_account_sync_error.sql`

**Step 1: Add error fields to accounts table schema**

In `src/server/schema.ts`, add two new fields to the `accounts` table after line 70 (`updatedAt`):

```typescript
  lastSyncError: text("last_sync_error"),
  lastSyncErrorAt: timestamp("last_sync_error_at", { mode: "date" }),
```

**Step 2: Generate migration**

Run: `pnpm db:generate`
Expected: New migration file created in `drizzle/` directory

**Step 3: Verify migration content**

Check the generated migration adds the two columns. If not auto-generated correctly, create `drizzle/0021_add_account_sync_error.sql`:

```sql
ALTER TABLE "accounts" ADD COLUMN "last_sync_error" text;
ALTER TABLE "accounts" ADD COLUMN "last_sync_error_at" timestamp;
```

**Step 4: Run migration**

Run: `pnpm db:migrate`
Expected: Migration applied successfully

**Step 5: Commit**

```bash
git add src/server/schema.ts drizzle/
git commit -m "feat(schema): add sync error tracking fields to accounts table"
```

---

## Task 2: Enhance Token Service Logging

**Files:**

- Modify: `src/server/services/google-token-service.ts:96-175`

**Step 1: Update refreshGoogleToken to provide better error context**

Replace the `refreshGoogleToken` function (lines 96-120):

```typescript
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
    const errorBody = await response.text().catch(() => "");
    const errorMessage =
      response.status === 400
        ? "invalid_grant - token revoked or expired"
        : `status ${response.status}`;
    throw new Error(
      `Token refresh failed: ${errorMessage}${errorBody ? ` - ${errorBody}` : ""}`
    );
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}
```

**Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/google-token-service.ts
git commit -m "fix(token): improve error messages for token refresh failures"
```

---

## Task 3: Track and Clear Sync Errors

**Files:**

- Modify: `src/server/services/google-token-service.ts:143-175`

**Step 1: Add error tracking to getValidAccessToken**

Replace the `getValidAccessToken` function (lines 143-175):

```typescript
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
      // Clear any previous error on success
      await db
        .update(accounts)
        .set({ lastSyncError: null, lastSyncErrorAt: null })
        .where(eq(accounts.id, accountDbId));
      return refreshed.accessToken;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `Failed to refresh token for account ${accountDbId}:`,
        errorMessage
      );
      // Persist error for UI display
      await db
        .update(accounts)
        .set({
          lastSyncError: "Token refresh failed - please re-link account",
          lastSyncErrorAt: new Date(),
        })
        .where(eq(accounts.id, accountDbId));
      return null;
    }
  }

  return accessToken;
}
```

**Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/server/services/google-token-service.ts
git commit -m "feat(token): track sync errors in accounts table with account context logging"
```

---

## Task 4: Update LinkedGoogleAccount Type

**Files:**

- Modify: `src/types/accounts.ts`

**Step 1: Read current type definition**

Run: `cat src/types/accounts.ts` to see current structure.

**Step 2: Add error fields to LinkedGoogleAccount type**

Add to the `LinkedGoogleAccount` interface:

```typescript
lastSyncError?: string | null;
lastSyncErrorAt?: string | null; // ISO string for JSON serialization
```

**Step 3: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Commit**

```bash
git add src/types/accounts.ts
git commit -m "feat(types): add sync error fields to LinkedGoogleAccount"
```

---

## Task 5: Expose Errors in API Response

**Files:**

- Modify: `src/app/api/v1/accounts/linked/route.ts`

**Step 1: Read current API implementation**

Examine the file to understand how linked accounts are queried and returned.

**Step 2: Include error fields in response**

Update the select query to include `lastSyncError` and `lastSyncErrorAt` fields, and include them in the mapped response objects.

**Step 3: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Test API manually**

Run: `curl http://localhost:3000/api/v1/accounts/linked` (with auth)
Expected: Response includes `lastSyncError` and `lastSyncErrorAt` fields (null if no error)

**Step 5: Commit**

```bash
git add src/app/api/v1/accounts/linked/route.ts
git commit -m "feat(api): include sync error fields in linked accounts response"
```

---

## Task 6: Show Error in Account Card

**Files:**

- Modify: `src/components/settings/linked-google-account-card.tsx`

**Step 1: Add AlertCircle import**

Add to imports:

```typescript
import { AlertCircle } from "lucide-react";
```

**Step 2: Add error indicator after the email/calendar info section**

After line 86 (the closing `</div>` of the info section), add:

```tsx
{
  account.lastSyncError && (
    <div className="text-destructive mt-2 flex items-center gap-2 text-sm">
      <AlertCircle className="size-4 shrink-0" />
      <span>{account.lastSyncError}</span>
    </div>
  );
}
```

**Step 3: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 4: Visual verification**

Start dev server and check settings page - accounts with errors should show red warning.

**Step 5: Commit**

```bash
git add src/components/settings/linked-google-account-card.tsx
git commit -m "feat(settings): show sync error indicator in account cards"
```

---

## Task 7: Add Account Errors Hook

**Files:**

- Modify: `src/hooks/use-settings.ts`

**Step 1: Add useAccountErrors hook**

Add after the existing hooks:

```typescript
export function useAccountErrors() {
  const { data: accounts } = useLinkedAccounts();

  const accountsWithErrors =
    accounts?.filter((account) => account.lastSyncError !== null) ?? [];

  return {
    hasErrors: accountsWithErrors.length > 0,
    errorCount: accountsWithErrors.length,
    accountsWithErrors,
  };
}
```

**Step 2: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/use-settings.ts
git commit -m "feat(hooks): add useAccountErrors hook for checking sync status"
```

---

## Task 8: Show Sync Warning in Calendar Header

**Files:**

- Modify: `src/components/calendar/calendar-header.tsx` (or equivalent header component)

**Step 1: Find the calendar header component**

Run: `ls src/components/calendar/` to identify the header component.

**Step 2: Add imports**

```typescript
import { AlertTriangle } from "lucide-react";
import { useAccountErrors } from "@/hooks/use-settings";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
```

**Step 3: Add hook usage in component**

```typescript
const { hasErrors } = useAccountErrors();
```

**Step 4: Add warning indicator in header**

Add near other header icons/controls:

```tsx
{
  hasErrors && (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="text-destructive">
            <AlertTriangle className="size-5" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Some calendars have sync issues.</p>
          <p className="text-muted-foreground text-xs">
            Check Settings → Accounts
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
```

**Step 5: Verify typecheck passes**

Run: `pnpm typecheck`
Expected: No errors

**Step 6: Visual verification**

Check calendar page shows warning when accounts have errors.

**Step 7: Commit**

```bash
git add src/components/calendar/
git commit -m "feat(calendar): show sync error warning in header"
```

---

## Task 9: Final Verification

**Step 1: Run full typecheck**

Run: `pnpm typecheck`
Expected: No errors

**Step 2: Run linter**

Run: `pnpm lint`
Expected: No errors (or fix any)

**Step 3: Run tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 4: Manual E2E verification**

1. Link a Google account
2. Check settings page shows account without error
3. Simulate error (e.g., revoke access in Google account settings)
4. Trigger sync
5. Verify error appears in settings and calendar header

**Step 5: Final commit if any fixes needed**

```bash
git add .
git commit -m "fix: address lint/test issues from sync error feature"
```

---

## Summary

After completing all tasks:

- Token refresh errors include account ID in logs
- Errors are persisted in accounts table
- Settings page shows which accounts have issues
- Calendar header shows warning when any account has sync errors
- Users can identify and fix issues by re-linking affected accounts
