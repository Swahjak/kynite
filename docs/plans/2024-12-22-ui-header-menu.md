# UI Header & Navigation Menu Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the App Header and Navigation Menu with dual-mode support (Wall Display vs Management) as specified in `docs/features/ui/`.

**Architecture:** Route groups `(wall)/` and `(manage)/` determine interaction mode. Each group has its own layout that renders the appropriate header variant. The Navigation Menu is a Sheet component triggered from the Brand Area (wall) or avatar (manage). Shared components live in `src/components/layout/`.

**Tech Stack:** Next.js 16, React 19, shadcn/ui (Sheet, Button, Avatar), next-intl, better-auth, Lucide icons

---

## Task 1: Install Sheet Component

**Files:**
- Create: `src/components/ui/sheet.tsx` (via shadcn CLI)

**Step 1: Install shadcn Sheet component**

Run:
```bash
pnpm dlx shadcn@latest add sheet
```

Expected: Creates `src/components/ui/sheet.tsx`

**Step 2: Verify installation**

Run:
```bash
ls src/components/ui/sheet.tsx
```

Expected: File exists

**Step 3: Commit**

```bash
git add src/components/ui/sheet.tsx
git commit -m "chore: add shadcn sheet component"
```

---

## Task 2: Add Translation Keys

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/nl.json`

**Step 1: Add English translations**

Add to `messages/en.json` (merge with existing):

```json
{
  "Header": {
    "brand": "Family Planner",
    "tagline": "FAMILY OS",
    "addEvent": "Add Event"
  },
  "Menu": {
    "calendar": "Calendar",
    "chores": "Chores",
    "settings": "Settings",
    "help": "Help"
  }
}
```

**Step 2: Add Dutch translations**

Add to `messages/nl.json` (merge with existing):

```json
{
  "Header": {
    "brand": "Family Planner",
    "tagline": "FAMILIE OS",
    "addEvent": "Afspraak toevoegen"
  },
  "Menu": {
    "calendar": "Kalender",
    "chores": "Taken",
    "settings": "Instellingen",
    "help": "Help"
  }
}
```

**Step 3: Verify translations load**

Run:
```bash
pnpm dev
```

Check browser console for translation errors.

**Step 4: Commit**

```bash
git add messages/en.json messages/nl.json
git commit -m "feat(i18n): add header and menu translations"
```

---

## Task 3: Create InteractionMode Context

**Files:**
- Create: `src/contexts/interaction-mode-context.tsx`
- Test: `src/contexts/__tests__/interaction-mode-context.test.tsx`

**Step 1: Write the failing test**

Create `src/contexts/__tests__/interaction-mode-context.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  InteractionModeProvider,
  useInteractionMode,
} from "../interaction-mode-context";

function TestComponent() {
  const { mode } = useInteractionMode();
  return <div data-testid="mode">{mode}</div>;
}

