# Full-Calendar Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate the full-calendar component from yassir-jeraidi/full-calendar into the Family Planner project with all source code local and customizable.

**Architecture:** Install via shadcn registry which copies all source files locally (not node_modules). The calendar uses React Context for state management, supports multiple views (Day/Week/Month/Year/Agenda), and includes drag-and-drop functionality.

**Tech Stack:** Next.js 16, React 19, shadcn/ui (new-york style), Tailwind CSS 4, TypeScript, date-fns, motion, react-hook-form, zod

---

## Task 1: Install shadcn Base Components

**Files:**

- Create: `src/components/ui/*.tsx` (multiple files auto-generated)
- Modify: `package.json` (dependencies added automatically)

**Step 1: Install all required shadcn components**

Run:

```bash
pnpm dlx shadcn@latest add alert-dialog avatar badge button calendar command dialog dropdown-menu form input label popover scroll-area select skeleton switch textarea toggle tooltip tabs
```

Expected: Components installed to `src/components/ui/`, dependencies added to package.json

**Step 2: Verify installation**

Run:

```bash
ls src/components/ui/ | head -20
```

Expected: Multiple `.tsx` files (alert-dialog.tsx, avatar.tsx, button.tsx, etc.)

**Step 3: Commit base components**

Run:

```bash
git add src/components/ui/ package.json pnpm-lock.yaml
git commit -m "feat: add shadcn base components for calendar"
```

---

## Task 2: Install Full-Calendar via Registry

**Files:**

- Create: `src/components/calendar/**/*` (full calendar system)
- Create: `src/components/ui/avatar-group.tsx`
- Create: `src/components/ui/day-picker.tsx`
- Create: `src/components/ui/date-time-picker.tsx`
- Create: `src/components/ui/responsive-modal.tsx`
- Create: `src/components/ui/button-group.tsx`
- Modify: `package.json`

**Step 1: Install full-calendar from registry**

Run:

```bash
pnpm dlx shadcn@latest add "https://calendar.jeraidi.tech/r/full-calendar.json"
```

Expected: Calendar components copied to `src/components/calendar/` with contexts, views, dialogs, dnd, etc.

**Step 2: Verify calendar structure**

Run:

```bash
find src/components/calendar -type f -name "*.tsx" | head -20
```

Expected: Files including `calendar.tsx`, `calendar-body.tsx`, `contexts/calendar-context.tsx`, `views/*.tsx`

**Step 3: Commit calendar components**

Run:

```bash
git add src/components/
git commit -m "feat: add full-calendar component from registry"
```

---

## Task 3: Install npm Dependencies

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Step 1: Install required packages**

Run:

```bash
pnpm add motion date-fns re-resizable zod react-hook-form @hookform/resolvers sonner next-themes
```

Expected: Packages added to dependencies in package.json

**Step 2: Verify dependencies**

Run:

```bash
pnpm ls motion date-fns re-resizable sonner next-themes
```

Expected: All packages listed with versions

**Step 3: Commit dependencies**

Run:

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add calendar npm dependencies"
```

---

## Task 4: Configure Theme Provider

**Files:**

- Modify: `src/app/layout.tsx`

**Step 1: Read current layout**

Run:

```bash
cat src/app/layout.tsx
```

**Step 2: Update layout with ThemeProvider**

Replace the body content in `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Family Planner",
  description: "Family organizational hub with calendar and tasks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**Step 3: Verify no TypeScript errors**

Run:

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: No errors related to layout.tsx

**Step 4: Commit theme setup**

Run:

```bash
git add src/app/layout.tsx
git commit -m "feat: add ThemeProvider and Toaster to layout"
```

---

## Task 5: Create Calendar Demo Page

**Files:**

- Create: `src/app/calendar/page.tsx`

**Step 1: Create calendar route directory**

Run:

```bash
mkdir -p src/app/calendar
```

**Step 2: Write the calendar page**

Create `src/app/calendar/page.tsx`:

```tsx
import { Calendar } from "@/components/calendar/calendar";

export default function CalendarPage() {
  return (
    <main className="bg-background min-h-screen">
      <Calendar />
    </main>
  );
}
```

**Step 3: Verify no TypeScript errors**

Run:

```bash
pnpm tsc --noEmit 2>&1 | grep -i calendar || echo "No calendar errors"
```

Expected: No errors

**Step 4: Commit demo page**

Run:

```bash
git add src/app/calendar/
git commit -m "feat: add calendar demo page"
```

---

## Task 6: Verify Development Server

**Files:** None (verification only)

**Step 1: Start dev server**

Run:

```bash
pnpm dev &
sleep 5
```

**Step 2: Test calendar page loads**

Run:

```bash
curl -s http://localhost:3000/calendar | head -50
```

Expected: HTML content without error messages

**Step 3: Stop dev server**

Run:

```bash
pkill -f "next dev" || true
```

---

## Task 7: Fix Any Import/Path Issues (if needed)

**Files:**

- Potentially: `src/components/calendar/**/*.tsx`

**Step 1: Check for import errors**

Run:

```bash
pnpm build 2>&1 | grep -i "error\|cannot find" | head -20
```

**Step 2: If errors exist, fix imports**

Common fixes:

- Update `@/components/ui/` paths if components are named differently
- Ensure all shadcn components referenced exist

**Step 3: Commit fixes (if any)**

Run:

```bash
git add -A
git commit -m "fix: resolve calendar import issues" || echo "No fixes needed"
```

---

## Task 8: Add Home Page Link to Calendar

**Files:**

- Modify: `src/app/page.tsx`

**Step 1: Update home page with calendar link**

Replace `src/app/page.tsx`:

```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="bg-background flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-4xl font-bold">Family Planner</h1>
      <p className="text-muted-foreground">
        Your family&apos;s organizational hub
      </p>
      <Link
        href="/calendar"
        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-6 py-3"
      >
        Open Calendar
      </Link>
    </main>
  );
}
```

**Step 2: Commit home page update**

Run:

```bash
git add src/app/page.tsx
git commit -m "feat: add calendar link to home page"
```

---

## Task 9: Final Verification

**Files:** None (verification only)

**Step 1: Run full build**

Run:

```bash
pnpm build
```

Expected: Build completes successfully

**Step 2: Run linting**

Run:

```bash
pnpm lint
```

Expected: No errors (warnings acceptable)

**Step 3: Run type check**

Run:

```bash
pnpm tsc --noEmit
```

Expected: No errors

**Step 4: Commit any final fixes**

Run:

```bash
git add -A
git commit -m "chore: fix lint and type issues" || echo "No fixes needed"
```

---

## Verification Checklist

After completing all tasks, manually verify:

- [ ] Navigate to `/calendar` - page loads without errors
- [ ] Month view displays correctly with mock events
- [ ] Can switch between Day, Week, Month, Year, Agenda views
- [ ] Drag-and-drop works (move an event)
- [ ] Dark mode toggle works
- [ ] Event creation dialog opens
- [ ] Mobile responsive layout works

---

## Fallback: Manual Clone (if registry fails at Task 2)

If registry install fails, use this alternative:

```bash
# Clone to temp
git clone --depth 1 https://github.com/yassir-jeraidi/full-calendar.git /tmp/full-calendar

# Copy components
cp -r /tmp/full-calendar/src/modules/components/calendar src/components/

# Copy custom UI components if they exist
cp -r /tmp/full-calendar/src/components/ui/* src/components/ui/ 2>/dev/null || true

# Clean up
rm -rf /tmp/full-calendar
```

Then fix imports manually and continue from Task 3.
