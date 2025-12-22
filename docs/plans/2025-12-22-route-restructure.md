# Route Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the `app/[locale]` directory structure by removing nested route groups and adding a proper AppShell with localStorage-persisted interaction mode.

**Architecture:** Replace deep route nesting `(family-required)/(manage|wall)` with flat `(auth)` and `(app)` groups. Mode persistence moves from route-based to localStorage. AppShell provides consistent header + collapsible sidebar for all authenticated routes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, shadcn/ui

---

## Task 1: Update InteractionModeContext with localStorage persistence

**Files:**

- Modify: `src/contexts/interaction-mode-context.tsx`

**Step 1: Write the implementation**

Replace the entire file with localStorage-based mode persistence:

```tsx
"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

export type InteractionMode = "wall" | "manage";

const STORAGE_KEY = "family-planner:display-mode";

interface InteractionModeContextValue {
  mode: InteractionMode;
  toggleMode: () => void;
  setMode: (mode: InteractionMode) => void;
}

const InteractionModeContext =
  createContext<InteractionModeContextValue | null>(null);

interface InteractionModeProviderProps {
  children: ReactNode;
}

export function InteractionModeProvider({
  children,
}: InteractionModeProviderProps) {
  const [mode, setModeState] = useState<InteractionMode>("manage");
  const [isHydrated, setIsHydrated] = useState(false);

  // Read from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "wall" || stored === "manage") {
      setModeState(stored);
    }
    setIsHydrated(true);
  }, []);

  const setMode = useCallback((newMode: InteractionMode) => {
    localStorage.setItem(STORAGE_KEY, newMode);
    setModeState(newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === "manage" ? "wall" : "manage");
  }, [mode, setMode]);

  // Prevent hydration mismatch by rendering children only after hydration
  if (!isHydrated) {
    return null;
  }

  return (
    <InteractionModeContext.Provider value={{ mode, toggleMode, setMode }}>
      {children}
    </InteractionModeContext.Provider>
  );
}

export function useInteractionMode(): InteractionModeContextValue {
  const context = useContext(InteractionModeContext);
  if (!context) {
    throw new Error(
      "useInteractionMode must be used within InteractionModeProvider"
    );
  }
  return context;
}

/**
 * Safe version of useInteractionMode that returns "manage" mode as default
 * when used outside of InteractionModeProvider.
 */
export function useInteractionModeSafe(): InteractionModeContextValue {
  const context = useContext(InteractionModeContext);
  return context ?? { mode: "manage", toggleMode: () => {}, setMode: () => {} };
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/contexts/interaction-mode-context.tsx
git commit -m "feat: add localStorage persistence to InteractionModeContext"
```

---

## Task 2: Create ModeToggle component

**Files:**

- Create: `src/components/layout/mode-toggle.tsx`

**Step 1: Create the component**

```tsx
"use client";

import { Monitor, MonitorSmartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ModeToggleProps {
  /** Only render if user is a manager (parent) */
  isManager: boolean;
}

export function ModeToggle({ isManager }: ModeToggleProps) {
  const t = useTranslations("Header");
  const { mode, toggleMode } = useInteractionMode();

  if (!isManager) {
    return null;
  }

  const isWallMode = mode === "wall";
  const Icon = isWallMode ? MonitorSmartphone : Monitor;
  const label = isWallMode ? t("switchToManage") : t("switchToWall");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMode}
          aria-label={label}
        >
          <Icon className="size-5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
```

**Step 2: Add translations**

Add to `messages/en.json` under `Header`:

```json
"switchToManage": "Switch to manage mode",
"switchToWall": "Switch to wall display mode"
```

Add to `messages/nl.json` under `Header`:

```json
"switchToManage": "Schakel naar beheermodus",
"switchToWall": "Schakel naar wandweergave"
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/layout/mode-toggle.tsx messages/en.json messages/nl.json
git commit -m "feat: add ModeToggle component for managers"
```

---

## Task 3: Create AppShell component

