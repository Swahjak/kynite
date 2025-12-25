# Confetti Celebrations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Magic UI confetti animations when kids complete tasks, with intensity scaling based on star rewards.

**Architecture:** Create a `ConfettiProvider` context with a `useConfetti` hook that exposes a `fire(starReward)` function. The provider handles animation style randomization and intensity scaling. Each completion trigger point imports the hook and calls `fire()` after successful completion.

**Tech Stack:** Magic UI confetti (canvas-confetti), React Context, TypeScript

---

## Architecture Overview

```
ConfettiProvider (in layout.tsx)
    └── useConfetti() hook
            └── fire(starReward: number)
                    ├── getIntensityFromStars(stars) → 'small' | 'medium' | 'large'
                    ├── getRandomStyle() → 'cannon' | 'fireworks' | 'stars' | ...
                    └── confetti(options) with multiplied particles
```

**Integration Points:**
| Component | File | Star Source |
|-----------|------|-------------|
| ChoreCard | `src/components/chores/components/chore-card.tsx:46-50` | `chore.starReward` |
| TaskCheckbox | `src/components/wall-hub/shared/task-checkbox.tsx:25` | `chore.starReward` |
| TaskCell | `src/components/reward-chart/weekly-grid/task-cell.tsx:27` | Pass from TaskRow |
| TimerCard | `src/components/dashboard/active-timers/timer-card.tsx:123,134` | `timer.starReward` |

---

### Task 1: Install Magic UI Confetti Component

**Files:**

- Create: `src/components/magicui/confetti.tsx` (auto-generated)

**Step 1: Run the shadcn add command**

Run: `pnpm dlx shadcn@latest add "https://magicui.design/r/confetti"`
Expected: Component added to `src/components/magicui/confetti.tsx`

**Step 2: Verify installation**

Run: `ls -la src/components/magicui/`
Expected: `confetti.tsx` exists

**Step 3: Commit**

```bash
git add src/components/magicui/
git commit -m "feat: add Magic UI confetti component"
```

---

### Task 2: Create Confetti Configuration

**Files:**

- Create: `src/components/confetti/confetti-config.ts`

**Step 1: Create the configuration file**

```typescript
import type { Options as ConfettiOptions } from "canvas-confetti";

// =============================================================================
// INTENSITY LEVELS
// =============================================================================

export type ConfettiIntensity = "small" | "medium" | "large";

export function getIntensityFromStars(stars: number): ConfettiIntensity {
  if (stars >= 5) return "large";
  if (stars >= 3) return "medium";
  return "small";
}

export const INTENSITY_MULTIPLIERS: Record<ConfettiIntensity, number> = {
  small: 0.5,
  medium: 1.0,
  large: 2.0,
};

// =============================================================================
// ANIMATION STYLES
// =============================================================================

export type ConfettiStyle =
  | "cannon"
  | "fireworks"
  | "stars"
  | "sideCannons"
  | "burst";

export const CONFETTI_STYLES: ConfettiStyle[] = [
  "cannon",
  "fireworks",
  "stars",
  "sideCannons",
  "burst",
];

export function getRandomStyle(): ConfettiStyle {
  return CONFETTI_STYLES[Math.floor(Math.random() * CONFETTI_STYLES.length)];
}

// =============================================================================
// ANIMATION PRESETS
// =============================================================================

export const CONFETTI_PRESETS: Record<ConfettiStyle, ConfettiOptions> = {
  cannon: {
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
  },
  fireworks: {
    particleCount: 50,
    spread: 360,
    ticks: 60,
    gravity: 0,
    origin: { x: 0.5, y: 0.5 },
  },
  stars: {
    particleCount: 50,
    shapes: ["star"],
    colors: ["#FFD700", "#FFA500", "#FF6347", "#FFE135"],
    spread: 90,
    origin: { y: 0.6 },
  },
  sideCannons: {
    particleCount: 50,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.6 },
  },
  burst: {
    particleCount: 150,
    spread: 180,
    startVelocity: 30,
    ticks: 100,
    origin: { y: 0.6 },
  },
};
```

**Step 2: Commit**

```bash
git add src/components/confetti/confetti-config.ts
git commit -m "feat(confetti): add configuration for styles and intensity scaling"
```

---

### Task 3: Create Confetti Provider

**Files:**

- Create: `src/components/confetti/confetti-provider.tsx`

**Step 1: Create the provider component**

