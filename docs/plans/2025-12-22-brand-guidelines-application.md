# Brand Guidelines Application Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Apply the Family Planner brand guidelines to transform the app from generic shadcn styling to our distinctive brand identity with custom colors, fonts, and icons.

**Architecture:** Update CSS variables in globals.css to match brand color tokens, replace Geist fonts with Lexend (display) and Noto Sans (body), and replace Lucide icons with Material Symbols Outlined. All shadcn components will automatically inherit the new styling through CSS variables.

**Tech Stack:** Tailwind CSS 4, next-themes, Google Fonts (Lexend, Noto Sans), Material Symbols Outlined

---

## Phase 1: Typography

### Task 1.1: Install Brand Fonts

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Update font imports in layout.tsx**

Replace the current Geist font imports with Lexend and Noto Sans:

```tsx
import { Lexend, Noto_Sans } from "next/font/google";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});
```

**Step 2: Update body className**

Replace the Geist font variables with the new font variables:

```tsx
<body className={`${lexend.variable} ${notoSans.variable} antialiased`}>
```

**Step 3: Verify fonts load**

Run: `pnpm dev`
Open: http://localhost:3000
Expected: No font loading errors in console, Network tab shows Lexend and Noto_Sans font files loaded

**Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: replace Geist fonts with Lexend and Noto Sans"
```

---

### Task 1.2: Configure Font Families in CSS

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Add font-family definitions in @theme**

Find the `@theme inline` block and add font family definitions:

```css
@theme inline {
  /* ... existing radius definitions ... */

  --font-display: var(--font-lexend), ui-sans-serif, system-ui, sans-serif;
  --font-body: var(--font-noto-sans), ui-sans-serif, system-ui, sans-serif;
}
```

**Step 2: Set default font on body**

Add to the existing base layer or create one:

```css
@layer base {
  body {
    font-family: var(--font-body);
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-display);
  }
}
```

**Step 3: Verify typography**

Run: `pnpm dev`
Open: http://localhost:3000
Expected: Headings use Lexend, body text uses Noto Sans

**Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: configure Lexend for headings, Noto Sans for body"
```

---

## Phase 2: Color System

### Task 2.1: Update Primary Colors

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Convert hex colors to oklch**

Use these pre-calculated oklch values for brand colors:

| Color | Hex | OKLCH |
|-------|-----|-------|
| Primary | #13ec92 | oklch(0.83 0.18 160) |
| Primary Hover | #0fd683 | oklch(0.78 0.17 158) |
| Primary Dark | #0d9e61 | oklch(0.60 0.14 155) |

**Step 2: Update :root color variables**

Replace the current primary color values in the `:root` block:

```css
:root {
  --primary: oklch(0.83 0.18 160);
  --primary-foreground: oklch(0.15 0.03 160);

  /* Add new brand-specific variables */
  --primary-hover: oklch(0.78 0.17 158);
  --primary-dark: oklch(0.60 0.14 155);
}
```

**Step 3: Update .dark color variables**

In the `.dark` block, update primary colors (same values work for dark mode):

```css
.dark {
  --primary: oklch(0.83 0.18 160);
  --primary-foreground: oklch(0.15 0.03 160);
  --primary-hover: oklch(0.78 0.17 158);
  --primary-dark: oklch(0.60 0.14 155);
}
```

**Step 4: Verify primary color**

Run: `pnpm dev`
Open: http://localhost:3000
Expected: Primary buttons and accents show bright green (#13ec92)

**Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: update primary color to brand green #13ec92"
```

---

### Task 2.2: Update Background and Surface Colors

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Calculate brand background colors in oklch**

| Color | Hex | OKLCH |
|-------|-----|-------|
| Background Light | #f6f8f7 | oklch(0.975 0.005 160) |
| Background Dark | #10221a | oklch(0.20 0.03 160) |
| Surface Light | #ffffff | oklch(1 0 0) |
| Surface Dark | #1c2e26 | oklch(0.28 0.03 160) |
| Surface Elevated Dark | #253830 | oklch(0.32 0.03 160) |
| Surface Hover Light | #f0f4f3 | oklch(0.96 0.008 160) |
| Surface Hover Dark | #2f453b | oklch(0.38 0.035 160) |

**Step 2: Update :root with light mode colors**

```css
:root {
  --background: oklch(0.975 0.005 160);
  --foreground: oklch(0.15 0.02 160);

  --card: oklch(1 0 0);
  --card-foreground: oklch(0.15 0.02 160);

  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.15 0.02 160);

  --muted: oklch(0.96 0.008 160);
  --muted-foreground: oklch(0.50 0.04 160);

  --accent: oklch(0.96 0.008 160);
  --accent-foreground: oklch(0.15 0.02 160);

  /* ... keep primary colors from Task 2.1 ... */
}
```

**Step 3: Update .dark with dark mode colors**

```css
.dark {
  --background: oklch(0.20 0.03 160);
  --foreground: oklch(0.98 0 0);

  --card: oklch(0.28 0.03 160);
  --card-foreground: oklch(0.98 0 0);

  --popover: oklch(0.28 0.03 160);
  --popover-foreground: oklch(0.98 0 0);

  --muted: oklch(0.32 0.03 160);
  --muted-foreground: oklch(0.65 0.04 160);

  --accent: oklch(0.32 0.03 160);
  --accent-foreground: oklch(0.98 0 0);

  /* ... keep primary colors from Task 2.1 ... */
}
```

**Step 4: Verify background colors**

Run: `pnpm dev`
Open: http://localhost:3000
Toggle dark mode using system preferences or theme toggle
Expected: Light mode has subtle green-tinted gray (#f6f8f7), dark mode has deep green-tinted dark (#10221a)

**Step 5: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: update background/surface colors to brand palette"
```

