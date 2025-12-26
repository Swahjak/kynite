# Lucide Icon System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Material Symbols (Google Fonts CDN) with a unified Lucide React icon system.

**Architecture:** Create a new Icon wrapper component using CVA for consistent sizing, migrate all Material Symbols usages to Lucide equivalents, and add legacy mapping for existing database records.

**Tech Stack:** Lucide React, CVA (class-variance-authority), TypeScript, shadcn/ui patterns

---

## Icon Mapping Reference

| Material Symbol   | Lucide Import   | Key              |
| ----------------- | --------------- | ---------------- |
| touch_app         | Hand            | hand             |
| add               | Plus            | plus             |
| calendar_month    | CalendarDays    | calendar-days    |
| stadia_controller | Gamepad2        | gamepad-2        |
| restaurant_menu   | UtensilsCrossed | utensils-crossed |
| check_circle      | CheckCircle     | check-circle     |
| share             | Share2          | share-2          |
| code              | Code            | code             |
| dentistry         | Smile           | smile            |
| bed               | Bed             | bed              |
| restaurant        | Utensils        | utensils         |
| menu_book         | BookOpen        | book-open        |
| checkroom         | Shirt           | shirt            |
| music_note        | Music           | music            |
| pets              | PawPrint        | paw-print        |
| school            | GraduationCap   | graduation-cap   |
| shower            | ShowerHead      | shower-head      |
| backpack          | Backpack        | backpack         |
| fitness_center    | Dumbbell        | dumbbell         |
| cleaning_services | Sparkles        | sparkles         |

---

### Task 1: Create ADR for Lucide Icon System

**Files:**

- Create: `docs/adr/20251225-lucide-icon-system.md`

**Step 1: Create the ADR file**

```markdown
# ADR: Lucide Icon System

**Date:** 2025-12-25
**Status:** Accepted
**Context:** Icon System Standardization

## Decision

Standardize on **Lucide React** as the sole icon library, removing Material Symbols.

## Context

The project used two icon systems:

- **Material Symbols** (Google Fonts CDN) - 5 files, homepage and reward chart
- **Lucide React** (npm package) - 77 files, UI components

Options considered:

1. **Keep both** - Maintain hybrid approach
2. **Standardize on Lucide** - Remove Material Symbols, align with shadcn/ui
3. **Standardize on Material** - Migrate Lucide usages to Material

## Rationale

We chose Lucide React because:

1. **shadcn/ui alignment** - components.json already specifies `"iconLibrary": "lucide"`
2. **Existing majority** - 77 files already use Lucide vs 5 for Material
3. **No CDN dependency** - Tree-shakeable npm package, no external font loading
4. **Simpler bundle** - Only imports used icons, no font file overhead
5. **TypeScript support** - Full type safety with LucideIcon type

## Consequences

### Positive

- Single icon system across entire codebase
- No external CDN dependency
- Smaller initial page load (no font download)
- Better TypeScript integration
- Consistent with shadcn/ui ecosystem

### Negative

- Some Material icons lack direct Lucide equivalents (e.g., dentistry → Smile)
- Migration effort for existing Material Symbols usages

## Implementation

- New Icon wrapper component at `src/components/ui/icon.tsx`
- Legacy mapping for existing database records
- Icon mapping table in implementation plan

## Related

- Implementation plan: `docs/plans/2025-12-25-lucide-icon-system.md`
- Icon component: `src/components/ui/icon.tsx`
- shadcn config: `components.json`
```

**Step 2: Commit**

```bash
git add docs/adr/20251225-lucide-icon-system.md
git commit -m "docs: add ADR for Lucide icon system standardization"
```

---

### Task 2: Replace Icon Component

**Files:**

- Modify: `src/components/ui/icon.tsx` (replace entirely)

**Step 1: Replace the Icon component**

