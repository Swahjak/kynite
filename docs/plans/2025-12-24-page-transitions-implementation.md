# Page Transitions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add visual feedback for page navigation via progress bar + skeleton screens

**Architecture:** NavigationProgressProvider context tracks route changes, NavigationProgress component renders animated bar, loading.tsx files provide skeleton fallbacks

**Tech Stack:** React 19, Next.js 16 App Router, Framer Motion, Tailwind CSS

---

## Phase 1: Progress Bar Foundation (Parallel Tasks)

These tasks are independent and can be executed in parallel.

### Task 1A: NavigationProgress Component

**Files:**

- Create: `src/components/ui/navigation-progress.tsx`

**Step 1: Create the progress bar component**

```tsx
"use client";

import { motion } from "framer-motion";

interface NavigationProgressProps {
  isLoading: boolean;
  progress: number;
}

export function NavigationProgress({
  isLoading,
  progress,
}: NavigationProgressProps) {
  if (!isLoading) return null;

  return (
    <motion.div
      className="fixed top-0 right-0 left-0 z-[100] h-[3px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="bg-primary h-full shadow-[0_0_10px_var(--primary)]"
        initial={{ width: "0%" }}
        animate={{ width: `${progress}%` }}
        transition={{
          duration: 0.3,
          ease: "easeOut",
        }}
      />
    </motion.div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ui/navigation-progress.tsx
git commit -m "feat: add NavigationProgress component"
```

---

### Task 1B: NavigationProgressProvider Context

**Files:**

- Create: `src/components/providers/navigation-progress-provider.tsx`

**Step 1: Create the provider with route change detection**

```tsx
"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence } from "framer-motion";
import { NavigationProgress } from "@/components/ui/navigation-progress";

interface NavigationProgressContextValue {
  startProgress: () => void;
  completeProgress: () => void;
}

const NavigationProgressContext =
  createContext<NavigationProgressContextValue | null>(null);

export function useNavigationProgress() {
  const context = useContext(NavigationProgressContext);
  if (!context) {
    throw new Error(
      "useNavigationProgress must be used within NavigationProgressProvider"
    );
  }
  return context;
}

interface NavigationProgressProviderProps {
  children: ReactNode;
}

export function NavigationProgressProvider({
  children,
}: NavigationProgressProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const completeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const clearTimers = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    if (completeTimeoutRef.current) {
      clearTimeout(completeTimeoutRef.current);
      completeTimeoutRef.current = null;
    }
  }, []);

  const startProgress = useCallback(() => {
    clearTimers();
    startTimeRef.current = Date.now();
    setIsLoading(true);
    setProgress(0);

    // Animate progress gradually
    let currentProgress = 0;
    progressIntervalRef.current = setInterval(() => {
      currentProgress += Math.random() * 10;
      if (currentProgress > 80) {
        currentProgress = 80 + Math.random() * 5;
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
        }
      }
      setProgress(Math.min(currentProgress, 90));
    }, 200);
  }, [clearTimers]);

  const completeProgress = useCallback(() => {
    clearTimers();

    // Check if navigation was fast (< 100ms) - don't show bar for fast navigations
    const elapsed = Date.now() - startTimeRef.current;
    if (elapsed < 100) {
      setIsLoading(false);
      setProgress(0);
      return;
    }

    setProgress(100);
    completeTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setProgress(0);
    }, 200);
  }, [clearTimers]);

  // Track route changes
  useEffect(() => {
    completeProgress();
  }, [pathname, searchParams, completeProgress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  return (
    <NavigationProgressContext.Provider
      value={{ startProgress, completeProgress }}
    >
      <AnimatePresence>
        {isLoading && (
          <NavigationProgress isLoading={isLoading} progress={progress} />
        )}
      </AnimatePresence>
      {children}
    </NavigationProgressContext.Provider>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/providers/navigation-progress-provider.tsx
git commit -m "feat: add NavigationProgressProvider context"
```

---

## Phase 2: Link Integration

### Task 2: Create ProgressLink Component

**Files:**

- Create: `src/components/ui/progress-link.tsx`

**Step 1: Create Link wrapper that triggers progress**

