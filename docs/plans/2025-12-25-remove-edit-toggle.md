# Remove Edit Toggle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the wall/manage mode toggle from the header; managers always see edit options, devices never do.

**Architecture:** Replace the InteractionModeContext with two simple boolean hooks (`useIsManager`, `useIsDevice`). Components use `useIsManager()` for edit visibility instead of checking mode state.

**Tech Stack:** React 19, Next.js 16, TypeScript, better-auth

---

## Task 1: Create Permission Hooks

**Files:**

- Create: `src/hooks/use-is-manager.ts`
- Create: `src/hooks/use-is-device.ts`

**Step 1: Create useIsManager hook**

```typescript
// src/hooks/use-is-manager.ts
"use client";

import { useSession } from "@/lib/auth-client";

interface SessionData {
  isDevice?: boolean;
  memberRole?: string | null;
}

/**
 * Returns true if the current user is a manager (parent).
 * Devices always return false.
 */
export function useIsManager(): boolean {
  const { data: session } = useSession();
  if (!session) return false;

  const sessionData = session.session as SessionData;
  return !sessionData.isDevice && sessionData.memberRole === "manager";
}
```

**Step 2: Create useIsDevice hook**

```typescript
// src/hooks/use-is-device.ts
"use client";

import { useSession } from "@/lib/auth-client";

interface SessionData {
  isDevice?: boolean;
}

/**
 * Returns true if the current session is a device (wall display).
 */
export function useIsDevice(): boolean {
  const { data: session } = useSession();
  if (!session) return false;

  return (session.session as SessionData).isDevice === true;
}
```

**Step 3: Commit**

```bash
git add src/hooks/use-is-manager.ts src/hooks/use-is-device.ts
git commit -m "feat: add useIsManager and useIsDevice permission hooks"
```

---

## Task 2: Update App Layout

**Files:**

- Modify: `src/app/[locale]/(app)/layout.tsx`

**Step 1: Remove isManager calculation and InteractionModeProvider**

```typescript
// src/app/[locale]/(app)/layout.tsx
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSession } from "@/lib/get-session";
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

  // Middleware handles auth redirect, but keep as fallback
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }

  // No family - redirect to onboarding
  if (!session.session.familyId) {
    redirect(`/${locale}/onboarding`);
  }

  return <AppShell>{children}</AppShell>;
}
```

**Step 2: Verify it compiles**

```bash
pnpm tsc --noEmit
```

**Step 3: Commit**

```bash
git add src/app/[locale]/(app)/layout.tsx
git commit -m "refactor: remove InteractionModeProvider and isManager from layout"
```

---

## Task 3: Update AppShell

**Files:**

- Modify: `src/components/layout/app-shell.tsx`

**Step 1: Remove isManager prop**

```typescript
// src/components/layout/app-shell.tsx
"use client";

import { useState, type ReactNode } from "react";
import { NavigationProgressProvider } from "@/components/providers/navigation-progress-provider";
import { AppHeader } from "./app-header";
import { NavigationMenu } from "./navigation-menu";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <NavigationProgressProvider>
      <div className="bg-background flex min-h-screen flex-col">
        <AppHeader onMenuToggle={() => setMenuOpen(true)} />
        <div className="flex min-h-0 flex-1">
          <main className="flex-1 overflow-hidden">{children}</main>
        </div>
        <NavigationMenu open={menuOpen} onOpenChange={setMenuOpen} />
      </div>
    </NavigationProgressProvider>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/layout/app-shell.tsx
git commit -m "refactor: remove isManager prop from AppShell"
```

---

## Task 4: Update AppHeader

**Files:**

- Modify: `src/components/layout/app-header.tsx`

**Step 1: Replace mode toggle with useIsManager**