---

### Task 2.3: Update Text Colors

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Calculate brand text colors in oklch**

| Color | Hex | OKLCH |
|-------|-----|-------|
| Text Primary Light | #111815 | oklch(0.18 0.02 160) |
| Text Primary Dark | #ffffff | oklch(1 0 0) |
| Text Secondary Light | #618979 | oklch(0.58 0.06 165) |
| Text Secondary Dark | #8baea0 | oklch(0.72 0.05 165) |
| Text Muted Light | #9ca3af | oklch(0.70 0.02 250) |
| Text Muted Dark | #6b7280 | oklch(0.55 0.02 250) |

**Step 2: Verify foreground colors match brand**

The foreground values from Task 2.2 should align. If not already done, ensure:

```css
:root {
  --foreground: oklch(0.18 0.02 160);  /* #111815 */
  --muted-foreground: oklch(0.58 0.06 165);  /* #618979 - secondary */
}

.dark {
  --foreground: oklch(1 0 0);  /* #ffffff */
  --muted-foreground: oklch(0.72 0.05 165);  /* #8baea0 - secondary */
}
```

**Step 3: Verify text colors**

Run: `pnpm dev`
Open: http://localhost:3000
Expected: Primary text is dark in light mode, white in dark mode. Secondary/muted text has green undertone.

**Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: update text colors to brand palette"
```

---

### Task 2.4: Update Border Colors

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Calculate brand border colors in oklch**

| Color | Hex | OKLCH |
|-------|-----|-------|
| Border Default Light | #dbe6e1 | oklch(0.91 0.02 165) |
| Border Default Dark | #2a3831 | oklch(0.30 0.025 160) |
| Border Light Light | #e6e8e7 | oklch(0.92 0.005 160) |
| Border Light Dark | #374740 | oklch(0.38 0.025 160) |
| Border Focus | #13ec92 | oklch(0.83 0.18 160) |

**Step 2: Update border variables**

```css
:root {
  --border: oklch(0.91 0.02 165);
  --input: oklch(0.91 0.02 165);
  --ring: oklch(0.83 0.18 160);  /* Primary for focus rings */
}

.dark {
  --border: oklch(0.30 0.025 160);
  --input: oklch(0.30 0.025 160);
  --ring: oklch(0.83 0.18 160);  /* Primary for focus rings */
}
```

**Step 3: Verify border colors**

Run: `pnpm dev`
Open: http://localhost:3000
Expected: Card borders have subtle green tint, focus rings are brand green

**Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: update border colors to brand palette"
```

---

## Phase 3: Event Category Colors

### Task 3.1: Add Event Color CSS Variables

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Add event color variables to :root**

Add after the existing color variables:

```css
:root {
  /* ... existing variables ... */

  /* Event Category Colors - Light Mode */
  --event-blue-bg: oklch(0.97 0.02 240);
  --event-blue-border: oklch(0.70 0.15 240);
  --event-blue-text: oklch(0.50 0.15 240);

  --event-purple-bg: oklch(0.97 0.02 300);
  --event-purple-border: oklch(0.70 0.15 300);
  --event-purple-text: oklch(0.50 0.15 300);

  --event-orange-bg: oklch(0.97 0.03 70);
  --event-orange-border: oklch(0.75 0.15 55);
  --event-orange-text: oklch(0.55 0.15 55);

  --event-green-bg: oklch(0.97 0.02 145);
  --event-green-border: oklch(0.65 0.15 145);
  --event-green-text: oklch(0.45 0.12 145);

  --event-red-bg: oklch(0.97 0.02 25);
  --event-red-border: oklch(0.70 0.18 25);
  --event-red-text: oklch(0.55 0.18 25);

  --event-yellow-bg: oklch(0.97 0.03 95);
  --event-yellow-border: oklch(0.85 0.15 95);
  --event-yellow-text: oklch(0.55 0.12 95);

  --event-pink-bg: oklch(0.97 0.02 350);
  --event-pink-border: oklch(0.75 0.15 350);
  --event-pink-text: oklch(0.55 0.15 350);

  --event-teal-bg: oklch(0.97 0.02 185);
  --event-teal-border: oklch(0.70 0.12 185);
  --event-teal-text: oklch(0.50 0.12 185);
}
```

**Step 2: Add event color variables to .dark**

```css
.dark {
  /* ... existing variables ... */

  /* Event Category Colors - Dark Mode */
  --event-blue-bg: oklch(0.25 0.05 240);
  --event-blue-border: oklch(0.70 0.15 240);
  --event-blue-text: oklch(0.80 0.12 240);

  --event-purple-bg: oklch(0.25 0.05 300);
  --event-purple-border: oklch(0.70 0.15 300);
  --event-purple-text: oklch(0.80 0.12 300);

  --event-orange-bg: oklch(0.25 0.05 70);
  --event-orange-border: oklch(0.75 0.15 55);
  --event-orange-text: oklch(0.80 0.12 55);

  --event-green-bg: oklch(0.25 0.05 145);
  --event-green-border: oklch(0.65 0.15 145);
  --event-green-text: oklch(0.75 0.10 145);

  --event-red-bg: oklch(0.25 0.05 25);
  --event-red-border: oklch(0.70 0.18 25);
  --event-red-text: oklch(0.80 0.15 25);

  --event-yellow-bg: oklch(0.25 0.05 95);
  --event-yellow-border: oklch(0.85 0.15 95);
  --event-yellow-text: oklch(0.80 0.10 95);

  --event-pink-bg: oklch(0.25 0.05 350);
  --event-pink-border: oklch(0.75 0.15 350);
  --event-pink-text: oklch(0.80 0.12 350);

  --event-teal-bg: oklch(0.25 0.05 185);
  --event-teal-border: oklch(0.70 0.12 185);
  --event-teal-text: oklch(0.80 0.10 185);
}
```

**Step 3: Verify variables are defined**

Run: `pnpm dev`
Open: Browser DevTools > Elements > Computed
Expected: All --event-* variables visible on :root

**Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add event category color variables"
```

---

### Task 3.2: Create Event Color Utility Classes

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Add event color utility classes**

Add after the @layer base block:

```css
@layer components {
  /* Event color utilities - use as: className="event-blue" */
  .event-blue {
    background-color: var(--event-blue-bg);
    border-left: 4px solid var(--event-blue-border);
    color: var(--event-blue-text);
  }

  .event-purple {
    background-color: var(--event-purple-bg);
    border-left: 4px solid var(--event-purple-border);
    color: var(--event-purple-text);
  }

  .event-orange {
    background-color: var(--event-orange-bg);
    border-left: 4px solid var(--event-orange-border);
    color: var(--event-orange-text);
  }

  .event-green {
    background-color: var(--event-green-bg);
    border-left: 4px solid var(--event-green-border);
    color: var(--event-green-text);
  }

  .event-red {
    background-color: var(--event-red-bg);
    border-left: 4px solid var(--event-red-border);
    color: var(--event-red-text);
  }

  .event-yellow {
    background-color: var(--event-yellow-bg);
    border-left: 4px solid var(--event-yellow-border);
    color: var(--event-yellow-text);
  }

  .event-pink {
    background-color: var(--event-pink-bg);
    border-left: 4px solid var(--event-pink-border);
    color: var(--event-pink-text);
  }

  .event-teal {
    background-color: var(--event-teal-bg);
    border-left: 4px solid var(--event-teal-border);
    color: var(--event-teal-text);
  }
}
```

**Step 2: Verify classes work**

Create a test in browser console:
```js
document.body.innerHTML += '<div class="event-blue p-4 rounded-lg">Test Event</div>';
```
Expected: Blue-tinted card with left border appears

**Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add event color utility classes"
```

---

## Phase 4: Status Colors

### Task 4.1: Add Status Color Variables

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Add status color variables**

Add to both :root and .dark blocks:

```css
:root {
  /* ... existing variables ... */

  /* Status Colors */
  --status-success: oklch(0.65 0.15 145);
  --status-warning: oklch(0.75 0.15 55);
  --status-error: oklch(0.60 0.20 25);
  --status-info: oklch(0.60 0.15 240);
}

.dark {
  /* ... existing variables ... */

  /* Status Colors - same for dark mode */
  --status-success: oklch(0.65 0.15 145);
  --status-warning: oklch(0.75 0.15 55);
  --status-error: oklch(0.60 0.20 25);
  --status-info: oklch(0.60 0.15 240);
}
```

**Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add status color variables"
```

---

## Phase 5: Icons

### Task 5.1: Add Material Symbols Font

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Add Material Symbols link to head**

In the root layout, add the Material Symbols font. Since we're using next/font for other fonts, we need to add a link tag for Material Symbols.

Find the `<head>` or metadata section and add:

```tsx
export const metadata: Metadata = {
  // ... existing metadata
};

// Add this component or inline the link
function MaterialSymbolsFont() {
  return (
    <link
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
      rel="stylesheet"
    />
  );
}
```

In the `<head>` section of the HTML (may need to use next/head or metadata approach):

```tsx
<head>
  <link
    href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
    rel="stylesheet"
  />
</head>
```

**Step 2: Verify font loads**

Run: `pnpm dev`
Open: Network tab in DevTools
Expected: Material Symbols font file loads

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add Material Symbols Outlined font"
```

---

### Task 5.2: Create Icon Component

**Files:**
- Create: `src/components/ui/icon.tsx`

**Step 1: Create the Icon component**

```tsx
import { cn } from "@/lib/utils";

export interface IconProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Material Symbols icon name (e.g., "calendar_month", "settings") */
  name: string;
  /** Whether to use filled variant */
  filled?: boolean;
  /** Icon size: xs (14px), sm (18px), md (24px), lg (28px), xl (32px), 2xl (40px) */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
}

const sizeClasses = {
  xs: "text-[14px]",
  sm: "text-[18px]",
  md: "text-[24px]",
  lg: "text-[28px]",
  xl: "text-[32px]",
  "2xl": "text-[40px]",
};

export function Icon({
  name,
  filled = false,
  size = "md",
  className,
  ...props
}: IconProps) {
  return (
    <span
      className={cn(
        "material-symbols-outlined select-none",
        sizeClasses[size],
        className
      )}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
      {...props}
    >
      {name}
    </span>
  );
}
```

**Step 2: Add base styles to globals.css**

```css
@layer base {
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
}
```

**Step 3: Verify icon renders**

Create test usage:
```tsx
import { Icon } from "@/components/ui/icon";

<Icon name="calendar_month" />
<Icon name="settings" filled />
<Icon name="home" size="xl" />
```

Run: `pnpm dev`
Expected: Icons render correctly with proper sizing

**Step 4: Commit**

```bash
git add src/components/ui/icon.tsx src/app/globals.css
git commit -m "feat: create Icon component for Material Symbols"
```

---

### Task 5.3: Export Icon from UI Index

**Files:**
- Modify: `src/components/ui/index.ts` (if exists) or skip if no index file

**Step 1: Check if index file exists**

If `src/components/ui/index.ts` exists, add:

```ts
export * from "./icon";
```

If no index file, skip this task.

**Step 2: Commit (if changes made)**

```bash
git add src/components/ui/index.ts
git commit -m "feat: export Icon component from ui index"
```

---

## Phase 6: Button Hover States

### Task 6.1: Update Button Component for Brand Hover

**Files:**
- Modify: `src/components/ui/button.tsx`

**Step 1: Read current button implementation**

Understand the current button variants and how hover is handled.

**Step 2: Ensure primary variant uses primary-hover on hover**

The button should use CSS variables. If using Tailwind, add a custom hover color.

In globals.css, add utility:
```css
@layer utilities {
  .hover\:bg-primary-hover:hover {
    background-color: var(--primary-hover);
  }
}
```

Or update button.tsx default variant:
```tsx
default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
// Change to:
default: "bg-primary text-primary-foreground shadow-sm hover:opacity-90",
```