```tsx
"use client";

import { Link } from "@/i18n/navigation";
import { useNavigationProgress } from "@/components/providers/navigation-progress-provider";
import { usePathname } from "next/navigation";
import { type ComponentProps, useCallback } from "react";

type ProgressLinkProps = ComponentProps<typeof Link>;

export function ProgressLink({
  href,
  onClick,
  children,
  ...props
}: ProgressLinkProps) {
  const { startProgress } = useNavigationProgress();
  const pathname = usePathname();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Don't trigger progress for same-page or hash links
      const hrefString = typeof href === "string" ? href : href.pathname || "";
      if (hrefString === pathname || hrefString.startsWith("#")) {
        onClick?.(e);
        return;
      }

      startProgress();
      onClick?.(e);
    },
    [href, pathname, startProgress, onClick]
  );

  return (
    <Link href={href} onClick={handleClick} {...props}>
      {children}
    </Link>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ui/progress-link.tsx
git commit -m "feat: add ProgressLink component with progress trigger"
```

---

## Phase 3: Provider Integration

### Task 3: Integrate Provider in App Layout

**Files:**

- Modify: `src/app/[locale]/(app)/layout.tsx`

**Step 1: Wrap children with NavigationProgressProvider**

Find the AppShell wrapper and add the provider. The exact changes depend on current layout structure, but conceptually:

```tsx
import { NavigationProgressProvider } from "@/components/providers/navigation-progress-provider";

// In the layout return, wrap AppShell or its children:
<NavigationProgressProvider>
  <AppShell>{children}</AppShell>
</NavigationProgressProvider>;
```

**Step 2: Commit**

```bash
git add src/app/[locale]/(app)/layout.tsx
git commit -m "feat: integrate NavigationProgressProvider in app layout"
```

---

## Phase 4: Skeleton Screens (Parallel Tasks)

These tasks are independent and can be executed in parallel.

### Task 4A: Generic App Loading Skeleton

**Files:**

- Create: `src/app/[locale]/(app)/loading.tsx`

**Step 1: Create generic loading skeleton**

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page title skeleton */}
      <Skeleton className="h-8 w-48" />

      {/* Content blocks */}
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-24 w-3/4 rounded-lg" />
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/[locale]/(app)/loading.tsx
git commit -m "feat: add generic app loading skeleton"
```

---

### Task 4B: Calendar Loading Skeleton

**Files:**

- Create: `src/app/[locale]/(app)/calendar/loading.tsx`

**Step 1: Create calendar-specific loading skeleton using existing components**

```tsx
import { CalendarSkeleton } from "@/components/calendar/skeletons/calendar-skeleton";

export default function CalendarLoading() {
  return <CalendarSkeleton />;
}
```

**Step 2: Commit**

```bash
git add src/app/[locale]/(app)/calendar/loading.tsx
git commit -m "feat: add calendar-specific loading skeleton"
```

---

## Phase 5: Navigation Menu Update

### Task 5: Update Navigation Menu to Use ProgressLink

**Files:**

- Modify: `src/components/layout/navigation-menu.tsx`

**Step 1: Replace Link imports with ProgressLink**

Change:

```tsx
import { Link } from "@/i18n/navigation";
```

To:

```tsx
import { ProgressLink } from "@/components/ui/progress-link";
```

Then replace all `<Link>` usages with `<ProgressLink>`.

**Step 2: Commit**

```bash
git add src/components/layout/navigation-menu.tsx
git commit -m "feat: update navigation menu to use ProgressLink"
```

---

## Phase 6: Verification

### Task 6: Manual Testing Verification

**Step 1: Start dev server**

```bash
pnpm dev
```

**Step 2: Test navigation paths**

- Navigate Dashboard -> Calendar (should see progress bar + calendar skeleton)
- Navigate Calendar -> Settings (should see progress bar + generic skeleton)
- Navigate Settings -> Chores (should see progress bar + generic skeleton)
- Use browser back/forward buttons (should trigger progress bar)
- Navigate to same page (should NOT trigger progress bar)

**Step 3: Run unit tests**

```bash
pnpm test:run
```

Expected: All existing tests pass (no regressions)

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address any issues found during testing"
```

---

## Execution Summary

| Phase | Tasks  | Parallel? |
| ----- | ------ | --------- |
| 1     | 1A, 1B | Yes       |
| 2     | 2      | No        |
| 3     | 3      | No        |
| 4     | 4A, 4B | Yes       |
| 5     | 5      | No        |
| 6     | 6      | No        |

**Parallel execution points:**

- Phase 1: Tasks 1A + 1B can run in parallel
- Phase 4: Tasks 4A + 4B can run in parallel