**Files:**

- Create: `src/components/layout/app-shell.tsx`

**Step 1: Create the AppShell**

```tsx
"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { AppHeader } from "./app-header";
import { NavigationMenu } from "./navigation-menu";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "family-planner:sidebar-expanded";

interface AppShellProps {
  children: ReactNode;
  isManager: boolean;
  onAddEvent?: () => void;
}

export function AppShell({ children, isManager, onAddEvent }: AppShellProps) {
  const { mode } = useInteractionMode();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  // Auto-collapse sidebar in wall mode, restore preference in manage mode
  useEffect(() => {
    if (mode === "wall") {
      setSidebarExpanded(false);
    } else {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      setSidebarExpanded(stored !== "false");
    }
  }, [mode]);

  const handleSidebarToggle = () => {
    const newValue = !sidebarExpanded;
    setSidebarExpanded(newValue);
    if (mode === "manage") {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(newValue));
    }
  };

  return (
    <div className="bg-background flex min-h-screen flex-col">
      <AppHeader
        onAddEvent={onAddEvent}
        isManager={isManager}
        onMenuToggle={() => setMenuOpen(true)}
      />
      <div className="flex flex-1">
        <main
          className={cn(
            "flex-1 transition-all duration-200",
            sidebarExpanded && mode === "manage" ? "lg:ml-64" : ""
          )}
        >
          {children}
        </main>
      </div>
      <NavigationMenu open={menuOpen} onOpenChange={setMenuOpen} />
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/layout/app-shell.tsx
git commit -m "feat: add AppShell component with sidebar support"
```

---

## Task 4: Update AppHeader to accept isManager prop

**Files:**

- Modify: `src/components/layout/app-header.tsx`

**Step 1: Update the component**

Replace the file contents:

```tsx
"use client";

import { Menu, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/lib/auth-client";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { Button } from "@/components/ui/button";
import { BrandArea } from "./brand-area";
import { ModeToggle } from "./mode-toggle";
import { UserMenu } from "@/components/auth/user-menu";

interface AppHeaderProps {
  onAddEvent?: () => void;
  isManager?: boolean;
  onMenuToggle?: () => void;
}

export function AppHeader({
  onAddEvent,
  isManager = false,
  onMenuToggle,
}: AppHeaderProps) {
  const t = useTranslations("Header");
  const { mode } = useInteractionMode();
  const { data: session } = useSession();

  const user = session?.user;
  const isManageMode = mode === "manage";

  return (
    <header className="bg-background flex h-16 items-center justify-between border-b px-4">
      {/* Left: Menu trigger + Brand */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </Button>
        <BrandArea />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Mode Toggle (managers only) */}
        <ModeToggle isManager={isManager} />

        {isManageMode && (
          <>
            {/* Add Event Button */}
            {onAddEvent && (
              <>
                <Button onClick={onAddEvent} className="hidden sm:flex">
                  <Plus className="size-4" />
                  {t("addEvent")}
                </Button>
                <Button
                  onClick={onAddEvent}
                  size="icon"
                  className="sm:hidden"
                  aria-label={t("addEvent")}
                >
                  <Plus className="size-5" />
                </Button>
              </>
            )}

            {/* User Menu */}
            {user && (
              <div data-testid="user-avatar">
                <UserMenu
                  user={{
                    name: user.name || "User",
                    email: user.email || "",
                    image: user.image,
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </header>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/layout/app-header.tsx
git commit -m "refactor: update AppHeader to support isManager prop and ModeToggle"
```

---

## Task 5: Create (auth) route group with layout

**Files:**

- Create: `src/app/[locale]/(auth)/layout.tsx`

**Step 1: Create the auth layout**

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/get-session";