```typescript
// src/components/layout/app-header.tsx
"use client";

import { Menu } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { useIsManager } from "@/hooks/use-is-manager";
import { Button } from "@/components/ui/button";
import { BrandArea } from "./brand-area";
import { CurrentTime } from "./current-time";
import { UserMenu } from "@/components/auth/user-menu";

interface AppHeaderProps {
  onMenuToggle?: () => void;
}

export function AppHeader({ onMenuToggle }: AppHeaderProps) {
  const isManager = useIsManager();
  const { data: session } = useSession();

  const user = session?.user;

  return (
    <header className="bg-background flex h-16 items-center justify-between border-b px-4">
      {/* Left: Menu trigger + Brand */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
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

      {/* Center: Current Time (hidden on mobile) */}
      <div className="hidden flex-1 justify-center sm:flex">
        <CurrentTime />
      </div>

      {/* Right: User Menu (managers only) */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
        {isManager && user && (
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
      </div>
    </header>
  );
}
```

**Step 2: Run tests**

```bash
pnpm test:run
```

**Step 3: Commit**

```bash
git add src/components/layout/app-header.tsx
git commit -m "refactor: replace mode toggle with useIsManager in header"
```

---

## Task 5: Update NavigationMenu

**Files:**

- Modify: `src/components/layout/navigation-menu.tsx`

**Step 1: Replace mode check with useIsManager**

Find and replace:

- `import { useInteractionMode } from "@/contexts/interaction-mode-context";`
- `const { mode } = useInteractionMode();`
- `mode === "manage"` → `isManager`

With:

- `import { useIsManager } from "@/hooks/use-is-manager";`
- `const isManager = useIsManager();`

**Step 2: Run tests**

```bash
pnpm test:run
```

**Step 3: Commit**

```bash
git add src/components/layout/navigation-menu.tsx
git commit -m "refactor: use useIsManager in NavigationMenu"
```

---

## Task 6: Update Calendar Components

**Files:**

- Modify: `src/components/calendar/header/calendar-header.tsx`
- Modify: `src/app/[locale]/(app)/calendar/calendar-layout-client.tsx`

**Step 1: Update calendar-header.tsx**

Replace:

- `import { useInteractionMode } from "@/contexts/interaction-mode-context";`
- `const { mode } = useInteractionMode();`
- `const isManageMode = mode === "manage";`

With:

- `import { useIsManager } from "@/hooks/use-is-manager";`
- `const isManager = useIsManager();`
- Replace all `isManageMode` with `isManager`

**Step 2: Update calendar-layout-client.tsx**

Same pattern as Step 1.

**Step 3: Run tests**

```bash
pnpm test:run
```

**Step 4: Commit**

```bash
git add src/components/calendar/header/calendar-header.tsx src/app/[locale]/(app)/calendar/calendar-layout-client.tsx
git commit -m "refactor: use useIsManager in calendar components"
```

---

## Task 7: Update Reward Store Components

**Files:**

- Modify: `src/components/reward-store/reward-store-page.tsx`
- Modify: `src/components/reward-store/reward-card.tsx`

**Step 1: Update reward-store-page.tsx**

Replace:

- `import { useInteractionMode } from "@/contexts/interaction-mode-context";`
- `const { mode } = useInteractionMode();`
- `const isManageMode = mode === "manage";`

With:

- `import { useIsManager } from "@/hooks/use-is-manager";`
- `const isManager = useIsManager();`
- Replace all `isManageMode` with `isManager`

**Step 2: Update reward-card.tsx**

Same pattern.

**Step 3: Run tests**

```bash
pnpm test:run
```

**Step 4: Commit**

```bash
git add src/components/reward-store/reward-store-page.tsx src/components/reward-store/reward-card.tsx
git commit -m "refactor: use useIsManager in reward store components"
```

---

## Task 8: Update Reward Chart Components

**Files:**

- Modify: `src/components/reward-chart/reward-chart-page.tsx`
- Modify: `src/components/reward-chart/bottom-cards/next-reward-card.tsx`
- Modify: `src/components/reward-chart/bottom-cards/message-card.tsx`

**Step 1: Update each file**

Same pattern: replace `useInteractionMode` with `useIsManager`, replace `isManageMode` with `isManager`.

**Step 2: Run tests**

```bash
pnpm test:run
```

**Step 3: Commit**

```bash
git add src/components/reward-chart/reward-chart-page.tsx src/components/reward-chart/bottom-cards/next-reward-card.tsx src/components/reward-chart/bottom-cards/message-card.tsx
git commit -m "refactor: use useIsManager in reward chart components"
```

---

## Task 9: Update Dashboard and Chores Components

**Files:**

