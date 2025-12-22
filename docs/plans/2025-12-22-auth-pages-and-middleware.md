# Authentication Pages & Route Protection - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create login/signup pages and protect all routes by default, with explicit exceptions for public routes.

**Architecture:** Middleware intercepts all requests, checking authentication via Better-Auth. Unauthenticated users are redirected to `/login` unless accessing public routes. next-intl handles locale routing, chained with auth protection.

**Tech Stack:** Better-Auth 1.4.7, Next.js 16 Middleware, next-intl, shadcn/ui forms

**Prerequisite:** This plan must be executed BEFORE the `2025-12-21-multi-account-google-oauth.md` plan.

**Non-overlapping scope:** This plan covers auth pages and middleware only. The OAuth plan covers Google account linking (assumes user is already authenticated).

---

## Public Routes (exceptions to protection)

These routes are accessible without authentication:

- `/` - Home/landing page
- `/login` - Login page
- `/signup` - Signup page
- `/api/auth/*` - Better-Auth API routes
- `/_next/*` - Next.js internals
- `/favicon.ico`, `/robots.txt` - Static assets

All other routes require authentication.

---

## Task 1: Create Auth Route Configuration

**Files:**

- Create: `src/lib/auth-routes.ts`

**Step 1: Create the route configuration file**

```typescript
/**
 * Authentication route configuration
 * Defines which routes are public vs protected
 */

// Routes that don't require authentication
export const publicRoutes = ["/", "/login", "/signup"] as const;

// Auth API routes (always public)
export const authApiPrefix = "/api/auth";

// Route to redirect unauthenticated users to
export const loginRoute = "/login";

// Route to redirect authenticated users to after login
export const defaultAuthRedirect = "/calendar";

/**
 * Check if a pathname is a public route
 * Handles locale prefixes (e.g., /en/login, /nl/signup)
 */
export function isPublicRoute(pathname: string): boolean {
  // Remove locale prefix if present
  const pathWithoutLocale = pathname.replace(/^\/(en|nl)/, "") || "/";

  return publicRoutes.some((route) => {
    if (route === "/") {
      return pathWithoutLocale === "/";
    }
    return pathWithoutLocale.startsWith(route);
  });
}

/**
 * Check if a pathname is an auth API route
 */
export function isAuthApiRoute(pathname: string): boolean {
  return pathname.startsWith(authApiPrefix);
}
```

**Step 2: Commit**

```bash
git add src/lib/auth-routes.ts
git commit -m "feat: add auth route configuration"
```

---

## Task 2: Create Middleware for Route Protection

**Files:**

- Create: `src/middleware.ts`

**Step 1: Create the middleware file**

```typescript
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
  return intlMiddleware(request);
}

export const config = {
  // Match all routes except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
```

**Step 2: Verify middleware compiles**

Run: `pnpm build`
Expected: Build succeeds without middleware errors

**Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth middleware with route protection"
```

---

## Task 3: Add i18n Messages for Auth Pages

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/nl.json`

**Step 1: Read current English messages**

Run: `cat messages/en.json`

**Step 2: Add auth messages to English**

Add to `messages/en.json`:

```json
{
  "Auth": {
    "login": "Log in",
    "signup": "Sign up",
    "email": "Email",
    "password": "Password",
    "confirmPassword": "Confirm password",
    "name": "Name",
    "loginTitle": "Welcome back",
    "loginDescription": "Enter your credentials to access your account",
    "signupTitle": "Create an account",
    "signupDescription": "Enter your details to get started",
    "noAccount": "Don't have an account?",
    "hasAccount": "Already have an account?",
    "loginButton": "Log in",
    "signupButton": "Create account",
    "loggingIn": "Logging in...",
    "signingUp": "Creating account...",
    "loginError": "Invalid email or password",
    "signupError": "Could not create account",
    "passwordMismatch": "Passwords do not match",
    "emailRequired": "Email is required",
    "passwordRequired": "Password is required",
    "nameRequired": "Name is required",
    "passwordMinLength": "Password must be at least 8 characters"
  }
}
```

**Step 3: Add auth messages to Dutch**

Add to `messages/nl.json`:

```json
{
  "Auth": {
    "login": "Inloggen",
    "signup": "Registreren",
    "email": "E-mail",
    "password": "Wachtwoord",
    "confirmPassword": "Bevestig wachtwoord",
    "name": "Naam",
    "loginTitle": "Welkom terug",
    "loginDescription": "Voer je gegevens in om toegang te krijgen",
    "signupTitle": "Account aanmaken",
    "signupDescription": "Vul je gegevens in om te beginnen",
    "noAccount": "Nog geen account?",
    "hasAccount": "Al een account?",
    "loginButton": "Inloggen",
    "signupButton": "Account aanmaken",
    "loggingIn": "Bezig met inloggen...",
    "signingUp": "Account aanmaken...",
    "loginError": "Ongeldige e-mail of wachtwoord",
    "signupError": "Kon account niet aanmaken",
    "passwordMismatch": "Wachtwoorden komen niet overeen",
    "emailRequired": "E-mail is verplicht",
    "passwordRequired": "Wachtwoord is verplicht",
    "nameRequired": "Naam is verplicht",
    "passwordMinLength": "Wachtwoord moet minimaal 8 tekens zijn"
  }
}
```

**Step 4: Commit**

```bash
git add messages/en.json messages/nl.json
git commit -m "feat: add i18n messages for auth pages"
```

---

## Task 4: Create Login Form Component

**Files:**

- Create: `src/components/auth/login-form.tsx`

**Step 1: Create auth components directory**

Run: `mkdir -p src/components/auth`

**Step 2: Create the login form component**

```typescript
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import authClient from "@/lib/auth-client";
import { defaultAuthRedirect } from "@/lib/auth-routes";

export function LoginForm() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || defaultAuthRedirect;

  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error(t("emailRequired"));
      return;
    }
    if (!password) {
      toast.error(t("passwordRequired"));
      return;
    }

    setIsLoading(true);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        toast.error(t("loginError"));
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (error) {
      console.error("Login error:", error);
      toast.error(t("loginError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          autoComplete="current-password"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            {t("loggingIn")}
          </>
        ) : (
          t("loginButton")
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link href="/signup" className="text-primary hover:underline">
          {t("signup")}
        </Link>
      </p>
    </form>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/auth/login-form.tsx
git commit -m "feat: add login form component"
```

---

## Task 5: Create Signup Form Component

**Files:**

- Create: `src/components/auth/signup-form.tsx`

**Step 1: Create the signup form component**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import authClient from "@/lib/auth-client";
import { defaultAuthRedirect } from "@/lib/auth-routes";