interface AuthLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AuthLayout({
  children,
  params,
}: AuthLayoutProps) {
  const { locale } = await params;
  const session = await getSession();

  // Not authenticated - redirect to login
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  return <>{children}</>;
}
```

**Step 2: Move onboarding directory**

Move the entire `src/app/[locale]/onboarding/` directory to `src/app/[locale]/(auth)/onboarding/`.

Commands:

```bash
mkdir -p src/app/\[locale\]/\(auth\)
mv src/app/\[locale\]/onboarding src/app/\[locale\]/\(auth\)/
```

**Step 3: Update onboarding pages to remove redundant auth checks**

The auth check is now in `(auth)/layout.tsx`, so individual onboarding pages no longer need to check for session. Review and remove redundant `getSession()` calls that redirect to login (keep family checks).

**Step 4: Verify the app still works**

Run: `pnpm dev`
Navigate to `/onboarding` without being logged in - should redirect to `/login`.

**Step 5: Commit**

```bash
git add src/app/\[locale\]/\(auth\)/
git commit -m "feat: create (auth) route group and move onboarding"
```

---

## Task 6: Create (app) route group with layout

**Files:**

- Create: `src/app/[locale]/(app)/layout.tsx`

**Step 1: Create the app layout with AppShell**

```tsx
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/get-session";
import { getUserFamily } from "@/server/services/family-service";
import { InteractionModeProvider } from "@/contexts/interaction-mode-context";
import { AppShell } from "@/components/layout/app-shell";
import type { Locale } from "@/i18n/routing";

interface AppLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AppLayout({ children, params }: AppLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const session = await getSession();

  // Not authenticated - redirect to login
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  // No family - redirect to onboarding
  if (!session.session.familyId) {
    redirect(`/${locale}/onboarding`);
  }

  // Get user's role in the family
  const family = await getUserFamily(session.user.id);
  const isManager = family?.currentUserRole === "manager";

  return (
    <InteractionModeProvider>
      <AppShell isManager={isManager}>{children}</AppShell>
    </InteractionModeProvider>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\[locale\]/\(app\)/layout.tsx
git commit -m "feat: create (app) route group with auth + family check + AppShell"
```

---

## Task 7: Move dashboard to (app)

**Files:**

- Move: `src/app/[locale]/dashboard/` → `src/app/[locale]/(app)/dashboard/`
- Modify: `src/app/[locale]/(app)/dashboard/page.tsx`

**Step 1: Move the dashboard directory**

```bash
mv src/app/\[locale\]/dashboard src/app/\[locale\]/\(app\)/
```

**Step 2: Simplify dashboard page (remove standalone wrapping)**

Update `src/app/[locale]/(app)/dashboard/page.tsx`:

```tsx
import { setRequestLocale } from "next-intl/server";
import { Dashboard } from "@/components/dashboard/dashboard";
import type { Locale } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  return <Dashboard />;
}
```

**Step 3: Verify the app still works**

Run: `pnpm dev`
Navigate to `/dashboard` - should show dashboard with AppShell.

**Step 4: Commit**

```bash
git add src/app/\[locale\]/\(app\)/dashboard/
git commit -m "refactor: move dashboard to (app) route group"
```

---

## Task 8: Move and merge calendar to (app)

**Files:**

- Create: `src/app/[locale]/(app)/calendar/page.tsx`
- Create: `src/app/[locale]/(app)/calendar/calendar-page-client.tsx`

**Step 1: Create calendar page**

Create `src/app/[locale]/(app)/calendar/page.tsx`:

```tsx
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { getEvents, getUsers } from "@/components/calendar/requests";
import { CalendarPageClient } from "./calendar-page-client";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CalendarPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const [events, users] = await Promise.all([getEvents(), getUsers()]);

  return <CalendarPageClient events={events} users={users} />;
}
```

**Step 2: Create calendar client component**

Create `src/app/[locale]/(app)/calendar/calendar-page-client.tsx`:

```tsx
"use client";

import { useRef } from "react";
import { Calendar } from "@/components/calendar/calendar";
import type { IEvent, IUser } from "@/components/calendar/interfaces";

interface CalendarPageClientProps {
  events: IEvent[];
  users: IUser[];
}