```tsx
"use client";

import { createContext, useCallback, type ReactNode } from "react";
import confetti from "canvas-confetti";
import {
  getIntensityFromStars,
  getRandomStyle,
  CONFETTI_PRESETS,
  INTENSITY_MULTIPLIERS,
  type ConfettiIntensity,
  type ConfettiStyle,
} from "./confetti-config";

// =============================================================================
// CONTEXT
// =============================================================================

interface ConfettiContextValue {
  /** Fire confetti with intensity based on star reward */
  fire: (starReward?: number) => void;
  /** Fire confetti with explicit options */
  fireWithOptions: (options: {
    intensity?: ConfettiIntensity;
    style?: ConfettiStyle;
  }) => void;
}

export const ConfettiContext = createContext<ConfettiContextValue | null>(null);

// =============================================================================
// ANIMATION HELPERS
// =============================================================================

function fireFireworks(
  baseOptions: confetti.Options,
  multiplier: number
): void {
  const duration = 2000 * multiplier;
  const animationEnd = Date.now() + duration;

  const interval = setInterval(() => {
    if (Date.now() > animationEnd) {
      clearInterval(interval);
      return;
    }
    confetti({
      ...baseOptions,
      particleCount: Math.round((baseOptions.particleCount ?? 50) * 0.5),
      origin: {
        x: Math.random(),
        y: Math.random() * 0.4,
      },
    });
  }, 200);
}

function fireSideCannons(baseOptions: confetti.Options): void {
  // Left cannon
  confetti({ ...baseOptions, origin: { x: 0, y: 0.6 }, angle: 60 });
  // Right cannon
  confetti({ ...baseOptions, origin: { x: 1, y: 0.6 }, angle: 120 });
}

// =============================================================================
// PROVIDER
// =============================================================================

interface ConfettiProviderProps {
  children: ReactNode;
}

export function ConfettiProvider({ children }: ConfettiProviderProps) {
  const fire = useCallback((starReward: number = 1) => {
    const intensity = getIntensityFromStars(starReward);
    const style = getRandomStyle();
    const preset = CONFETTI_PRESETS[style];
    const multiplier = INTENSITY_MULTIPLIERS[intensity];

    const options: confetti.Options = {
      ...preset,
      particleCount: Math.round((preset.particleCount ?? 100) * multiplier),
    };

    // Handle special multi-burst styles
    if (style === "fireworks") {
      fireFireworks(options, multiplier);
    } else if (style === "sideCannons") {
      fireSideCannons(options);
    } else {
      confetti(options);
    }
  }, []);

  const fireWithOptions = useCallback(
    ({
      intensity = "medium",
      style,
    }: {
      intensity?: ConfettiIntensity;
      style?: ConfettiStyle;
    }) => {
      const selectedStyle = style ?? getRandomStyle();
      const preset = CONFETTI_PRESETS[selectedStyle];
      const multiplier = INTENSITY_MULTIPLIERS[intensity];

      const options: confetti.Options = {
        ...preset,
        particleCount: Math.round((preset.particleCount ?? 100) * multiplier),
      };

      if (selectedStyle === "fireworks") {
        fireFireworks(options, multiplier);
      } else if (selectedStyle === "sideCannons") {
        fireSideCannons(options);
      } else {
        confetti(options);
      }
    },
    []
  );

  return (
    <ConfettiContext.Provider value={{ fire, fireWithOptions }}>
      {children}
    </ConfettiContext.Provider>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/confetti/confetti-provider.tsx
git commit -m "feat(confetti): add ConfettiProvider with fire function"
```

---

### Task 4: Create useConfetti Hook

**Files:**

- Create: `src/components/confetti/use-confetti.ts`

**Step 1: Create the hook**

```typescript
"use client";

import { useContext } from "react";
import { ConfettiContext } from "./confetti-provider";

/**
 * Hook to trigger confetti celebrations.
 *
 * @example
 * const { fire } = useConfetti();
 * fire(3); // Medium intensity (3 stars)
 */
export function useConfetti() {
  const context = useContext(ConfettiContext);

  if (!context) {
    // Graceful degradation for SSR or when used outside provider
    return {
      fire: () => {},
      fireWithOptions: () => {},
    };
  }

  return context;
}
```

**Step 2: Commit**

```bash
git add src/components/confetti/use-confetti.ts
git commit -m "feat(confetti): add useConfetti hook"
```

---

### Task 5: Create Barrel Export

**Files:**

- Create: `src/components/confetti/index.ts`

**Step 1: Create the barrel file**

```typescript
export { ConfettiProvider } from "./confetti-provider";
export { useConfetti } from "./use-confetti";
export type { ConfettiIntensity, ConfettiStyle } from "./confetti-config";
```

**Step 2: Commit**

```bash
git add src/components/confetti/index.ts
git commit -m "feat(confetti): add barrel export"
```

---

### Task 6: Add ConfettiProvider to Layout

**Files:**

- Modify: `src/app/[locale]/layout.tsx`

**Step 1: Add import**

Add to imports (around line 7):

