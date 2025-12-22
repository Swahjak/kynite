# Multi-Account Google OAuth Setup - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable parents to link multiple Google accounts to aggregate family calendars in one place.

**Architecture:** Users authenticate with email/password (existing), then link one or more Google accounts via Better-Auth's account linking feature. Each linked account stores OAuth tokens for Google Calendar API access. UI lives at `/settings/accounts`.

**Tech Stack:** Better-Auth 1.4.7, Drizzle ORM, Next.js 16 App Router, shadcn/ui, TanStack Query (future)

**Prerequisite:** Complete `2025-12-22-auth-pages-and-middleware.md` first. Users must be able to log in before linking Google accounts.

---

## Prerequisites

Before starting, ensure you have:

1. A Google Cloud project at https://console.cloud.google.com/
2. Google Calendar API enabled in the project
3. OAuth consent screen configured (External, with test users for dev)
4. OAuth 2.0 Client ID created (Web application type)
5. Redirect URI added: `http://localhost:3000/api/auth/callback/google`

---

## Task 1: Add Environment Variables

**Files:**

- Modify: `.env.example`
- Create: `.env.local` (if not exists, copy from example)

**Step 1: Update .env.example with Google OAuth vars**

Add these lines to `.env.example`:

```env
# Google OAuth Configuration
# Get credentials from: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Client-side auth URL (must be prefixed with NEXT_PUBLIC_)
NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000"
```

**Step 2: Copy to local environment**

Run: `cp .env.example .env.local` (if .env.local doesn't exist)

Then update `.env.local` with your actual Google credentials.

**Step 3: Commit**

```bash
git add .env.example
git commit -m "feat: add Google OAuth environment variables"
```

---

## Task 2: Configure Google OAuth Provider in Better-Auth

**Files:**

- Modify: `src/server/auth.ts`

**Step 1: Read current auth configuration**

Review: `src/server/auth.ts` (already read earlier - has email/password auth configured)

**Step 2: Add environment validation for Google credentials**

Add after existing env checks at line 14:

```typescript
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn(
    "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not set. Google OAuth disabled."
  );
}
```

**Step 3: Add Google social provider configuration**

Add `socialProviders` config after `emailAndPassword` block:

```typescript
  // Google OAuth provider for calendar access
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Request refresh tokens for server-side API access
      accessType: "offline",
      // Always show consent to ensure refresh token is returned
      prompt: "select_account consent",
      // Request calendar scopes for Story 1.2
      scope: [
        "email",
        "profile",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/calendar.events.readonly",
        "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
      ],
    },
  },

  // Enable account linking for multi-account support
  account: {
    accountLinking: {
      enabled: true,
      // Allow linking Google accounts with different emails
      allowDifferentEmails: true,
    },
  },
```

**Step 4: Verify dev server starts without errors**

Run: `pnpm dev`
Expected: Server starts at http://localhost:3000 without auth errors

**Step 5: Commit**

```bash
git add src/server/auth.ts
git commit -m "feat: configure Google OAuth provider with calendar scopes"
```

---

## Task 3: Create Client-Side Auth Utility

**Files:**

- Create: `src/lib/auth-client.ts`

**Step 1: Create the auth client file**

```typescript
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "",
});

// Export commonly used methods for convenience
export const { signIn, signUp, signOut, useSession } = authClient;

// Export the full client for advanced operations like linkSocial
export default authClient;
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm build`
Expected: Build succeeds (or at least no errors in auth-client.ts)

**Step 3: Commit**

```bash
git add src/lib/auth-client.ts
git commit -m "feat: add client-side auth utility"
```

---

## Task 4: Create Type Definitions for Linked Accounts

**Files:**

- Create: `src/types/accounts.ts`

**Step 1: Create the types file**

```typescript
/**
 * Represents a linked Google account
 */
export interface LinkedGoogleAccount {
  id: string;
  googleAccountId: string;
  email?: string;
  scopes: string[];
  linkedAt: Date;
}

/**
 * API response for linked accounts list
 */
export interface LinkedAccountsResponse {
  success: boolean;
  data?: {
    accounts: LinkedGoogleAccount[];
    count: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * API response for account operations (unlink, etc.)
 */
export interface AccountOperationResponse {
  success: boolean;
  data?: {
    message: string;
  };
  error?: {
    code: string;
    message: string;
  };
}
```

**Step 2: Commit**

```bash
git add src/types/accounts.ts
git commit -m "feat: add type definitions for linked accounts"
```

---

## Task 5: Create API Endpoint to List Linked Accounts

**Files:**

- Create: `src/app/api/v1/accounts/linked/route.ts`

**Step 1: Create directory structure**

Run: `mkdir -p src/app/api/v1/accounts/linked`

**Step 2: Create the route handler**

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { accounts } from "@/server/schema";
import { eq } from "drizzle-orm";
import type { LinkedAccountsResponse } from "@/types/accounts";

// GET /api/v1/accounts/linked - List linked Google accounts
export async function GET(): Promise<NextResponse<LinkedAccountsResponse>> {
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

    const linkedAccounts = await db
      .select({
        id: accounts.id,
        accountId: accounts.accountId,
        providerId: accounts.providerId,
        scope: accounts.scope,
        createdAt: accounts.createdAt,
      })
      .from(accounts)
      .where(eq(accounts.userId, session.user.id));

    // Filter to only Google accounts and format response
    const googleAccounts = linkedAccounts
      .filter((acc) => acc.providerId === "google")
      .map((acc) => ({
        id: acc.id,
        googleAccountId: acc.accountId,
        scopes: acc.scope?.split(" ") || [],
        linkedAt: acc.createdAt,
      }));

    return NextResponse.json({
      success: true,
      data: {
        accounts: googleAccounts,
        count: googleAccounts.length,
      },
    });
  } catch (error) {
    console.error("Error fetching linked accounts:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch accounts" },
      },
      { status: 500 }
    );
  }
}
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm build`
Expected: No errors in the route file

**Step 4: Commit**

```bash
git add src/app/api/v1/accounts/linked/route.ts
git commit -m "feat: add API endpoint to list linked Google accounts"
```

---

## Task 6: Create API Endpoint to Unlink Account

**Files:**

- Create: `src/app/api/v1/accounts/linked/[accountId]/route.ts`

**Step 1: Create directory**

Run: `mkdir -p "src/app/api/v1/accounts/linked/[accountId]"`

**Step 2: Create the route handler**

```typescript
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { accounts } from "@/server/schema";
import { and, eq } from "drizzle-orm";
import type { AccountOperationResponse } from "@/types/accounts";