export function CalendarPageClient({ events, users }: CalendarPageClientProps) {
  const addEventButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <Calendar
      events={events}
      users={users}
      addEventButtonRef={addEventButtonRef}
    />
  );
}
```

Note: The AppShell from the layout already provides the header. The Calendar component receives addEventButtonRef but the header's Add Event button needs to be wired up differently now.

**Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/\[locale\]/\(app\)/calendar/
git commit -m "feat: add calendar route under (app) group"
```

---

## Task 9: Move settings to (app)

**Files:**

- Move: `src/app/[locale]/(family-required)/settings/` → `src/app/[locale]/(app)/settings/`

**Step 1: Move the settings directory**

```bash
mv src/app/\[locale\]/\(family-required\)/settings src/app/\[locale\]/\(app\)/
```

**Step 2: Update settings layout if needed**

Review `src/app/[locale]/(app)/settings/layout.tsx` - it only sets locale, which is fine.

**Step 3: Verify the app still works**

Run: `pnpm dev`
Navigate to `/settings/accounts` and `/settings/family` - both should work with AppShell.

**Step 4: Commit**

```bash
git add src/app/\[locale\]/\(app\)/settings/
git commit -m "refactor: move settings to (app) route group"
```

---

## Task 10: Delete old route groups

**Files:**

- Delete: `src/app/[locale]/(family-required)/` (entire directory)
- Delete: `src/app/[locale]/wall/` (empty directory)

**Step 1: Remove old directories**

```bash
rm -rf src/app/\[locale\]/\(family-required\)
rm -rf src/app/\[locale\]/wall
```

**Step 2: Verify no broken imports**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Verify the app still works**

Run: `pnpm dev`
Test all routes: `/`, `/login`, `/dashboard`, `/calendar`, `/settings/accounts`, `/settings/family`

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove old (family-required) and wall route groups"
```

---

## Task 11: Wire up Add Event button in AppShell

**Files:**

- Modify: `src/app/[locale]/(app)/layout.tsx`
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `src/app/[locale]/(app)/calendar/calendar-page-client.tsx`

The Add Event button in the header needs to trigger the calendar's add event dialog. This requires either:

1. A global event bus / context
2. Lifting state up through layout

**Step 1: Create AddEventContext**

Create `src/contexts/add-event-context.tsx`:

```tsx
"use client";

import { createContext, useContext, useRef, type RefObject } from "react";

interface AddEventContextValue {
  addEventButtonRef: RefObject<HTMLButtonElement | null>;
}

const AddEventContext = createContext<AddEventContextValue | null>(null);

export function AddEventProvider({ children }: { children: React.ReactNode }) {
  const addEventButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <AddEventContext.Provider value={{ addEventButtonRef }}>
      {children}
    </AddEventContext.Provider>
  );
}

export function useAddEvent() {
  const context = useContext(AddEventContext);
  if (!context) {
    throw new Error("useAddEvent must be used within AddEventProvider");
  }
  return context;
}

export function useAddEventSafe() {
  return useContext(AddEventContext);
}
```

**Step 2: Update (app) layout to include AddEventProvider**

Update `src/app/[locale]/(app)/layout.tsx` to wrap with `AddEventProvider`:

```tsx
import { AddEventProvider } from "@/contexts/add-event-context";

// ... inside the return:
return (
  <InteractionModeProvider>
    <AddEventProvider>
      <AppShell isManager={isManager}>{children}</AppShell>
    </AddEventProvider>
  </InteractionModeProvider>
);
```

**Step 3: Update AppShell to use AddEvent context**

Update `src/components/layout/app-shell.tsx`:

```tsx
import { useAddEventSafe } from "@/contexts/add-event-context";

// Inside AppShell:
const addEventContext = useAddEventSafe();

const handleAddEvent = () => {
  addEventContext?.addEventButtonRef.current?.click();
};

// Pass to AppHeader:
<AppHeader
  onAddEvent={handleAddEvent}
  isManager={isManager}
  onMenuToggle={() => setMenuOpen(true)}
