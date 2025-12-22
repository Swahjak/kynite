# Google SSO Only Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove email/password authentication and make Google SSO the only login method.

**Architecture:** Replace the current email/password + Google OAuth dual authentication with Google SSO only. Users authenticate via Google OAuth which creates their account on first login. Multi-account support preserved for linking additional Google accounts (calendar access).

**Tech Stack:** Better-Auth 1.4.7, Next.js 16, Drizzle ORM, PostgreSQL, next-intl

---

## Task 1: Create Google Sign-In Button Component

**Files:**
- Create: `src/components/auth/google-sign-in-button.tsx`

**Step 1: Create the component file**

```tsx
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { defaultAuthRedirect } from "@/lib/auth-routes";
import { useTranslations } from "next-intl";

interface GoogleSignInButtonProps {
  callbackUrl?: string;
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function GoogleSignInButton({ callbackUrl }: GoogleSignInButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const t = useTranslations("Auth");

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: callbackUrl || defaultAuthRedirect,
      });
    } catch (error) {
      console.error("Google sign-in error:", error);
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleGoogleSignIn}
      disabled={isLoading}
      variant="outline"
      className="w-full"
      size="lg"
    >
      {isLoading ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <GoogleIcon className="mr-2 size-5" />
      )}
      {isLoading ? t("signingIn") : t("continueWithGoogle")}
    </Button>
  );
}
```

**Step 2: Verify the component compiles**

Run: `pnpm build 2>&1 | head -50`
Expected: Build may fail due to missing translation keys (expected, fixed in Task 6)

**Step 3: Commit**

```bash
git add src/components/auth/google-sign-in-button.tsx
git commit -m "feat(auth): add Google sign-in button component"
```

---

## Task 2: Update Login Page

**Files:**
- Modify: `src/app/[locale]/login/page.tsx`

**Step 1: Replace login page content**

Replace entire file with:

```tsx
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ callbackUrl?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({
    locale: locale as Locale,
    namespace: "Auth",
  });

  return {
    title: t("login"),
  };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { callbackUrl } = await searchParams;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("Auth");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto w-full max-w-sm space-y-6 p-4">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">{t("loginTitle")}</h1>
          <p className="text-muted-foreground">{t("loginDescription")}</p>
        </div>

        <Suspense
          fallback={<div className="bg-muted h-12 animate-pulse rounded" />}
        >
          <GoogleSignInButton callbackUrl={callbackUrl} />
        </Suspense>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/[locale]/login/page.tsx
git commit -m "feat(auth): replace login form with Google SSO button"
```

---

## Task 3: Remove Signup Page

**Files:**
- Delete: `src/app/[locale]/signup/page.tsx`

**Step 1: Delete the signup page**

```bash
rm src/app/[locale]/signup/page.tsx
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat(auth): remove signup page (Google SSO handles registration)"
```

---

## Task 4: Update Auth Routes Configuration

**Files:**
- Modify: `src/lib/auth-routes.ts`

**Step 1: Remove signup from public routes**

Replace line 7:

```typescript
// OLD:
export const publicRoutes = ["/", "/login", "/signup"] as const;

// NEW:
export const publicRoutes = ["/", "/login"] as const;
```

**Step 2: Commit**

```bash
git add src/lib/auth-routes.ts
git commit -m "feat(auth): remove signup from public routes"
```

---

## Task 5: Update Auth Client Exports

**Files:**
- Modify: `src/lib/auth-client.ts`

**Step 1: Remove signUp export**

Replace line 8:

```typescript
// OLD:
export const { signIn, signUp, signOut, useSession } = authClient;

// NEW:
export const { signIn, signOut, useSession } = authClient;
```

**Step 2: Commit**

```bash
git add src/lib/auth-client.ts
git commit -m "refactor(auth): remove signUp export (no longer used)"
```

---

## Task 6: Update Translations

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/nl.json`

**Step 1: Update English translations**

Replace the `"Auth"` section in `messages/en.json` with:

```json
"Auth": {
  "login": "Sign in",
  "loginTitle": "Welcome",
  "loginDescription": "Sign in with your Google account to continue",
  "continueWithGoogle": "Continue with Google",
  "signingIn": "Signing in...",
  "loginError": "Could not sign in. Please try again.",
  "signOut": "Sign out"
}
```

**Step 2: Update Dutch translations**

Replace the `"Auth"` section in `messages/nl.json` with:

```json
"Auth": {
  "login": "Inloggen",
  "loginTitle": "Welkom",
  "loginDescription": "Log in met je Google-account om door te gaan",
  "continueWithGoogle": "Doorgaan met Google",
  "signingIn": "Bezig met inloggen...",
  "loginError": "Kon niet inloggen. Probeer het opnieuw.",
  "signOut": "Uitloggen"
}
```

**Step 3: Commit**

```bash
git add messages/en.json messages/nl.json
git commit -m "feat(i18n): update auth translations for Google SSO"
```

---

## Task 7: Update Auth Server Configuration

**Files:**
- Modify: `src/server/auth.ts`

**Step 1: Remove emailAndPassword config**

Delete lines 35-38:

```typescript
// DELETE THIS BLOCK:
emailAndPassword: {
  enabled: true,
  requireEmailVerification: false,
},
```

**Step 2: Remove verification from schema mapping**

In the schema object (around line 31), remove the verification line:

```typescript
// OLD:
schema: {
  user: schema.users,
  session: schema.sessions,
  account: schema.accounts,
  verification: schema.verifications,  // DELETE THIS LINE
},

