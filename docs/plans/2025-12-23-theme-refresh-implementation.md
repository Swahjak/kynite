# Theme Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update theme colors, border radius, and component styling to match the vibrant, rounded, playful design mockups.

**Architecture:** CSS variable updates in globals.css, followed by targeted component class changes. No structural changes to components.

**Tech Stack:** Tailwind CSS 4, shadcn/ui components, oklch color space

---

## Task 1: Update CSS Variables - Colors

**Files:**

- Modify: `src/app/globals.css:52-126` (light mode)
- Modify: `src/app/globals.css:128-201` (dark mode)

**Step 1: Update primary color (more vibrant)**

In `:root` section, change:

```css
/* OLD */
--primary: oklch(0.83 0.18 160);
--primary-hover: oklch(0.78 0.17 158);

/* NEW */
--primary: oklch(0.87 0.22 160);
--primary-hover: oklch(0.82 0.2 158);
```

**Step 2: Update event colors (more saturated backgrounds)**

In `:root` section, change all event background lightness from 0.97 to 0.95 and increase chroma:

```css
/* Event Category Colors - Light Mode */
--event-blue-bg: oklch(0.95 0.03 240);
--event-blue-border: oklch(0.65 0.18 240);
--event-blue-text: oklch(0.45 0.15 240);

--event-purple-bg: oklch(0.95 0.03 300);
--event-purple-border: oklch(0.65 0.18 300);
--event-purple-text: oklch(0.45 0.15 300);

--event-orange-bg: oklch(0.95 0.04 70);
--event-orange-border: oklch(0.7 0.18 55);
--event-orange-text: oklch(0.5 0.15 55);

--event-green-bg: oklch(0.95 0.03 145);
--event-green-border: oklch(0.6 0.18 145);
--event-green-text: oklch(0.4 0.12 145);

--event-red-bg: oklch(0.95 0.03 25);
--event-red-border: oklch(0.65 0.2 25);
--event-red-text: oklch(0.5 0.18 25);

--event-yellow-bg: oklch(0.95 0.04 95);
--event-yellow-border: oklch(0.8 0.18 95);
--event-yellow-text: oklch(0.5 0.12 95);

--event-pink-bg: oklch(0.95 0.03 350);
--event-pink-border: oklch(0.7 0.18 350);
--event-pink-text: oklch(0.5 0.15 350);

--event-teal-bg: oklch(0.95 0.03 185);
--event-teal-border: oklch(0.65 0.15 185);
--event-teal-text: oklch(0.45 0.12 185);
```

**Step 3: Update status colors (brighter)**

```css
/* Status Colors */
--status-success: oklch(0.7 0.18 145);
--status-warning: oklch(0.8 0.18 55);
--status-error: oklch(0.65 0.22 25);
--status-info: oklch(0.65 0.18 240);
```

**Step 4: Update dark mode event colors similarly**

In `.dark` section, update event backgrounds to 0.28 lightness (was 0.25):

```css
/* Event Category Colors - Dark Mode */
--event-blue-bg: oklch(0.28 0.06 240);
--event-purple-bg: oklch(0.28 0.06 300);
--event-orange-bg: oklch(0.28 0.06 70);
--event-green-bg: oklch(0.28 0.06 145);
--event-red-bg: oklch(0.28 0.06 25);
--event-yellow-bg: oklch(0.28 0.06 95);
--event-pink-bg: oklch(0.28 0.06 350);
--event-teal-bg: oklch(0.28 0.06 185);
```

**Step 5: Verify build**

Run: `pnpm build`
Expected: Build succeeds

**Step 6: Commit**

```bash
git add src/app/globals.css
git commit -m "style: update theme colors to be more vibrant"
```

---

## Task 2: Update CSS Variables - Border Radius

**Files:**

- Modify: `src/app/globals.css:53`

**Step 1: Update base radius**

Change:

```css
/* OLD */
--radius: 0.625rem;

/* NEW */
--radius: 0.75rem;
```

**Step 2: Verify build**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: increase base border radius for rounder feel"
```

---

## Task 3: Update Button Component

**Files:**

- Modify: `src/components/ui/button.tsx:8`
- Modify: `src/components/ui/button.tsx:12`

**Step 1: Add shadow to base classes**

Change line 8 base classes from:

```tsx
"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
```

To:

```tsx
"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium shadow-sm transition-all duration-200 active:scale-95 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
```

Changes: `rounded-md` → `rounded-lg`, added `shadow-sm`

**Step 2: Update default variant hover**

Change line 12 from:

```tsx
default: "bg-primary text-primary-foreground hover:bg-primary/90",
```

To:

```tsx
default: "bg-primary text-primary-foreground hover:bg-primary-hover",
```

**Step 3: Verify lint passes**

Run: `pnpm lint`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/ui/button.tsx
git commit -m "style(button): add shadow and increase border radius"
```

---

## Task 4: Update Card Component

**Files:**

- Modify: `src/components/ui/card.tsx:10`

**Step 1: Update Card radius**

Change line 10 from:

```tsx
"bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
```

To:

```tsx
"bg-card text-card-foreground flex flex-col gap-6 rounded-2xl border py-6 shadow-sm",
```

Change: `rounded-xl` → `rounded-2xl`

**Step 2: Verify lint passes**