```tsx
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { type LucideIcon, type LucideProps } from "lucide-react";

import { cn } from "@/lib/utils";

const iconVariants = cva("shrink-0", {
  variants: {
    size: {
      xs: "size-3.5", // 14px
      sm: "size-[18px]", // 18px
      md: "size-6", // 24px
      lg: "size-7", // 28px
      xl: "size-8", // 32px
      "2xl": "size-10", // 40px
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export interface IconProps
  extends Omit<LucideProps, "size">, VariantProps<typeof iconVariants> {
  /** The Lucide icon component to render */
  icon: LucideIcon;
}

function Icon({
  icon: LucideIconComponent,
  size,
  className,
  ...props
}: IconProps) {
  return (
    <LucideIconComponent
      data-slot="icon"
      className={cn(iconVariants({ size, className }))}
      {...props}
    />
  );
}

export { Icon, iconVariants };
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No errors (will show errors from other files using old Icon API - that's expected)

**Step 3: Commit**

```bash
git add src/components/ui/icon.tsx
git commit -m "feat(icon): replace Material Symbols wrapper with Lucide wrapper"
```

---

### Task 3: Update Reward Chart Constants

**Files:**

- Modify: `src/components/reward-chart/constants.ts`

**Step 1: Update TASK_ICONS and add helper**

Add imports at the top and update the constants:

```tsx
import type { LucideIcon } from "lucide-react";
import {
  Backpack,
  Bed,
  BookOpen,
  Dumbbell,
  GraduationCap,
  Music,
  PawPrint,
  Shirt,
  ShowerHead,
  Smile,
  Sparkles,
  Utensils,
  HelpCircle,
} from "lucide-react";

export const ICON_COLORS = {
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    darkBg: "dark:bg-blue-950",
    darkText: "dark:text-blue-400",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    darkBg: "dark:bg-emerald-950",
    darkText: "dark:text-emerald-400",
  },
  purple: {
    bg: "bg-purple-50",
    text: "text-purple-600",
    darkBg: "dark:bg-purple-950",
    darkText: "dark:text-purple-400",
  },
  orange: {
    bg: "bg-orange-50",
    text: "text-orange-600",
    darkBg: "dark:bg-orange-950",
    darkText: "dark:text-orange-400",
  },
  pink: {
    bg: "bg-pink-50",
    text: "text-pink-600",
    darkBg: "dark:bg-pink-950",
    darkText: "dark:text-pink-400",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    darkBg: "dark:bg-amber-950",
    darkText: "dark:text-amber-400",
  },
  teal: {
    bg: "bg-teal-50",
    text: "text-teal-600",
    darkBg: "dark:bg-teal-950",
    darkText: "dark:text-teal-400",
  },
  rose: {
    bg: "bg-rose-50",
    text: "text-rose-600",
    darkBg: "dark:bg-rose-950",
    darkText: "dark:text-rose-400",
  },
} as const;

export type IconColorKey = keyof typeof ICON_COLORS;

export interface TaskIconOption {
  icon: LucideIcon;
  key: string;
  label: string;
}

export const TASK_ICONS: TaskIconOption[] = [
  { icon: Smile, key: "smile", label: "Brush Teeth" },
  { icon: Bed, key: "bed", label: "Make Bed" },
  { icon: Utensils, key: "utensils", label: "Eat/Table" },
  { icon: BookOpen, key: "book-open", label: "Reading" },
  { icon: Shirt, key: "shirt", label: "Clothes/PJs" },
  { icon: Music, key: "music", label: "Practice Music" },
  { icon: PawPrint, key: "paw-print", label: "Pet Care" },
  { icon: GraduationCap, key: "graduation-cap", label: "Homework" },
  { icon: ShowerHead, key: "shower-head", label: "Shower/Bath" },
  { icon: Backpack, key: "backpack", label: "Pack Bag" },
  { icon: Dumbbell, key: "dumbbell", label: "Exercise" },
  { icon: Sparkles, key: "sparkles", label: "Clean Room" },
];

// Legacy Material Symbols name to new key mapping
const LEGACY_ICON_MAP: Record<string, string> = {
  dentistry: "smile",
  restaurant: "utensils",
  menu_book: "book-open",
  checkroom: "shirt",
  music_note: "music",
  pets: "paw-print",
  school: "graduation-cap",
  shower: "shower-head",
  fitness_center: "dumbbell",
  cleaning_services: "sparkles",
};