type RouteParams = {
  params: Promise<{ accountId: string }>;
};

// DELETE /api/v1/accounts/linked/[accountId] - Unlink a Google account
export async function DELETE(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<AccountOperationResponse>> {
  try {
    const { accountId } = await params;

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

    // Verify the account belongs to this user and is a Google account
    const existingAccount = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, accountId),
          eq(accounts.userId, session.user.id),
          eq(accounts.providerId, "google")
        )
      )
      .limit(1);

    if (existingAccount.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Account not found" },
        },
        { status: 404 }
      );
    }

    // Delete the linked account
    await db
      .delete(accounts)
      .where(
        and(eq(accounts.id, accountId), eq(accounts.userId, session.user.id))
      );

    return NextResponse.json({
      success: true,
      data: { message: "Account unlinked successfully" },
    });
  } catch (error) {
    console.error("Error unlinking account:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to unlink account" },
      },
      { status: 500 }
    );
  }
}
```

**Step 3: Commit**

```bash
git add "src/app/api/v1/accounts/linked/[accountId]/route.ts"
git commit -m "feat: add API endpoint to unlink Google account"
```

---

## Task 7: Create Link Google Account Button Component

**Files:**

- Create: `src/components/settings/link-google-account-button.tsx`

**Step 1: Create settings directory**

Run: `mkdir -p src/components/settings`

**Step 2: Create the component**

```typescript
"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import authClient from "@/lib/auth-client";
import { toast } from "sonner";

interface LinkGoogleAccountButtonProps {
  onSuccess?: () => void;
}