Run: `pnpm lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ui/card.tsx
git commit -m "style(card): increase border radius to rounded-2xl"
```

---

## Task 5: Update Badge Component - Add Status Variants

**Files:**

- Modify: `src/components/ui/badge.tsx:11-20`

**Step 1: Add status variants**

After the existing variants (line 19), add new status variants:

```tsx
variants: {
  variant: {
    default:
      "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
    secondary:
      "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
    destructive:
      "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
    outline:
      "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
    // New status variants
    now: "border-transparent bg-red-500 text-white font-bold",
    today: "border-transparent bg-primary text-primary-foreground font-bold",
    overdue: "border-transparent bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    "due-soon": "border-transparent bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    success: "border-transparent bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
},
```

**Step 2: Verify lint passes**

Run: `pnpm lint`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "style(badge): add status variants for now, today, overdue"
```

---

## Task 6: Update Input Component

**Files:**

- Modify: `src/components/ui/input.tsx:11`

**Step 1: Update radius**

Change `rounded-md` to `rounded-lg` in the className:

```tsx
"file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-lg border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
```

**Step 2: Commit**

```bash
git add src/components/ui/input.tsx
git commit -m "style(input): increase border radius to rounded-lg"
```

---

## Task 7: Update Select Component

**Files:**

- Modify: `src/components/ui/select.tsx:40` (trigger)
- Modify: `src/components/ui/select.tsx:65` (content)

**Step 1: Update SelectTrigger radius**

Change `rounded-md` to `rounded-lg` in line 40.

**Step 2: Update SelectContent radius and shadow**

Change `rounded-md` to `rounded-xl` and `shadow-md` to `shadow-lg` in line 65.

**Step 3: Commit**

```bash
git add src/components/ui/select.tsx
git commit -m "style(select): increase border radius and shadow"
```

---

## Task 8: Update Dialog Component

**Files:**

- Modify: `src/components/ui/dialog.tsx:63`

**Step 1: Update DialogContent radius**

Change `rounded-lg` to `rounded-2xl` in line 63.

**Step 2: Commit**

```bash
git add src/components/ui/dialog.tsx
git commit -m "style(dialog): increase border radius to rounded-2xl"
```

---

## Task 9: Update Remaining Components (Batch)

**Files:**

- `src/components/ui/dropdown-menu.tsx` - content rounded-md → rounded-xl
- `src/components/ui/popover.tsx` - content rounded-md → rounded-xl
- `src/components/ui/tooltip.tsx` - content rounded-md → rounded-lg
- `src/components/ui/alert-dialog.tsx` - content rounded-lg → rounded-2xl
- `src/components/ui/sheet.tsx` - content add rounded corners for side variants
- `src/components/ui/textarea.tsx` - rounded-md → rounded-lg
- `src/components/ui/switch.tsx` - verify primary color used
- `src/components/ui/checkbox.tsx` - verify primary color used

**Step 1: Update each file's radius as specified**

For each component, find the content/main element className and update the border radius.

**Step 2: Commit**

```bash
git add src/components/ui/dropdown-menu.tsx src/components/ui/popover.tsx src/components/ui/tooltip.tsx src/components/ui/alert-dialog.tsx src/components/ui/sheet.tsx src/components/ui/textarea.tsx
git commit -m "style: update border radius across remaining components"
```

---

## Task 10: Update Brand Guidelines

**Files:**

- Modify: `docs/brand-guideline.md`

**Step 1: Update Color System section**

Update the Core Colors table to reflect oklch values and confirm hex equivalents.

**Step 2: Update Border Radius section**

Update the table to reflect new scale:

```markdown
| Token     | Value  | Usage                        |
| --------- | ------ | ---------------------------- |
| `default` | 4px    | Subtle rounding              |
| `lg`      | 8px    | Small elements               |
| `xl`      | 12px   | Buttons, inputs, event cards |
| `2xl`     | 16px   | Cards, panels                |
| `3xl`     | 20px   | Large cards, modals          |
| `full`    | 9999px | Pills, chips, avatars        |
```

**Step 3: Add Component Patterns section**

Add documentation for:

- Filter chips (pill-shaped user selectors)
- Status badges (NOW, TODAY, OVERDUE variants)
- Event cards with left border accent

**Step 4: Commit**

```bash
git add docs/brand-guideline.md
git commit -m "docs: update brand guidelines to reflect theme refresh"
```

---

## Task 11: Visual Verification

**Step 1: Start dev server**

Run: `pnpm dev`

**Step 2: Check key pages**

- Homepage/Dashboard
- Calendar views
- Any forms/dialogs

**Step 3: Verify colors are more vibrant, corners are rounder**

Expected: Visual appearance matches design mockups more closely.

---

## Task 12: Final Build & Lint Check

**Step 1: Run linter**

Run: `pnpm lint`
Expected: No errors

**Step 2: Run build**

Run: `pnpm build`
Expected: Build succeeds

**Step 3: Run tests**

Run: `pnpm test:run`
Expected: Same pass/fail as baseline (16 pass, 4 pre-existing failures)

---

## Files Changed Summary

### Theme

- `src/app/globals.css`

### Components (11 files)

- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/popover.tsx`
- `src/components/ui/tooltip.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/components/ui/textarea.tsx`

### Documentation

- `docs/brand-guideline.md`