// NEW:
schema: {
  user: schema.users,
  session: schema.sessions,
  account: schema.accounts,
},
```

**Step 3: Commit**

```bash
git add src/server/auth.ts
git commit -m "feat(auth): disable email/password, remove verifications from schema"
```

---

## Task 8: Update Database Schema

**Files:**
- Modify: `src/server/schema.ts`

**Step 1: Remove password column from accounts table**

Delete line 54:

```typescript
// DELETE THIS LINE:
password: text("password"),
```

**Step 2: Remove verifications table**

Delete lines 59-69 (the entire verifications table definition):

```typescript
// DELETE THIS BLOCK:
/**
 * Verifications table - Email verification and password reset tokens
 */
export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 3: Remove verification type exports**

Delete lines 81-82:

```typescript
// DELETE THESE LINES:
export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;
```

**Step 4: Push schema changes to database**

Run: `pnpm db:push`
Expected: Schema changes applied successfully

**Step 5: Commit**

```bash
git add src/server/schema.ts
git commit -m "feat(db): remove verifications table and password column"
```

---

## Task 9: Prevent Unlinking Only Google Account

**Files:**
- Modify: `src/app/api/v1/accounts/linked/[accountId]/route.ts`

**Step 1: Add count check before deletion**

Add this check after the existingAccount verification (after line 56), before the delete:

```typescript
// Add after line 56 (after "Account not found" check):

// Prevent unlinking the only Google account
const googleAccountCount = await db
  .select({ id: accounts.id })
  .from(accounts)
  .where(
    and(
      eq(accounts.userId, session.user.id),
      eq(accounts.providerId, "google")
    )
  );

if (googleAccountCount.length <= 1) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "CANNOT_UNLINK_PRIMARY",
        message: "Cannot unlink your only Google account",
      },
    },
    { status: 400 }
  );
}
```

**Step 2: Commit**

```bash
git add src/app/api/v1/accounts/linked/[accountId]/route.ts
git commit -m "fix(api): prevent unlinking only Google account"
```

---

## Task 10: Delete Unused Auth Components

**Files:**
- Delete: `src/components/auth/login-form.tsx`
- Delete: `src/components/auth/signup-form.tsx`

**Step 1: Delete the files**

```bash
rm src/components/auth/login-form.tsx
rm src/components/auth/signup-form.tsx
```

**Step 2: Commit**

```bash
git add -A
git commit -m "refactor(auth): remove unused email/password form components"
```

---

## Task 11: Verify Build and Lint

**Files:** None (verification only)

**Step 1: Run linter**

Run: `pnpm lint`
Expected: No errors

**Step 2: Run build**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Fix any issues**

If errors occur, fix them before proceeding.

---

## Task 12: Manual Testing Checklist

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Test login flow**

- [ ] Navigate to `/login` - should show Google SSO button
- [ ] Click "Continue with Google" - should redirect to Google OAuth
- [ ] Complete Google sign-in - should redirect to `/calendar`
- [ ] Check session cookie `better-auth.session_token` exists

**Step 3: Test new user registration**

- [ ] Sign out and sign in with a new Google account
- [ ] Verify user is created in database
- [ ] Verify redirects to `/calendar` after first login

**Step 4: Test protected routes**

- [ ] Clear cookies and navigate to `/calendar`
- [ ] Should redirect to `/login`
- [ ] After login with callbackUrl, should return to original page

**Step 5: Test account linking**

- [ ] Go to `/settings/accounts`
- [ ] Link a second Google account
- [ ] Verify both accounts appear in list
- [ ] Verify cannot unlink primary account (should show error)
- [ ] Verify can unlink secondary account

**Step 6: Test signup redirect**

- [ ] Navigate to `/signup` - should 404 (page deleted)

**Step 7: Test both locales**

- [ ] Test `/en/login` - shows English
- [ ] Test `/nl/login` - shows Dutch

---

## Summary

| Task | Description | Commit Message |
|------|-------------|----------------|
| 1 | Create Google sign-in button | `feat(auth): add Google sign-in button component` |
| 2 | Update login page | `feat(auth): replace login form with Google SSO button` |
| 3 | Remove signup page | `feat(auth): remove signup page (Google SSO handles registration)` |
| 4 | Update auth routes | `feat(auth): remove signup from public routes` |
| 5 | Update auth client | `refactor(auth): remove signUp export (no longer used)` |
| 6 | Update translations | `feat(i18n): update auth translations for Google SSO` |
| 7 | Update auth config | `feat(auth): disable email/password, remove verifications from schema` |
| 8 | Update database schema | `feat(db): remove verifications table and password column` |
| 9 | Prevent unlinking only account | `fix(api): prevent unlinking only Google account` |
| 10 | Delete unused components | `refactor(auth): remove unused email/password form components` |
| 11 | Verify build | N/A |
| 12 | Manual testing | N/A |