export function LinkGoogleAccountButton({
  onSuccess,
}: LinkGoogleAccountButtonProps) {
  const [isLinking, setIsLinking] = useState(false);

  const handleLinkGoogle = async () => {
    setIsLinking(true);
    try {
      // Use Better-Auth's social linking
      await authClient.linkSocial({
        provider: "google",
        callbackURL: "/settings/accounts",
      });
      // User will be redirected to Google OAuth
      // onSuccess called after redirect back
      onSuccess?.();
    } catch (error) {
      setIsLinking(false);
      toast.error("Failed to initiate Google account linking");
      console.error(error);
    }
  };

  return (
    <Button
      onClick={handleLinkGoogle}
      disabled={isLinking}
      variant="outline"
      className="w-full"
    >
      {isLinking ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <Plus className="mr-2 size-4" />
      )}
      Link Google Account
    </Button>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/settings/link-google-account-button.tsx
git commit -m "feat: add link Google account button component"
```

---

## Task 8: Create Linked Account Card Component

**Files:**

- Create: `src/components/settings/linked-google-account-card.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useState } from "react";
import { Trash2, Mail, Calendar, Loader2 } from "lucide-react";
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
import { toast } from "sonner";
import type { LinkedGoogleAccount } from "@/types/accounts";

interface LinkedGoogleAccountCardProps {
  account: LinkedGoogleAccount;
  onUnlink: (accountId: string) => Promise<void>;
}

export function LinkedGoogleAccountCard({
  account,
  onUnlink,
}: LinkedGoogleAccountCardProps) {
  const [isUnlinking, setIsUnlinking] = useState(false);

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
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-muted">
          <Mail className="size-5" />
        </div>
        <div>
          <p className="font-medium">{account.googleAccountId}</p>
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
  );
}
```

**Step 2: Commit**

```bash
git add src/components/settings/linked-google-account-card.tsx
git commit -m "feat: add linked Google account card component"
```

---

## Task 9: Create Linked Accounts Section Component

**Files:**

- Create: `src/components/settings/linked-accounts-section.tsx`

**Step 1: Create the component**

```typescript
"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { LinkedGoogleAccountCard } from "./linked-google-account-card";
import { LinkGoogleAccountButton } from "./link-google-account-button";
import type { LinkedGoogleAccount } from "@/types/accounts";