/>;
```

**Step 4: Update calendar client to use AddEvent context**

Update `src/app/[locale]/(app)/calendar/calendar-page-client.tsx`:

```tsx
"use client";

import { useAddEvent } from "@/contexts/add-event-context";
import { Calendar } from "@/components/calendar/calendar";
import type { IEvent, IUser } from "@/components/calendar/interfaces";

interface CalendarPageClientProps {
  events: IEvent[];
  users: IUser[];
}

export function CalendarPageClient({ events, users }: CalendarPageClientProps) {
  const { addEventButtonRef } = useAddEvent();

  return (
    <Calendar
      events={events}
      users={users}
      addEventButtonRef={addEventButtonRef}
    />
  );
}
```

**Step 5: Verify Add Event works**

Run: `pnpm dev`
Navigate to `/calendar`, click "Add Event" in header - dialog should open.

**Step 6: Commit**

```bash
git add src/contexts/add-event-context.tsx src/app/\[locale\]/\(app\)/layout.tsx src/components/layout/app-shell.tsx src/app/\[locale\]/\(app\)/calendar/calendar-page-client.tsx
git commit -m "feat: wire up Add Event button through context"
```

---

## Task 12: Update any hardcoded /wall/calendar references

**Files:**

- Search and update any remaining references

**Step 1: Search for wall/calendar references**

Run: `grep -r "wall/calendar" src/`

**Step 2: Update any found references**

Replace `/wall/calendar` with `/calendar` (mode is now localStorage-based).

**Step 3: Verify no remaining references**

Run: `grep -r "wall/calendar" src/`
Expected: No matches

**Step 4: Commit if changes were made**

```bash
git add -A
git commit -m "chore: remove /wall/calendar route references"
```

---

## Task 13: Add E2E tests for new functionality

**Files:**

- Create: `e2e/tests/layout/mode-toggle.spec.ts`
- Create: `e2e/tests/layout/app-shell.spec.ts`

**Step 1: Create mode toggle E2E test**

Create `e2e/tests/layout/mode-toggle.spec.ts`:

```ts
import { test, expect } from "../../fixtures/family-fixture";

test.describe("Mode Toggle", () => {
  test.describe("as manager", () => {
    test("should show mode toggle button", async ({ familyPage }) => {
      await familyPage.goto("/dashboard");
      await expect(familyPage.getByLabel(/switch to/i)).toBeVisible();
    });

    test("should toggle between manage and wall mode", async ({
      familyPage,
    }) => {
      await familyPage.goto("/dashboard");

      // Start in manage mode - user menu should be visible
      await expect(familyPage.getByTestId("user-avatar")).toBeVisible();

      // Toggle to wall mode
      await familyPage.getByLabel(/switch to wall/i).click();

      // In wall mode - user menu should be hidden
      await expect(familyPage.getByTestId("user-avatar")).not.toBeVisible();

      // Toggle back to manage mode
      await familyPage.getByLabel(/switch to manage/i).click();

      // User menu should be visible again
      await expect(familyPage.getByTestId("user-avatar")).toBeVisible();
    });

    test("should persist mode across page refresh", async ({ familyPage }) => {
      await familyPage.goto("/dashboard");

      // Toggle to wall mode
      await familyPage.getByLabel(/switch to wall/i).click();
      await expect(familyPage.getByTestId("user-avatar")).not.toBeVisible();

      // Refresh page
      await familyPage.reload();

      // Should still be in wall mode
      await expect(familyPage.getByTestId("user-avatar")).not.toBeVisible();
    });
  });

  test.describe("as participant", () => {
    // Note: Need to add participant fixture or modify family fixture
    test.skip("should not show mode toggle button", async () => {
      // TODO: Implement when participant fixture is available
    });
  });
});
```

**Step 2: Create app shell E2E test**

Create `e2e/tests/layout/app-shell.spec.ts`:

```ts
import { test, expect } from "../../fixtures/family-fixture";