/** Get icon component by key, with legacy Material Symbols fallback */
export function getTaskIconByKey(iconKey: string): LucideIcon {
  const normalizedKey = LEGACY_ICON_MAP[iconKey] ?? iconKey;
  const found = TASK_ICONS.find((item) => item.key === normalizedKey);
  return found?.icon ?? HelpCircle;
}

export const DEFAULT_TASKS = [
  {
    title: "Brush Teeth AM",
    icon: "smile",
    iconColor: "blue",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
  {
    title: "Brush Teeth PM",
    icon: "smile",
    iconColor: "blue",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
  {
    title: "Make Bed",
    icon: "bed",
    iconColor: "emerald",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
  {
    title: "Read 15 Minutes",
    icon: "book-open",
    iconColor: "orange",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
  {
    title: "PJs On",
    icon: "shirt",
    iconColor: "pink",
    daysOfWeek: [1, 2, 3, 4, 5, 6, 0],
  },
] as const;
```

**Step 2: Commit**

```bash
git add src/components/reward-chart/constants.ts
git commit -m "feat(reward-chart): update TASK_ICONS to Lucide with legacy mapping"
```

---

### Task 4: Migrate Reward Chart Task Dialog

**Files:**

- Modify: `src/components/reward-chart/dialogs/task-dialog.tsx`

**Step 1: Read the current file to understand structure**

Run: Read the task-dialog.tsx file to find the icon picker section

**Step 2: Update the icon picker**

Replace the icon picker section (around lines 160-170) that uses `material-symbols-outlined`:

Change from:

```tsx
<span className="material-symbols-outlined text-xl">{iconItem.icon}</span>
```

To:

```tsx
{
  (() => {
    const IconComponent = iconItem.icon;
    return <IconComponent className="size-5" />;
  })();
}
```

Also update the import to use the new `TASK_ICONS` structure and update field references from `iconItem.icon` (string) to `iconItem.key` for the value.

**Step 3: Commit**

```bash
git add src/components/reward-chart/dialogs/task-dialog.tsx
git commit -m "feat(reward-chart): migrate task dialog icon picker to Lucide"
```

---

### Task 5: Migrate Reward Chart Task Row

**Files:**

- Modify: `src/components/reward-chart/weekly-grid/task-row.tsx`

**Step 1: Read the current file**

Run: Read task-row.tsx to find the icon display section

**Step 2: Update the icon display**

Import the helper and replace the icon rendering (around lines 70-78):

Add import:

```tsx
import { getTaskIconByKey } from "../constants";
```

Replace:

```tsx
<span
  className={cn(
    "material-symbols-outlined text-xl",
    colors.text,
    colors.darkText
  )}
>
  {task.icon}
</span>
```

With:

```tsx
{
  (() => {
    const IconComponent = getTaskIconByKey(task.icon);
    return (
      <IconComponent className={cn("size-5", colors.text, colors.darkText)} />
    );
  })();
}
```

**Step 3: Commit**

```bash
git add src/components/reward-chart/weekly-grid/task-row.tsx
git commit -m "feat(reward-chart): migrate task row icon display to Lucide"
```

---

### Task 6: Migrate Hero Section

**Files:**

- Modify: `src/components/homepage/hero-section.tsx`

**Step 1: Read the current file**

Run: Read hero-section.tsx to find Icon usages

**Step 2: Update imports and Icon usages**

Add Lucide imports:

```tsx
import { Hand, Plus } from "lucide-react";
```

Update Icon component import (already imported) and change usages:

- `<Icon name="touch_app" ... />` → `<Icon icon={Hand} ... />`
- `<Icon name="add" />` → `<Icon icon={Plus} />`

**Step 3: Commit**

```bash
git add src/components/homepage/hero-section.tsx
git commit -m "feat(homepage): migrate hero section icons to Lucide"
```

---

### Task 7: Migrate Features Section

**Files:**

- Modify: `src/components/homepage/features-section.tsx`

**Step 1: Read the current file**

Run: Read features-section.tsx to understand the features array structure

**Step 2: Update the features array and imports**

Add Lucide imports:

```tsx
import { CalendarDays, Gamepad2, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";
```

Update features array to use components instead of strings:

```tsx
const features: Array<{ key: string; icon: LucideIcon; color: string }> = [
  { key: "calendar", icon: CalendarDays, color: "primary" },
  { key: "routines", icon: Gamepad2, color: "purple" },
  { key: "meals", icon: UtensilsCrossed, color: "orange" },
];
```

Update Icon usage: `<Icon name={feature.icon} ... />` → `<Icon icon={feature.icon} ... />`

**Step 3: Commit**

```bash
git add src/components/homepage/features-section.tsx
git commit -m "feat(homepage): migrate features section icons to Lucide"
```

---

### Task 8: Migrate Pricing Section

**Files:**

- Modify: `src/components/homepage/pricing-section.tsx`

**Step 1: Read the current file**

Run: Read pricing-section.tsx to find Icon usages

**Step 2: Update imports and Icon usages**

Add Lucide import:

```tsx
import { CheckCircle } from "lucide-react";
```

Update Icon usages:

- `<Icon name="check_circle" ... />` → `<Icon icon={CheckCircle} ... />`

**Step 3: Commit**

```bash
git add src/components/homepage/pricing-section.tsx
git commit -m "feat(homepage): migrate pricing section icons to Lucide"
```

---

### Task 9: Migrate Homepage Footer

**Files:**

- Modify: `src/components/homepage/homepage-footer.tsx`

**Step 1: Read the current file**

Run: Read homepage-footer.tsx to find Icon usages

**Step 2: Update imports and Icon usages**

Add Lucide imports:

```tsx
import { Share2, Code } from "lucide-react";
```

Update Icon usages:

- `<Icon name="share" ... />` → `<Icon icon={Share2} ... />`
- `<Icon name="code" ... />` → `<Icon icon={Code} ... />`

**Step 3: Commit**

```bash
git add src/components/homepage/homepage-footer.tsx
git commit -m "feat(homepage): migrate footer icons to Lucide"
```

---

### Task 10: Remove Material Symbols CDN Link

**Files:**

- Modify: `src/app/layout.tsx`

**Step 1: Remove the Google Fonts link**

Remove lines 48-51:

```html
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
/>
```

**Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "chore: remove Material Symbols CDN link"
```

---

### Task 11: Remove Material Symbols CSS

**Files:**

- Modify: `src/app/globals.css`

**Step 1: Remove the CSS class definition**

Remove lines 221-236 (the `.material-symbols-outlined` class):

```css
.material-symbols-outlined {
  font-family: "Material Symbols Outlined";
  font-weight: normal;
  font-style: normal;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  font-feature-settings: "liga";
}
```

**Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "chore: remove Material Symbols CSS class"
```

---

### Task 12: Verify Build and Lint

**Files:** None (verification only)

**Step 1: Run TypeScript check**

Run: `pnpm exec tsc --noEmit`
Expected: No errors

**Step 2: Run linter**

Run: `pnpm lint`
Expected: No errors (or only pre-existing warnings)

**Step 3: Run build**

Run: `pnpm build`
Expected: Build succeeds

**Step 4: Final commit if any fixes needed**

If any fixes were required, commit them:

```bash
git add -A
git commit -m "fix: address build/lint issues from icon migration"
```

---

## Verification Checklist

After all tasks complete:

- [ ] Homepage renders with correct icons
- [ ] Reward chart icon picker works
- [ ] Reward chart task rows display icons with correct colors
- [ ] Creating new tasks saves correct icon keys
- [ ] Existing tasks (legacy icon names) display correctly via fallback mapping
- [ ] Dark mode icon colors work
- [ ] No console errors about missing fonts
- [ ] Build passes
- [ ] Lint passes