- Modify: `src/components/dashboard/active-timers/timer-card.tsx`
- Modify: `src/components/dashboard/quick-actions/action-button.tsx`
- Modify: `src/components/chores/chores.tsx`
- Modify: `src/components/chores/components/chore-card.tsx`

**Step 1: Update each file**

Same pattern as previous tasks.

**Step 2: Run tests**

```bash
pnpm test:run
```

**Step 3: Commit**

```bash
git add src/components/dashboard/active-timers/timer-card.tsx src/components/dashboard/quick-actions/action-button.tsx src/components/chores/chores.tsx src/components/chores/components/chore-card.tsx
git commit -m "refactor: use useIsManager in dashboard and chores components"
```

---

## Task 10: Update Test Files

**Files:**

- Modify: `src/components/layout/__tests__/app-header.test.tsx`
- Modify: `src/components/layout/__tests__/navigation-menu.test.tsx`

**Step 1: Update app-header.test.tsx**

- Remove InteractionModeProvider wrapper
- Mock `useIsManager` hook instead
- Update test cases to test manager vs non-manager behavior

**Step 2: Update navigation-menu.test.tsx**

Same pattern.

**Step 3: Run tests**

```bash
pnpm test:run
```

**Step 4: Commit**

```bash
git add src/components/layout/__tests__/app-header.test.tsx src/components/layout/__tests__/navigation-menu.test.tsx
git commit -m "test: update tests to use useIsManager mock"
```

---

## Task 11: Delete Unused Files

**Files:**

- Delete: `src/components/layout/mode-toggle.tsx`
- Delete: `src/contexts/interaction-mode-context.tsx`
- Delete: `src/contexts/__tests__/interaction-mode-context.test.tsx`
- Delete: `src/hooks/use-device-session.ts`
- Delete: `src/components/device/if-not-device.tsx`

**Step 1: Delete files**

```bash
rm src/components/layout/mode-toggle.tsx
rm src/contexts/interaction-mode-context.tsx
rm src/contexts/__tests__/interaction-mode-context.test.tsx
rm src/hooks/use-device-session.ts
rm src/components/device/if-not-device.tsx
```

**Step 2: Verify no remaining imports**

```bash
grep -r "useInteractionMode\|InteractionModeProvider\|useDeviceSession\|IfNotDevice\|ModeToggle" src/ --include="*.tsx" --include="*.ts"
```

Expected: No matches

**Step 3: Run tests**

```bash
pnpm test:run
```

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete unused mode toggle and device session files"
```

---

## Task 12: Clean Up Calendar Context

**Files:**

- Check: `src/components/calendar/contexts/interaction-mode-context.tsx`

**Step 1: Verify if calendar has its own copy**

The grep found this file. Check if it's a duplicate or separate implementation.

**Step 2: If duplicate, delete it**

```bash
rm src/components/calendar/contexts/interaction-mode-context.tsx
```

**Step 3: Commit if changed**

```bash
git add -A
git commit -m "chore: remove duplicate calendar interaction-mode-context"
```

---

## Task 13: Remove Translation Keys

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/nl.json`

**Step 1: Remove Header toggle translations from en.json**

Remove these keys from the "Header" section:

- `"switchToManage"`
- `"switchToWall"`
- `"manageMode"`

**Step 2: Remove same keys from nl.json**

**Step 3: Run lint**

```bash
pnpm lint
```

**Step 4: Commit**

```bash
git add messages/en.json messages/nl.json
git commit -m "chore: remove unused toggle translation keys"
```

---

## Task 14: Final Verification

**Step 1: Run full test suite**

```bash
pnpm test:run
```

**Step 2: Run TypeScript check**

```bash
pnpm tsc --noEmit
```

**Step 3: Run linter**

```bash
pnpm lint
```

**Step 4: Run build**

```bash
pnpm build
```

**Step 5: Manual verification (optional)**

- Start dev server: `pnpm dev`
- Login as manager → verify edit buttons visible
- Login as device → verify edit buttons hidden

---

## Summary

After completing all tasks:

- 2 new hooks created (`useIsManager`, `useIsDevice`)
- 5 files deleted
- ~15 files updated to use new hooks
- Translation keys cleaned up
- All tests passing