```typescript
import { ConfettiProvider } from "@/components/confetti";
```

**Step 2: Wrap children with provider**

Modify the ThemeProvider contents (lines 54-57) to wrap with ConfettiProvider:

Change from:

```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
  <SetLocale locale={locale} />
  {children}
  <Toaster richColors position="bottom-right" />
</ThemeProvider>
```

To:

```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
  <ConfettiProvider>
    <SetLocale locale={locale} />
    {children}
    <Toaster richColors position="bottom-right" />
  </ConfettiProvider>
</ThemeProvider>
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/[locale]/layout.tsx
git commit -m "feat(confetti): add ConfettiProvider to app layout"
```

---

### Task 7: Integrate Confetti in ChoreCard

**Files:**

- Modify: `src/components/chores/components/chore-card.tsx`

**Step 1: Add import**

Add to imports (around line 4):

```typescript
import { useConfetti } from "@/components/confetti";
```

**Step 2: Add hook to component**

Add inside the component function (around line 28, after other hooks):

```typescript
const { fire } = useConfetti();
```

**Step 3: Update handleComplete**

Change the `handleComplete` function (lines 46-50) from:

```typescript
const handleComplete = async (e: React.MouseEvent) => {
  e.stopPropagation();
  setIsCompleting(true);
  await completeChore(chore.id);
};
```

To:

```typescript
const handleComplete = async (e: React.MouseEvent) => {
  e.stopPropagation();
  setIsCompleting(true);
  await completeChore(chore.id);
  fire(chore.starReward);
};
```

**Step 4: Commit**

```bash
git add src/components/chores/components/chore-card.tsx
git commit -m "feat(chores): add confetti celebration on chore completion"
```

---

### Task 8: Integrate Confetti in TaskCheckbox

**Files:**

- Modify: `src/components/wall-hub/shared/task-checkbox.tsx`

**Step 1: Add import**

Add to imports (around line 4):

```typescript
import { useConfetti } from "@/components/confetti";
```

**Step 2: Add hook and handler**

Change the component from:

```typescript
export function TaskCheckbox({
  chore,
  onComplete,
  disabled,
}: TaskCheckboxProps) {
  const isCompleted = chore.status === "completed";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
      <Checkbox
        checked={isCompleted}
        disabled={disabled || isCompleted}
        onCheckedChange={() => onComplete(chore.id)}
        className="size-5"
      />
```

To:

```typescript
export function TaskCheckbox({
  chore,
  onComplete,
  disabled,
}: TaskCheckboxProps) {
  const { fire } = useConfetti();
  const isCompleted = chore.status === "completed";

  const handleComplete = () => {
    onComplete(chore.id);
    fire(chore.starReward);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed p-3">
      <Checkbox
        checked={isCompleted}
        disabled={disabled || isCompleted}
        onCheckedChange={handleComplete}
        className="size-5"
      />
```

**Step 3: Commit**

```bash
git add src/components/wall-hub/shared/task-checkbox.tsx
git commit -m "feat(wall-hub): add confetti celebration on task checkbox completion"
```

---

### Task 9: Pass starValue to TaskCell

**Files:**

- Modify: `src/components/reward-chart/weekly-grid/task-row.tsx`

**Step 1: Update TaskCell invocation**

Change the TaskCell mapping (lines 109-117) from:

```tsx
{
  cells.map((cell, index) => (
    <TaskCell
      key={cell.date}
      cell={cell}
      isToday={days[index].isToday}
      onComplete={() => onComplete(task.id)}
      onUndo={() => onUndo(task.id)}
      disabled={disabled}
    />
  ));
}
```

To:

```tsx
{
  cells.map((cell, index) => (
    <TaskCell
      key={cell.date}
      cell={cell}
      isToday={days[index].isToday}
      onComplete={() => onComplete(task.id)}
      onUndo={() => onUndo(task.id)}
      disabled={disabled}
      starValue={task.starValue}
    />
  ));
}
```

**Step 2: Commit**

```bash
git add src/components/reward-chart/weekly-grid/task-row.tsx
git commit -m "feat(reward-chart): pass starValue to TaskCell component"
```

---

### Task 10: Integrate Confetti in TaskCell

**Files:**

- Modify: `src/components/reward-chart/weekly-grid/task-cell.tsx`

**Step 1: Add import**

Add to imports (around line 4):

```typescript
import { useConfetti } from "@/components/confetti";
```

**Step 2: Update interface**

Change the interface (lines 7-13) from:

```typescript
interface TaskCellProps {
  cell: TaskCellType;
  isToday: boolean;
  onComplete: () => void;
  onUndo: () => void;
  disabled?: boolean;
}
```

To:

```typescript
interface TaskCellProps {
  cell: TaskCellType;
  isToday: boolean;
  onComplete: () => void;
  onUndo: () => void;
  disabled?: boolean;
  starValue?: number;
}
```

**Step 3: Update component and handler**

Change the component (lines 15-30) from:

```typescript
export function TaskCell({
  cell,
  isToday,
  onComplete,
  onUndo,
  disabled,
}: TaskCellProps) {
  const handleClick = () => {
    if (disabled) return;

    if (cell.status === "completed" && isToday) {
      onUndo();
    } else if (cell.status === "pending") {
      onComplete();
    }
  };
```

To:

```typescript
export function TaskCell({
  cell,
  isToday,
  onComplete,
  onUndo,
  disabled,
  starValue,
}: TaskCellProps) {
  const { fire } = useConfetti();

  const handleClick = () => {
    if (disabled) return;

    if (cell.status === "completed" && isToday) {
      onUndo();
    } else if (cell.status === "pending") {
      onComplete();
      fire(starValue ?? 1);
    }
  };
```

**Step 4: Commit**

```bash
git add src/components/reward-chart/weekly-grid/task-cell.tsx
git commit -m "feat(reward-chart): add confetti celebration on task cell completion"
```

---

### Task 11: Integrate Confetti in TimerCard

**Files:**

- Modify: `src/components/dashboard/active-timers/timer-card.tsx`

**Step 1: Add import**

Add to imports (around line 10):

```typescript
import { useConfetti } from "@/components/confetti";
```

**Step 2: Add hook to component**

Add inside the component function (after the useDashboard hook):

```typescript
const { fire } = useConfetti();
```

**Step 3: Update handleConfirm**

Find the `handleConfirm` function and update it to fire confetti:

Change from:

```typescript
const handleConfirm = () => {
  if (timer.assignedToId) {
    confirmTimer(timer.id, timer.assignedToId);
  }
};
```

To:

```typescript
const handleConfirm = () => {
  if (timer.assignedToId) {
    confirmTimer(timer.id, timer.assignedToId);
    fire(timer.starReward);
  }
};
```

**Step 4: Update handleAcknowledge**

Find the `handleAcknowledge` function and update it:

Change from:

```typescript
const handleAcknowledge = () => {
  acknowledgeTimer(timer.id);
};
```

To:

```typescript
const handleAcknowledge = () => {
  acknowledgeTimer(timer.id);
  if (timer.starReward > 0) {
    fire(timer.starReward);
  }
};
```

**Step 5: Commit**

```bash
git add src/components/dashboard/active-timers/timer-card.tsx
git commit -m "feat(timers): add confetti celebration on timer completion"
```

---

### Task 12: Verify Build and Test

**Files:** None (verification only)

**Step 1: Run TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 2: Run linter**

Run: `pnpm lint`
Expected: No errors

**Step 3: Run build**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Run dev server and test manually**

Run: `pnpm dev`

Test each trigger point:

1. Navigate to Chores page → Complete a chore → Confetti should fire
2. Navigate to Wall Hub → Check a task checkbox → Confetti should fire
3. Navigate to Reward Chart → Click pending cell → Confetti should fire
4. Start a timer → Complete it → Confetti should fire

Verify intensity scaling:

- 1-2 star task: Small burst
- 3-4 star task: Medium burst
- 5+ star task: Large celebration

**Step 5: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: address any build/lint issues from confetti integration"
```

---

## Verification Checklist

After all tasks complete:

- [ ] Magic UI confetti component installed in `src/components/magicui/`
- [ ] ConfettiProvider wraps app in layout
- [ ] ChoreCard fires confetti on completion
- [ ] TaskCheckbox fires confetti on completion
- [ ] TaskCell fires confetti on completion
- [ ] TimerCard fires confetti on confirm/acknowledge
- [ ] Small tasks (1-2 stars) show small burst
- [ ] Medium tasks (3-4 stars) show medium burst
- [ ] Large tasks (5+ stars) show large celebration
- [ ] Animation styles vary randomly
- [ ] Build passes
- [ ] Lint passes

---

## Files Summary

**New Files (4):**

- `src/components/confetti/confetti-config.ts`
- `src/components/confetti/confetti-provider.tsx`
- `src/components/confetti/use-confetti.ts`
- `src/components/confetti/index.ts`

**Auto-Generated (1):**

- `src/components/magicui/confetti.tsx`

**Modified Files (6):**

- `src/app/[locale]/layout.tsx`
- `src/components/chores/components/chore-card.tsx`
- `src/components/wall-hub/shared/task-checkbox.tsx`
- `src/components/reward-chart/weekly-grid/task-row.tsx`
- `src/components/reward-chart/weekly-grid/task-cell.tsx`
- `src/components/dashboard/active-timers/timer-card.tsx`
