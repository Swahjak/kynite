# Navigation Menu Specification

## Overview

The navigation menu is a slide-out drawer (Sheet) triggered from the header. It provides primary navigation for the application with role-based visibility.

**Location:** `src/components/layout/navigation-menu.tsx`

---

## Navigation Items

| Item         | Icon (Lucide)   | Route           | All Users | Manager Only |
| ------------ | --------------- | --------------- | --------- | ------------ |
| Dashboard    | LayoutDashboard | /dashboard      | Yes       | No           |
| Calendar     | Calendar        | /calendar/today | Yes       | No           |
| Chores       | CheckSquare     | /chores         | No        | Yes          |
| Timers       | Timer           | /timers         | No        | Yes          |
| Reward Chart | Star            | /reward-chart   | Yes       | No           |
| Rewards      | Gift            | /rewards        | Yes       | No           |
| Settings     | Settings        | /settings       | No        | Yes          |
| Help         | HelpCircle      | /help/:locale   | Yes       | No           |

### Access Control

Navigation items are filtered based on the `useIsManager()` hook:

- **Managers:** See all navigation items
- **Participants/Devices:** See Dashboard, Calendar, Reward Chart, Rewards, and Help only

---

## Component Interface

```typescript
interface NavigationMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  labelKey:
    | "dashboard"
    | "calendar"
    | "chores"
    | "timers"
    | "rewardChart"
    | "rewards"
    | "settings"
    | "help";
  manageOnly?: boolean;
}
```

---

## Anatomy

```
+-----------------------------+
| Sheet Header                |
|   BrandArea component       |
+-----------------------------+
| Navigation List             |
|   * Dashboard               |
|   * Calendar                |
|   * Chores      (mgmt)      |
|   * Timers      (mgmt)      |
|   * Reward Chart            |
|   * Rewards                 |
|   * Settings    (mgmt)      |
+-----------------------------+
| Footer (border-top)         |
|   * Help                    |
+-----------------------------+
```

---

## Components

### Menu Container (Sheet)

Uses shadcn/ui Sheet component for slide-out drawer behavior.

| Property  | Value                     |
| --------- | ------------------------- |
| Width     | 256px (w-64)              |
| Height    | 100vh                     |
| Position  | Left side                 |
| Padding   | p-0 (managed per section) |
| Animation | Built-in Sheet animation  |

### Sheet Header

| Property | Value                       |
| -------- | --------------------------- |
| Border   | border-b                    |
| Padding  | p-4                         |
| Title    | "Navigation Menu" (sr-only) |
| Content  | BrandArea component         |

### Navigation List

| Property | Value            |
| -------- | ---------------- |
| Element  | ul with li items |
| Spacing  | space-y-1        |
| Padding  | p-2              |

### Navigation Item

| State    | Background  | Text                    |
| -------- | ----------- | ----------------------- |
| Active   | bg-primary  | text-primary-foreground |
| Inactive | Transparent | text-muted-foreground   |
| Hover    | bg-accent   | text-accent-foreground  |

| Property      | Value               |
| ------------- | ------------------- |
| Height        | 48px (h-12)         |
| Padding       | px-4                |
| Icon size     | 20px (size-5)       |
| Gap           | 12px (gap-3)        |
| Border radius | rounded-md          |
| Font          | text-sm font-medium |

### Footer Section

| Property | Value                       |
| -------- | --------------------------- |
| Border   | border-t                    |
| Padding  | p-2                         |
| Content  | Help link (external anchor) |

---

## Route Handling

- All internal routes use `ProgressLink` component for navigation progress indicator
- Help link uses a standard anchor (`<a>`) to `/help/:locale` (locale from useLocale)
- Active state determined by comparing current pathname with item href
- Menu closes automatically when any navigation item is clicked

---

## Accessibility

- Tab navigation between items
- Enter/Space to activate links
- Escape to close sheet
- Focus trapped while open (Sheet behavior)
- `aria-current="page"` on active item
- Screen reader accessible title via SheetTitle (sr-only)

---

## Internationalization

Labels are translated using `useTranslations("Menu")` hook:

```json
{
  "Menu": {
    "dashboard": "Dashboard",
    "calendar": "Calendar",
    "chores": "Chores",
    "timers": "Timers",
    "rewardChart": "Reward Chart",
    "rewards": "Rewards",
    "settings": "Settings",
    "help": "Help"
  }
}
```

---

## Integration with AppShell

The NavigationMenu is managed by the AppShell component:

```typescript
// src/components/layout/app-shell.tsx
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

---

## Implementation Notes

- **Locale handling:** Routes prefixed with `[locale]` via next-intl (e.g., `/en/calendar/today`)
- **Role detection:** Uses `useIsManager()` hook to filter navigation items
- **State management:** Menu open state managed by parent AppShell
- **Components:** Uses shadcn/ui Sheet from `src/components/ui/`
- **Navigation progress:** ProgressLink shows loading indicator during navigation

---

## Related Files

- `src/components/layout/app-shell.tsx` - Parent component managing menu state
- `src/components/layout/app-header.tsx` - Header with menu trigger button
- `src/components/layout/brand-area.tsx` - Brand display in sheet header
- `src/components/ui/progress-link.tsx` - Navigation link with progress indicator
- `src/hooks/use-is-manager.ts` - Manager role detection hook

---

## Design Reference

See `docs/design/ui/menu/` for visual mockups.