**Note:** The exact change depends on current implementation. The goal is that primary buttons darken slightly on hover (to #0fd683).

**Step 3: Add active scale**

Ensure buttons have `active:scale-95` for press feedback:

```tsx
const buttonVariants = cva(
  "... active:scale-95 transition-all duration-200 ...",
  // ...
);
```

**Step 4: Verify hover behavior**

Run: `pnpm dev`
Hover over primary button
Expected: Slightly darker green on hover, slight scale down on click

**Step 5: Commit**

```bash
git add src/components/ui/button.tsx src/app/globals.css
git commit -m "feat: add brand hover and active states to buttons"
```

---

## Phase 7: Animation Timing

### Task 7.1: Add Animation Utilities

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Add animation timing utilities**

```css
@layer utilities {
  /* Brand animation durations */
  .duration-fast {
    transition-duration: 150ms;
  }

  .duration-normal {
    transition-duration: 200ms;
  }

  .duration-slow {
    transition-duration: 300ms;
  }

  .duration-slower {
    transition-duration: 500ms;
  }

  /* Smooth color mode transition */
  .transition-colors-smooth {
    transition-property: background-color, border-color, color, fill, stroke;
    transition-timing-function: ease;
    transition-duration: 200ms;
  }
}
```

**Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add brand animation timing utilities"
```

---

## Phase 8: Verification

### Task 8.1: Visual Verification Checklist

**Files:** None (manual verification)

**Step 1: Start dev server**

Run: `pnpm dev`
Open: http://localhost:3000

**Step 2: Verify light mode**

Check these elements:
- [ ] Background is subtle green-gray (#f6f8f7)
- [ ] Primary buttons are bright green (#13ec92)
- [ ] Headings use Lexend font
- [ ] Body text uses Noto Sans font
- [ ] Card borders have green tint
- [ ] Focus rings are brand green

**Step 3: Verify dark mode**

Toggle to dark mode and check:
- [ ] Background is deep green-dark (#10221a)
- [ ] Primary color remains bright green
- [ ] Text is white/light
- [ ] Cards have dark green surface (#1c2e26)

**Step 4: Verify icons (if implemented)**

- [ ] Material Symbols render correctly
- [ ] Filled variant works
- [ ] Size variants work

**Step 5: Run linter**

Run: `pnpm lint`
Expected: No errors

**Step 6: Run build**

Run: `pnpm build`
Expected: Build succeeds

**Step 7: Commit verification**

```bash
git add -A
git commit -m "chore: complete brand guidelines implementation"
```

---

## Phase 9: Icon Migration (Optional - Large Task)

### Task 9.1: Identify Lucide Icon Usage

**Files:** Various component files

**Step 1: Search for Lucide imports**

Run: `grep -r "from 'lucide-react'" src/`
Or: `grep -r 'from "lucide-react"' src/`

Document all files using Lucide icons.

**Step 2: Create migration map**

Map common Lucide icons to Material Symbols equivalents:

| Lucide | Material Symbol |
|--------|-----------------|
| Plus | add |
| X | close |
| ChevronLeft | chevron_left |
| ChevronRight | chevron_right |
| Check | check |
| Settings | settings |
| Calendar | calendar_month |
| Clock | schedule |
| Home | home |
| User | person |
| Users | group |
| Bell | notifications |
| Search | search |
| Menu | menu |
| MoreHorizontal | more_horiz |
| MoreVertical | more_vert |
| Edit | edit |
| Trash | delete |
| Save | save |
| Download | download |
| Upload | upload |
| Eye | visibility |
| EyeOff | visibility_off |
| Lock | lock |
| Unlock | lock_open |
| Mail | mail |
| Phone | phone |
| MapPin | location_on |
| Star | star |
| Heart | favorite |

**Step 3: Migrate one component at a time**

For each component:
1. Replace `import { IconName } from "lucide-react"` with `import { Icon } from "@/components/ui/icon"`
2. Replace `<IconName className="..." />` with `<Icon name="icon_name" className="..." />`

**Step 4: Commit after each component**

```bash
git add src/components/path/to/component.tsx
git commit -m "refactor: migrate ComponentName from Lucide to Material Symbols"
```

---

## Summary

| Phase | Tasks | Estimated Steps |
|-------|-------|-----------------|
| 1. Typography | 2 | 8 |
| 2. Color System | 4 | 20 |
| 3. Event Colors | 2 | 8 |
| 4. Status Colors | 1 | 3 |
| 5. Icons | 3 | 12 |
| 6. Button States | 1 | 5 |
| 7. Animation | 1 | 3 |
| 8. Verification | 1 | 7 |
| 9. Icon Migration | Optional | Varies |

**Total: 15 tasks, ~66 steps (excluding optional icon migration)**

---

## Reference Files

- Brand Guidelines: `docs/brand-guideline.md`
- Current globals.css: `src/app/globals.css`
- Current layout.tsx: `src/app/layout.tsx`
- Button component: `src/components/ui/button.tsx`