test.describe("App Shell", () => {
  test("should show header on all app routes", async ({ familyPage }) => {
    const routes = ["/dashboard", "/calendar", "/settings/accounts"];

    for (const route of routes) {
      await familyPage.goto(route);
      await expect(familyPage.locator("header")).toBeVisible();
    }
  });

  test("should open navigation menu when clicking menu button", async ({
    familyPage,
  }) => {
    await familyPage.goto("/dashboard");

    await familyPage.getByLabel("Open menu").click();

    // Navigation sheet should be visible
    await expect(familyPage.getByRole("navigation")).toBeVisible();
    await expect(
      familyPage.getByRole("link", { name: /dashboard/i })
    ).toBeVisible();
    await expect(
      familyPage.getByRole("link", { name: /calendar/i })
    ).toBeVisible();
  });

  test("should navigate between routes via menu", async ({ familyPage }) => {
    await familyPage.goto("/dashboard");

    // Open menu and click calendar
    await familyPage.getByLabel("Open menu").click();
    await familyPage.getByRole("link", { name: /calendar/i }).click();

    await expect(familyPage).toHaveURL(/\/calendar/);
  });
});
```

**Step 3: Verify tests pass**

Run: `pnpm e2e e2e/tests/layout/`
Expected: All new tests pass

**Step 4: Commit**

```bash
git add e2e/tests/layout/
git commit -m "test(e2e): add tests for mode toggle and app shell"
```

---

## Task 14: Run full test suite

**Step 1: Run unit tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 2: Run E2E tests**

Run: `pnpm e2e`
Expected: All tests pass

Note: The existing E2E tests should pass without modification since URLs (`/calendar`, `/dashboard`, `/onboarding`) remain unchanged - only the internal route group structure changes.

**Step 3: Fix any failing tests**

If tests fail, investigate and fix. Likely issues:

- Tests expecting specific DOM structure that changed with AppShell
- Tests interacting with header elements that moved

**Step 4: Commit test fixes**

```bash
git add -A
git commit -m "test: fix tests for new route structure"
```

---

## Task 15: Final verification

**Step 1: Manual testing checklist**

- [ ] `/` - Home page loads (public)
- [ ] `/login` - Login page loads (public)
- [ ] `/onboarding` - Redirects to login if not authenticated
- [ ] `/onboarding` - Shows create family if authenticated without family
- [ ] `/dashboard` - Redirects to login if not authenticated
- [ ] `/dashboard` - Redirects to onboarding if no family
- [ ] `/dashboard` - Shows dashboard with AppShell if authenticated with family
- [ ] `/calendar` - Shows calendar with AppShell
- [ ] `/settings/accounts` - Shows accounts settings
- [ ] `/settings/family` - Shows family settings
- [ ] Mode toggle visible only for managers
- [ ] Mode toggle switches between manage/wall mode
- [ ] Mode persists across page refreshes (localStorage)
- [ ] Sidebar collapses in wall mode
- [ ] Add Event button works on calendar page

**Step 2: Build verification**

Run: `pnpm build`
Expected: Build completes without errors

**Step 3: Final commit**

```bash
git add -A
git commit -m "docs: complete route restructure implementation"
```

---

## Summary of New Structure

```
src/app/[locale]/
├── layout.tsx              # Root (i18n, theme, providers)
├── page.tsx                # Public: home
├── login/                  # Public
├── join/[token]/           # Public
│
├── (auth)/                 # Auth required, no family needed
│   ├── layout.tsx          # Session check → redirect to /login
│   └── onboarding/
│       ├── layout.tsx      # Centered card layout
│       ├── page.tsx
│       ├── create/
│       ├── invite/
│       └── complete/
│
├── (app)/                  # Auth + family required
│   ├── layout.tsx          # Session + family check + AppShell
│   ├── dashboard/
│   ├── calendar/
│   └── settings/
│       ├── accounts/
│       └── family/
```