export function LinkedAccountsSection() {
  const [accounts, setAccounts] = useState<LinkedGoogleAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/accounts/linked");
      const data = await response.json();

      if (data.success) {
        setAccounts(data.data.accounts);
        setError(null);
      } else {
        setError(data.error?.message || "Failed to load accounts");
      }
    } catch (err) {
      setError("Failed to load linked accounts");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleUnlink = async (accountId: string) => {
    const response = await fetch(`/api/v1/accounts/linked/${accountId}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (data.success) {
      setAccounts((prev) => prev.filter((acc) => acc.id !== accountId));
    } else {
      throw new Error(data.error?.message || "Failed to unlink");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {accounts.map((account) => (
          <LinkedGoogleAccountCard
            key={account.id}
            account={account}
            onUnlink={handleUnlink}
          />
        ))}
        {accounts.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No Google accounts linked yet
          </p>
        )}
      </div>

      <LinkGoogleAccountButton onSuccess={fetchAccounts} />
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/settings/linked-accounts-section.tsx
git commit -m "feat: add linked accounts section component"
```

---

## Task 10: Create Settings Layout

**Files:**

- Create: `src/app/[locale]/settings/layout.tsx`

**Step 1: Create settings directory**

Run: `mkdir -p "src/app/[locale]/settings"`

**Step 2: Create the layout**

```typescript
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function SettingsLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return <>{children}</>;
}
```

**Step 3: Commit**

```bash
git add "src/app/[locale]/settings/layout.tsx"
git commit -m "feat: add settings layout"
```

---

## Task 11: Create Accounts Settings Page

**Files:**

- Create: `src/app/[locale]/settings/accounts/page.tsx`

**Step 1: Create accounts directory**

Run: `mkdir -p "src/app/[locale]/settings/accounts"`

**Step 2: Create the page**

```typescript
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { LinkedAccountsSection } from "@/components/settings/linked-accounts-section";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function AccountsSettingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return (
    <div className="container mx-auto max-w-2xl py-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Linked Accounts</h1>
          <p className="text-muted-foreground">
            Manage your connected Google accounts for calendar access
          </p>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="mb-4 text-lg font-semibold">Google Accounts</h2>
          <LinkedAccountsSection />
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Verify page renders**

Run: `pnpm dev`
Navigate to: `http://localhost:3000/settings/accounts`
Expected: Page renders with "Linked Accounts" heading and empty state

**Step 4: Commit**

```bash
git add "src/app/[locale]/settings/accounts/page.tsx"
git commit -m "feat: add accounts settings page"
```

---

## Task 12: Create Google Token Service (prep for Story 1.2)

**Files:**

- Create: `src/server/services/google-token-service.ts`

**Step 1: Create services directory**

Run: `mkdir -p src/server/services`

**Step 2: Create the token service**

```typescript
import { db } from "@/server/db";
import { accounts } from "@/server/schema";
import { and, eq } from "drizzle-orm";

interface TokenResult {
  accessToken: string;
  refreshToken: string | null;
  accountId: string;
  expiresAt: Date | null;
}

/**
 * Get Google OAuth tokens for a specific user
 * Used by Story 1.2 Calendar Aggregator to fetch calendar data
 */
export async function getGoogleTokensForUser(
  userId: string
): Promise<TokenResult[]> {
  const googleAccounts = await db
    .select({
      id: accounts.id,
      accountId: accounts.accountId,
      accessToken: accounts.accessToken,
      refreshToken: accounts.refreshToken,
      accessTokenExpiresAt: accounts.accessTokenExpiresAt,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "google")));

  return googleAccounts
    .filter((acc) => acc.accessToken !== null)
    .map((acc) => ({
      accessToken: acc.accessToken!,
      refreshToken: acc.refreshToken,
      accountId: acc.accountId,
      expiresAt: acc.accessTokenExpiresAt,
    }));
}

/**
 * Get Google OAuth token for a specific account
 */
export async function getGoogleTokenForAccount(
  userId: string,
  accountId: string
): Promise<TokenResult | null> {
  const result = await db
    .select({
      id: accounts.id,
      accountId: accounts.accountId,
      accessToken: accounts.accessToken,
      refreshToken: accounts.refreshToken,
      accessTokenExpiresAt: accounts.accessTokenExpiresAt,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.id, accountId),
        eq(accounts.providerId, "google")
      )
    )
    .limit(1);

  if (result.length === 0 || !result[0].accessToken) {
    return null;
  }

  return {
    accessToken: result[0].accessToken,
    refreshToken: result[0].refreshToken,
    accountId: result[0].accountId,
    expiresAt: result[0].accessTokenExpiresAt,
  };
}

/**
 * Check if a token is expired (with 5 minute buffer)
 */
export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  return Date.now() >= expiresAt.getTime() - bufferMs;
}
```

**Step 3: Commit**

```bash
git add src/server/services/google-token-service.ts
git commit -m "feat: add Google token service for calendar API access"
```

---

## Task 13: End-to-End Verification

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Create a test user (if not exists)**

Navigate to your app and create a user with email/password authentication.

**Step 3: Test the OAuth flow**

1. Navigate to: `http://localhost:3000/settings/accounts`
2. Click "Link Google Account"
3. Verify redirect to Google OAuth consent screen
4. Verify calendar scopes are listed
5. Authorize the application
6. Verify redirect back to `/settings/accounts`
7. Verify the linked account appears in the list

**Step 4: Test unlinking**

1. Click the trash icon on a linked account
2. Confirm the unlink dialog
3. Verify the account is removed from the list

**Step 5: Test multiple accounts**

1. Click "Link Google Account" again
2. Link a different Google account
3. Verify both accounts appear in the list

---

## Verification Checklist

- [ ] Environment variables configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- [ ] Dev server starts without errors
- [ ] Settings page renders at `/settings/accounts`
- [ ] "Link Google Account" button initiates OAuth flow
- [ ] Google consent screen shows calendar scopes
- [ ] Tokens are stored after authorization
- [ ] Linked accounts display in the list
- [ ] Multiple accounts can be linked
- [ ] Accounts can be unlinked
- [ ] Token service returns valid tokens for linked accounts

---

## Files Created/Modified Summary

| File                                                     | Action   |
| -------------------------------------------------------- | -------- |
| `.env.example`                                           | Modified |
| `src/server/auth.ts`                                     | Modified |
| `src/lib/auth-client.ts`                                 | Created  |
| `src/types/accounts.ts`                                  | Created  |
| `src/app/api/v1/accounts/linked/route.ts`                | Created  |
| `src/app/api/v1/accounts/linked/[accountId]/route.ts`    | Created  |
| `src/components/settings/link-google-account-button.tsx` | Created  |
| `src/components/settings/linked-google-account-card.tsx` | Created  |
| `src/components/settings/linked-accounts-section.tsx`    | Created  |
| `src/app/[locale]/settings/layout.tsx`                   | Created  |
| `src/app/[locale]/settings/accounts/page.tsx`            | Created  |
| `src/server/services/google-token-service.ts`            | Created  |