export function SignupForm() {
  const t = useTranslations("Auth");
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name) {
      toast.error(t("nameRequired"));
      return;
    }
    if (!email) {
      toast.error(t("emailRequired"));
      return;
    }
    if (!password) {
      toast.error(t("passwordRequired"));
      return;
    }
    if (password.length < 8) {
      toast.error(t("passwordMinLength"));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t("passwordMismatch"));
      return;
    }

    setIsLoading(true);

    try {
      const result = await authClient.signUp.email({
        name,
        email,
        password,
      });

      if (result.error) {
        toast.error(t("signupError"));
        return;
      }

      router.push(defaultAuthRedirect);
      router.refresh();
    } catch (error) {
      console.error("Signup error:", error);
      toast.error(t("signupError"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input
          id="name"
          type="text"
          placeholder="John Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isLoading}
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t("password")}</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isLoading}
          autoComplete="new-password"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            {t("signingUp")}
          </>
        ) : (
          t("signupButton")
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href="/login" className="text-primary hover:underline">
          {t("login")}
        </Link>
      </p>
    </form>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/auth/signup-form.tsx
git commit -m "feat: add signup form component"
```

---

## Task 6: Create Login Page

**Files:**

- Create: `src/app/[locale]/login/page.tsx`

**Step 1: Create login directory**

Run: `mkdir -p "src/app/[locale]/login"`

**Step 2: Create the login page**

```typescript
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { LoginForm } from "@/components/auth/login-form";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    title: t("login"),
  };
}

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("Auth");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto w-full max-w-sm space-y-6 p-4">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">{t("loginTitle")}</h1>
          <p className="text-muted-foreground">{t("loginDescription")}</p>
        </div>

        <Suspense fallback={<div className="h-64 animate-pulse rounded bg-muted" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add "src/app/[locale]/login/page.tsx"
git commit -m "feat: add login page"
```

---

## Task 7: Create Signup Page

**Files:**

- Create: `src/app/[locale]/signup/page.tsx`

**Step 1: Create signup directory**

Run: `mkdir -p "src/app/[locale]/signup"`

**Step 2: Create the signup page**

```typescript
import { setRequestLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { SignupForm } from "@/components/auth/signup-form";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Auth" });

  return {
    title: t("signup"),
  };
}

export default async function SignupPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const t = await getTranslations("Auth");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto w-full max-w-sm space-y-6 p-4">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">{t("signupTitle")}</h1>
          <p className="text-muted-foreground">{t("signupDescription")}</p>
        </div>

        <SignupForm />
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add "src/app/[locale]/signup/page.tsx"
git commit -m "feat: add signup page"
```

---

## Task 8: Create User Menu Component (for authenticated state)

**Files:**

- Create: `src/components/auth/user-menu.tsx`

**Step 1: Create the user menu component**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import authClient from "@/lib/auth-client";

interface UserMenuProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative size-10 rounded-full">
          <Avatar className="size-10">
            <AvatarImage src={user.image || undefined} alt={user.name} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/settings/accounts")}>
          <Settings className="mr-2 size-4" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <LogOut className="mr-2 size-4" />
          )}
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/auth/user-menu.tsx
git commit -m "feat: add user menu dropdown component"
```

---

## Task 9: Create Server-Side Session Helper

**Files:**

- Create: `src/lib/get-session.ts`

**Step 1: Create the session helper**

```typescript
import { headers } from "next/headers";
import { auth } from "@/server/auth";

/**
 * Get the current user session from the server
 * Use this in Server Components and Route Handlers
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

**Step 2: Commit**

```bash
git add src/lib/get-session.ts
git commit -m "feat: add server-side session helpers"
```

---

## Task 10: Verify Full Authentication Flow

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Test middleware protection**

1. Open: `http://localhost:3000/calendar`
2. Expected: Redirect to `/login?callbackUrl=/calendar`

**Step 3: Test signup flow**

1. Navigate to: `http://localhost:3000/signup`
2. Fill in name, email, password (8+ chars), confirm password
3. Click "Create account"
4. Expected: Redirect to `/calendar` (defaultAuthRedirect)

**Step 4: Test logout**

1. If UserMenu is integrated, click avatar -> Log out
2. Expected: Redirect to `/login`

**Step 5: Test login flow**

1. Navigate to: `http://localhost:3000/login`
2. Enter credentials from signup
3. Click "Log in"
4. Expected: Redirect to `/calendar`

**Step 6: Test callback URL preservation**

1. Log out
2. Navigate directly to: `http://localhost:3000/settings/accounts`
3. Expected: Redirect to `/login?callbackUrl=/settings/accounts`
4. Log in
5. Expected: Redirect to `/settings/accounts` (not default)

---

## Task 11: Update OAuth Plan Dependency

**Files:**

- Modify: `docs/plans/2025-12-21-multi-account-google-oauth.md`

**Step 1: Add prerequisite note**

Add at the top of the OAuth plan after the header:

```markdown
**Prerequisite:** Complete `2025-12-22-auth-pages-and-middleware.md` first. Users must be able to log in before linking Google accounts.
```

**Step 2: Commit**

```bash
git add docs/plans/2025-12-21-multi-account-google-oauth.md
git commit -m "docs: add prerequisite to OAuth plan"
```

---

## Verification Checklist

- [ ] Middleware exists at `src/middleware.ts`
- [ ] Public routes (/, /login, /signup) are accessible without auth
- [ ] Protected routes redirect to /login when unauthenticated
- [ ] callbackUrl is preserved in redirect
- [ ] Login page renders at `/login`
- [ ] Signup page renders at `/signup`
- [ ] User can create account via signup form
- [ ] User can log in via login form
- [ ] User is redirected to callbackUrl after login
- [ ] Auth messages work in both EN and NL locales
- [ ] Session helpers work in Server Components

---

## Files Created/Modified Summary

| File                                                  | Action   |
| ----------------------------------------------------- | -------- |
| `src/lib/auth-routes.ts`                              | Created  |
| `src/middleware.ts`                                   | Created  |
| `messages/en.json`                                    | Modified |
| `messages/nl.json`                                    | Modified |
| `src/components/auth/login-form.tsx`                  | Created  |
| `src/components/auth/signup-form.tsx`                 | Created  |
| `src/app/[locale]/login/page.tsx`                     | Created  |
| `src/app/[locale]/signup/page.tsx`                    | Created  |
| `src/components/auth/user-menu.tsx`                   | Created  |
| `src/lib/get-session.ts`                              | Created  |
| `docs/plans/2025-12-21-multi-account-google-oauth.md` | Modified |

---

## Execution Order

1. **This plan first** (auth-pages-and-middleware)
2. **Then OAuth plan** (multi-account-google-oauth)

The OAuth plan's settings page requires authenticated users, which this plan provides.