describe("InteractionModeContext", () => {
  it("provides wall mode when specified", () => {
    render(
      <InteractionModeProvider mode="wall">
        <TestComponent />
      </InteractionModeProvider>
    );
    expect(screen.getByTestId("mode")).toHaveTextContent("wall");
  });

  it("provides manage mode when specified", () => {
    render(
      <InteractionModeProvider mode="manage">
        <TestComponent />
      </InteractionModeProvider>
    );
    expect(screen.getByTestId("mode")).toHaveTextContent("manage");
  });

  it("throws error when used outside provider", () => {
    // Suppress console.error for this test
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => render(<TestComponent />)).toThrow(
      "useInteractionMode must be used within InteractionModeProvider"
    );

    consoleSpy.mockRestore();
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
pnpm test src/contexts/__tests__/interaction-mode-context.test.tsx
```

Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/contexts/interaction-mode-context.tsx`:

```tsx
"use client";

import { createContext, useContext, type ReactNode } from "react";

export type InteractionMode = "wall" | "manage";

interface InteractionModeContextValue {
  mode: InteractionMode;
}

const InteractionModeContext = createContext<InteractionModeContextValue | null>(
  null
);

interface InteractionModeProviderProps {
  mode: InteractionMode;
  children: ReactNode;
}

export function InteractionModeProvider({
  mode,
  children,
}: InteractionModeProviderProps) {
  return (
    <InteractionModeContext.Provider value={{ mode }}>
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
```

**Step 4: Run test to verify it passes**

Run:
```bash
pnpm test src/contexts/__tests__/interaction-mode-context.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/contexts/
git commit -m "feat: add InteractionMode context for wall/manage modes"
```

---

## Task 4: Create Brand Area Component

**Files:**
- Create: `src/components/layout/brand-area.tsx`
- Test: `src/components/layout/__tests__/brand-area.test.tsx`

**Step 1: Write the failing test**

Create `src/components/layout/__tests__/brand-area.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { BrandArea } from "../brand-area";

const messages = {
  Header: {
    brand: "Family Planner",
    tagline: "FAMILY OS",
  },
};

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {ui}
    </NextIntlClientProvider>
  );
}

describe("BrandArea", () => {
  it("renders brand name and tagline", () => {
    renderWithProviders(<BrandArea />);

    expect(screen.getByText("Family Planner")).toBeInTheDocument();
    expect(screen.getByText("FAMILY OS")).toBeInTheDocument();
  });

  it("renders home icon in circular container", () => {
    renderWithProviders(<BrandArea />);

    const icon = screen.getByTestId("brand-icon");
    expect(icon).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
pnpm test src/components/layout/__tests__/brand-area.test.tsx
```

Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/components/layout/brand-area.tsx`:

```tsx
import { Home } from "lucide-react";
import { useTranslations } from "next-intl";

export function BrandArea() {
  const t = useTranslations("Header");

  return (
    <div className="flex items-center gap-3">
      <div
        data-testid="brand-icon"
        className="flex size-12 items-center justify-center rounded-full bg-primary"
      >
        <Home className="size-6 text-primary-foreground" />
      </div>
      <div className="flex flex-col">
        <span className="font-display text-xl font-bold">{t("brand")}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-primary">
          {t("tagline")}
        </span>
      </div>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
pnpm test src/components/layout/__tests__/brand-area.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/layout/
git commit -m "feat: add BrandArea component"
```

---

## Task 5: Create Navigation Menu Component

**Files:**
- Create: `src/components/layout/navigation-menu.tsx`
- Test: `src/components/layout/__tests__/navigation-menu.test.tsx`

**Step 1: Write the failing test**

Create `src/components/layout/__tests__/navigation-menu.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { NavigationMenu } from "../navigation-menu";
import {
  InteractionModeProvider,
  type InteractionMode,
} from "@/contexts/interaction-mode-context";

const messages = {
  Header: { brand: "Family Planner", tagline: "FAMILY OS" },
  Menu: {
    calendar: "Calendar",
    chores: "Chores",
    settings: "Settings",
    help: "Help",
  },
};

function renderWithProviders(
  ui: React.ReactElement,
  mode: InteractionMode = "manage"
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <InteractionModeProvider mode={mode}>
        {ui}
      </InteractionModeProvider>
    </NextIntlClientProvider>
  );
}

describe("NavigationMenu", () => {
  it("renders all items in manage mode", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <NavigationMenu open={true} onOpenChange={() => {}} />
    );

    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("Chores")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();
  });

  it("hides chores and settings in wall mode", () => {
    renderWithProviders(
      <NavigationMenu open={true} onOpenChange={() => {}} />,
      "wall"
    );

    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.queryByText("Chores")).not.toBeInTheDocument();
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    expect(screen.getByText("Help")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
pnpm test src/components/layout/__tests__/navigation-menu.test.tsx
```

Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/components/layout/navigation-menu.tsx`:

```tsx
"use client";

import { Calendar, CheckSquare, Settings, HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { BrandArea } from "./brand-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface NavigationMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey: "calendar" | "chores" | "settings" | "help";
  manageOnly?: boolean;
}

const navItems: NavItem[] = [
  { href: "/calendar", icon: Calendar, labelKey: "calendar" },
  { href: "/chores", icon: CheckSquare, labelKey: "chores", manageOnly: true },
  { href: "/settings", icon: Settings, labelKey: "settings", manageOnly: true },
];

export function NavigationMenu({ open, onOpenChange }: NavigationMenuProps) {
  const t = useTranslations("Menu");
  const pathname = usePathname();
  const { mode } = useInteractionMode();

  const filteredItems = navItems.filter(
    (item) => !item.manageOnly || mode === "manage"
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
          <BrandArea />
        </SheetHeader>

        <nav className="flex flex-1 flex-col">
          <ul className="flex-1 space-y-1 p-2">
            {filteredItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex h-12 items-center gap-3 rounded-md px-4 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <Icon className="size-5" />
                    {t(item.labelKey)}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="border-t p-2">
            <button
              className="flex h-12 w-full items-center gap-3 rounded-md px-4 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                // TODO: Open help modal
                onOpenChange(false);
              }}
            >
              <HelpCircle className="size-5" />
              {t("help")}
            </button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
pnpm test src/components/layout/__tests__/navigation-menu.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/layout/navigation-menu.tsx src/components/layout/__tests__/navigation-menu.test.tsx
git commit -m "feat: add NavigationMenu sheet component"
```

---

## Task 6: Create App Header Component

**Files:**
- Create: `src/components/layout/app-header.tsx`
- Test: `src/components/layout/__tests__/app-header.test.tsx`

**Step 1: Write the failing test**

Create `src/components/layout/__tests__/app-header.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { AppHeader } from "../app-header";
import { InteractionModeProvider } from "@/contexts/interaction-mode-context";

// Mock useSession from better-auth
vi.mock("@/lib/auth-client", () => ({
  useSession: () => ({
    data: {
      user: { name: "Test User", email: "test@example.com", image: null },
    },
    isPending: false,
  }),
}));

const messages = {
  Header: { brand: "Family Planner", tagline: "FAMILY OS", addEvent: "Add Event" },
  Menu: { calendar: "Calendar", chores: "Chores", settings: "Settings", help: "Help" },
};

function renderWithProviders(mode: "wall" | "manage" = "manage") {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <InteractionModeProvider mode={mode}>
        <AppHeader />
      </InteractionModeProvider>
    </NextIntlClientProvider>
  );
}

describe("AppHeader", () => {
  it("shows add event button in manage mode", () => {
    renderWithProviders("manage");
    expect(screen.getByRole("button", { name: /add event/i })).toBeInTheDocument();
  });

  it("hides add event button in wall mode", () => {
    renderWithProviders("wall");
    expect(screen.queryByRole("button", { name: /add event/i })).not.toBeInTheDocument();
  });

  it("shows avatar in manage mode", () => {
    renderWithProviders("manage");
    expect(screen.getByTestId("user-avatar")).toBeInTheDocument();
  });

  it("hides avatar in wall mode", () => {
    renderWithProviders("wall");
    expect(screen.queryByTestId("user-avatar")).not.toBeInTheDocument();
  });

  it("renders brand area", () => {
    renderWithProviders("manage");
    expect(screen.getByText("Family Planner")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run:
```bash
pnpm test src/components/layout/__tests__/app-header.test.tsx
```

Expected: FAIL - module not found

**Step 3: Write minimal implementation**

Create `src/components/layout/app-header.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Menu, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/lib/auth-client";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandArea } from "./brand-area";
import { NavigationMenu } from "./navigation-menu";

interface AppHeaderProps {
  onAddEvent?: () => void;
}

export function AppHeader({ onAddEvent }: AppHeaderProps) {
  const t = useTranslations("Header");
  const { mode } = useInteractionMode();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const user = session?.user;
  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isManageMode = mode === "manage";

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b bg-background px-4">
        {/* Left: Menu trigger + Brand */}
        <div className="flex items-center gap-2">
          {isManageMode && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>
          )}

          <button
            onClick={() => !isManageMode && setMenuOpen(true)}
            className={cn(
              "flex items-center",
              !isManageMode && "cursor-pointer"
            )}
            disabled={isManageMode}
          >
            <BrandArea />
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {isManageMode && (
            <>
              {/* Add Event Button */}
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

              {/* User Avatar */}
              {user && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  data-testid="user-avatar"
                >
                  <Avatar className="size-9">
                    <AvatarImage
                      src={user.image || undefined}
                      alt={user.name || "User"}
                    />
                    <AvatarFallback>{initials || "U"}</AvatarFallback>
                  </Avatar>
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      <NavigationMenu open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  );
}
```

**Step 4: Run test to verify it passes**

Run:
```bash
pnpm test src/components/layout/__tests__/app-header.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/components/layout/app-header.tsx src/components/layout/__tests__/app-header.test.tsx
git commit -m "feat: add AppHeader with dual-mode support"
```

---

## Task 7: Create Route Group Layouts

**Files:**
- Create: `src/app/[locale]/(manage)/layout.tsx`
- Create: `src/app/[locale]/(wall)/layout.tsx`
- Move: `src/app/[locale]/calendar/page.tsx` to `src/app/[locale]/(manage)/calendar/page.tsx`

**Step 1: Create manage layout**

Create `src/app/[locale]/(manage)/layout.tsx`:

```tsx
import { InteractionModeProvider } from "@/contexts/interaction-mode-context";

export default function ManageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InteractionModeProvider mode="manage">
      {children}
    </InteractionModeProvider>
  );
}
```

**Step 2: Create wall layout**

Create `src/app/[locale]/(wall)/layout.tsx`:

```tsx
import { InteractionModeProvider } from "@/contexts/interaction-mode-context";

export default function WallLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InteractionModeProvider mode="wall">
      {children}
    </InteractionModeProvider>
  );
}
```

**Step 3: Move calendar page to manage group**

Run:
```bash
mkdir -p src/app/[locale]/(manage)/calendar
mv src/app/[locale]/calendar/page.tsx src/app/[locale]/(manage)/calendar/page.tsx
```

**Step 4: Verify routes work**

Run:
```bash
pnpm dev
```

Navigate to `http://localhost:3000/en/calendar` - should still work.

**Step 5: Commit**

```bash
git add src/app/[locale]/\(manage\)/ src/app/[locale]/\(wall\)/
git commit -m "feat: add route group layouts for wall/manage modes"
```

---

## Task 8: Integrate Header with Calendar Page

**Files:**
- Modify: `src/app/[locale]/(manage)/calendar/page.tsx`

**Step 1: Update calendar page to use AppHeader**

Wrap the calendar page content with AppHeader. The AddEditEventDialog should be triggered from the header's onAddEvent callback.

Read the current implementation first, then integrate AppHeader above the CalendarHeader.

**Step 2: Verify integration**

Run:
```bash
pnpm dev
```

Navigate to calendar, verify:
- App Header appears at top
- Brand area visible
- Add Event button visible
- Avatar visible (when logged in)
- Menu opens when clicking hamburger icon

**Step 3: Commit**

```bash
git add src/app/[locale]/\(manage\)/calendar/page.tsx
git commit -m "feat: integrate AppHeader with calendar page"
```

---

## Task 9: Create Wall Display Calendar Page

**Files:**
- Create: `src/app/[locale]/(wall)/calendar/page.tsx`

**Step 1: Create wall mode calendar page**

Create `src/app/[locale]/(wall)/calendar/page.tsx`:

```tsx
import { AppHeader } from "@/components/layout/app-header";
// Import existing calendar components

export default function WallCalendarPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="flex-1">
        {/* Calendar view - read-only */}
      </main>
    </div>
  );
}
```

**Step 2: Verify wall mode**

Navigate to a wall-specific route (may need to configure routing).

**Step 3: Commit**

```bash
git add src/app/[locale]/\(wall\)/calendar/
git commit -m "feat: add wall display calendar page"
```

---

## Task 10: Add User Menu to Header

**Files:**
- Modify: `src/components/layout/app-header.tsx`

**Step 1: Integrate existing UserMenu component**

Replace the basic avatar button with the existing `UserMenu` component from `src/components/auth/user-menu.tsx`.

Update import:
```tsx
import { UserMenu } from "@/components/auth/user-menu";
```

Replace avatar button with:
```tsx
{user && (
  <UserMenu
    user={{
      name: user.name || "User",
      email: user.email || "",
      image: user.image,
    }}
  />
)}
```

**Step 2: Verify user menu works**

Run:
```bash
pnpm dev
```

Click avatar, verify dropdown appears with settings and logout options.

**Step 3: Commit**

```bash
git add src/components/layout/app-header.tsx
git commit -m "feat: integrate UserMenu dropdown in AppHeader"
```

---

## Task 11: Run Full Test Suite & Lint

**Step 1: Run all tests**

Run:
```bash
pnpm test:run
```

Expected: All tests pass

**Step 2: Run linter**

Run:
```bash
pnpm lint
```

Expected: No errors

**Step 3: Fix any issues**

If tests or lint fail, fix issues and re-run.

**Step 4: Final commit**

```bash
git add .
git commit -m "chore: fix lint and test issues"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Install Sheet component | `src/components/ui/sheet.tsx` |
| 2 | Add translation keys | `messages/*.json` |
| 3 | Create InteractionMode context | `src/contexts/interaction-mode-context.tsx` |
| 4 | Create Brand Area | `src/components/layout/brand-area.tsx` |
| 5 | Create Navigation Menu | `src/components/layout/navigation-menu.tsx` |
| 6 | Create App Header | `src/components/layout/app-header.tsx` |
| 7 | Create route group layouts | `src/app/[locale]/(manage|wall)/layout.tsx` |
| 8 | Integrate with calendar | `src/app/[locale]/(manage)/calendar/page.tsx` |
| 9 | Wall display page | `src/app/[locale]/(wall)/calendar/page.tsx` |
| 10 | Add UserMenu | `src/components/layout/app-header.tsx` |
| 11 | Final verification | All files |

**Out of scope (Phase 2):**
- Weather widget
- Notifications badge
- Help modal implementation
