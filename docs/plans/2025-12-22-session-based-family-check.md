# Session-Based Family Check Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace cookie-based family membership check with session-based approach using better-auth's customSession plugin.

**Architecture:** Use `customSession` plugin to include `familyId` in session data. Remove middleware family check (can't query DB in edge runtime). Add family check in server layout for protected routes. Remove the `has-family` cookie entirely.

**Tech Stack:** better-auth customSession plugin, Next.js server layouts, Drizzle ORM

---

## Task 1: Add customSession Plugin to Return familyId

**Files:**

- Modify: `src/server/auth.ts`
- Modify: `src/lib/auth-client.ts`

**Step 1: Update server auth config with customSession plugin**

```typescript
// src/server/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession } from "better-auth/plugins";
import { db } from "./db";
import * as schema from "./schema";
import { familyMembers } from "./schema";
import { eq } from "drizzle-orm";

// ... existing env checks ...

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),

  plugins: [
    customSession(async ({ user, session }) => {
      // Query user's family membership
      const membership = await db
        .select({ familyId: familyMembers.familyId })
        .from(familyMembers)
        .where(eq(familyMembers.userId, user.id))
        .limit(1);

      return {
        user,
        session: {
          ...session,
          familyId: membership[0]?.familyId ?? null,
        },
      };
    }),
  ],

  // ... rest of existing config (socialProviders, account, session, baseURL, secret, trustedOrigins) ...
});

export type Auth = typeof auth;
```

**Step 2: Update auth client to infer custom session fields**

```typescript
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { customSessionClient } from "better-auth/client/plugins";
import type { auth } from "@/server/auth";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "",
  plugins: [customSessionClient<typeof auth>()],
});

// Export commonly used methods for convenience
export const { signIn, signOut, useSession } = authClient;

// Export the full client for advanced operations like linkSocial
export default authClient;
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/server/auth.ts src/lib/auth-client.ts
git commit -m "feat(auth): add customSession plugin with familyId"
```

---

## Task 2: Update getSession Helper to Include familyId Type

**Files:**

- Modify: `src/lib/get-session.ts`

**Step 1: Update type inference**

The session type should now include `familyId` automatically from the customSession plugin. Verify by checking that `session.session.familyId` is accessible.

```typescript
// src/lib/get-session.ts
import { headers } from "next/headers";
import { auth } from "@/server/auth";

/**
 * Get the current user session from the server
 * Use this in Server Components and Route Handlers
 * Session includes familyId from customSession plugin
 */
export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return session;
}

/**
 * Get the current user from the session
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  const session = await getSession();
  return session?.user || null;
}

/**
 * Get the current user's familyId from session
 * Returns null if not authenticated or no family
 */
export async function getCurrentFamilyId() {
  const session = await getSession();
  return session?.session?.familyId || null;
}

/**
 * Require authentication - throws redirect if not authenticated
 * Use in Server Components that require auth
 */
export async function requireAuth() {
  const session = await getSession();

  if (!session?.user) {
    // This will be caught by error boundary or redirect
    throw new Error("Unauthorized");
  }

  return session;
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/get-session.ts
git commit -m "feat(auth): add getCurrentFamilyId helper"
```

---

## Task 3: Remove Cookie-Based Family Check from Middleware

**Files:**

- Modify: `src/middleware.ts`
- Modify: `src/lib/auth-routes.ts`

**Step 1: Simplify middleware - remove family cookie check**

```typescript
// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { isPublicRoute, isAuthApiRoute, loginRoute } from "@/lib/auth-routes";

// Create next-intl middleware
const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.includes(".") // Static files like favicon.ico
  ) {
    return NextResponse.next();
  }

  // Allow API routes through (they handle their own auth)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Check if route is public
  if (isPublicRoute(pathname) || isAuthApiRoute(pathname)) {
    // Apply intl middleware for locale handling
    return intlMiddleware(request);
  }

  // For protected routes, check authentication
  // Better-Auth stores session in cookies
  const sessionCookie = request.cookies.get("better-auth.session_token");

  if (!sessionCookie?.value) {
    // No session - redirect to login
    const loginUrl = new URL(loginRoute, request.url);
    // Preserve the original URL to redirect back after login
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // User has session cookie - apply intl middleware and continue
  // Family membership check happens in layouts, not middleware
  return intlMiddleware(request);
}

export const config = {
  // Match all routes except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
```

**Step 2: Simplify auth-routes - remove family-related exports**

```typescript
// src/lib/auth-routes.ts
/**
 * Authentication route configuration
 * Defines which routes are public vs protected
 */

// Routes that don't require authentication
export const publicRoutes = ["/", "/login"] as const;

// Auth API routes (always public)
export const authApiPrefix = "/api/auth";

// Route to redirect unauthenticated users to
export const loginRoute = "/login";

// Route to redirect authenticated users to after login
export const defaultAuthRedirect = "/calendar";

// Route for family onboarding
export const onboardingRoute = "/onboarding";

// Routes that allow unauthenticated access for invite links
// (will redirect to login, then back to invite)
export const inviteRoutes = ["/join"] as const;

/**
 * Check if a pathname is a public route
 * Handles locale prefixes (e.g., /en/login, /nl/signup)
 */
export function isPublicRoute(pathname: string): boolean {
  // Remove locale prefix if present
  const pathWithoutLocale = pathname.replace(/^\/(en|nl)/, "") || "/";

  return (
    publicRoutes.some((route) => {
      if (route === "/") {
        return pathWithoutLocale === "/";
      }
      return pathWithoutLocale.startsWith(route);
    }) || inviteRoutes.some((route) => pathWithoutLocale.startsWith(route))
  );
}

/**
 * Check if a pathname is an auth API route
 */
export function isAuthApiRoute(pathname: string): boolean {
  return pathname.startsWith(authApiPrefix);
}
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/middleware.ts src/lib/auth-routes.ts
git commit -m "refactor(middleware): remove cookie-based family check"
```

---

## Task 4: Delete Cookie Utilities

**Files:**

- Delete: `src/lib/family-cookie.ts`
- Modify: `src/app/[locale]/onboarding/page.tsx` (remove cookie import)
- Modify: `src/app/[locale]/onboarding/complete/page.tsx` (remove cookie call)

**Step 1: Remove setFamilyCookie import from onboarding page**

```typescript
// src/app/[locale]/onboarding/page.tsx
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSession } from "@/lib/get-session";
import { getUserFamily } from "@/server/services/family-service";

interface OnboardingPageProps {
  params: Promise<{ locale: string }>;
}

export default async function OnboardingPage({ params }: OnboardingPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  // Check if user already has a family
  const family = await getUserFamily(session.user.id);

  if (family) {
    // User has a family, redirect to calendar
    redirect(`/${locale}/calendar`);
  }

  // User needs to create/join a family
  redirect(`/${locale}/onboarding/create`);
}
```

**Step 2: Remove setFamilyCookie call from complete page**

```typescript
// src/app/[locale]/onboarding/complete/page.tsx
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getSession } from "@/lib/get-session";
import { getUserFamily } from "@/server/services/family-service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

interface CompletePageProps {
  params: Promise<{ locale: string }>;
}

export default async function CompletePage({ params }: CompletePageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  const family = await getUserFamily(session.user.id);

  if (!family) {
    redirect(`/${locale}/onboarding/create`);
  }

  // No cookie needed - session now includes familyId via customSession

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
          <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <CardTitle className="text-2xl">All Set!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center">
        <p className="text-muted-foreground">
          Your family &ldquo;{family.name}&rdquo; is ready to go.
        </p>
        <Button asChild className="w-full">
          <Link href={`/${locale}/calendar`}>Go to Calendar</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Delete family-cookie.ts**

```bash
rm src/lib/family-cookie.ts
```

**Step 4: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add -A
git commit -m "refactor(auth): remove family cookie utilities"
```

---

## Task 5: Add Family Check to Protected Route Layouts

**Files:**

- Create: `src/app/[locale]/(family-required)/layout.tsx`
- Move calendar pages under new route group

**Step 1: Create family-required layout**

```typescript
// src/app/[locale]/(family-required)/layout.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";

interface FamilyRequiredLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function FamilyRequiredLayout({
  children,
  params,
}: FamilyRequiredLayoutProps) {
  const { locale } = await params;
  const session = await getSession();

  // Not authenticated - middleware should have caught this, but double-check
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  // No family - redirect to onboarding
  if (!session.session.familyId) {
    redirect(`/${locale}/onboarding`);
  }

  return <>{children}</>;
}
```

**Step 2: Move calendar under family-required route group**

The calendar pages at `src/app/[locale]/calendar/` should be moved to `src/app/[locale]/(family-required)/calendar/`.

```bash
mkdir -p src/app/[locale]/'(family-required)'
mv src/app/[locale]/calendar src/app/[locale]/'(family-required)'/
```

**Step 3: Verify directory structure**

```bash
ls -la src/app/[locale]/'(family-required)'/
```

Expected:

```
calendar/
layout.tsx
```

**Step 4: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(routes): add family-required layout with session check"
```

---

## Task 6: Update Settings Route to Use Family-Required Layout

**Files:**

- Move: `src/app/[locale]/settings/` to `src/app/[locale]/(family-required)/settings/`

**Step 1: Move settings directory**

```bash
mv src/app/[locale]/settings src/app/[locale]/'(family-required)'/
```

**Step 2: Verify directory structure**

```bash
ls -la src/app/[locale]/'(family-required)'/
```

Expected:

```
calendar/
settings/
layout.tsx
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor(routes): move settings under family-required layout"
```

---

## Task 7: Manual Testing

**Step 1: Start dev server**

```bash
pnpm dev
```

**Step 2: Test login flow for user WITH family**

1. Clear all cookies
2. Login with a user that has a family
3. Verify redirect to `/calendar` works (no redirect loop)

Expected: Direct access to calendar after login

**Step 3: Test login flow for user WITHOUT family**

1. Clear all cookies
2. Login with a user that has no family
3. Verify redirect to `/onboarding` happens

Expected: Redirect to onboarding, then after creating family, can access calendar

**Step 4: Test accessing /calendar without family**

1. Login as user without family
2. Navigate directly to `/calendar`
3. Verify redirect to `/onboarding`

Expected: Redirect to onboarding

**Step 5: Commit any fixes if needed**

---

## Summary

After completing all tasks:

1. ✅ Session includes `familyId` via customSession plugin
2. ✅ Middleware only checks auth, not family membership
3. ✅ Family check happens in layout (can query DB)
4. ✅ No more cookie sync issues
5. ✅ Type-safe familyId in session throughout app
