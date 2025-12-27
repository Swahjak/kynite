# App Header Specification

## Overview

The App Header is the primary navigation bar that appears at the top of every authenticated screen. It provides access to the navigation menu, displays branding, current time, help resources, and user account controls.

**Location:** `src/components/layout/app-header.tsx`

---

## Header Elements

| Element      | Visible | Manager Only | Status |
| ------------ | ------- | ------------ | ------ |
| Menu Trigger | Yes     | No           | MVP    |
| Brand Area   | Yes     | No           | MVP    |
| Current Time | Yes     | No           | MVP    |
| Help Link    | Yes     | No           | MVP    |
| User Menu    | Yes     | Yes          | MVP    |

### Layout Structure

The header is divided into three sections:

1. **Left Section** (flex-1): Menu trigger + Brand area
2. **Center Section** (flex-1): Current time (hidden on mobile)
3. **Right Section** (flex-1): Help link + User menu

---

## Components

### AppHeader

Main header component that orchestrates all header elements.

```typescript
interface AppHeaderProps {
  onMenuToggle?: () => void;
}
```

| Element      | Description                                      |
| ------------ | ------------------------------------------------ |
| Menu button  | Ghost button with Menu icon, triggers navigation |
| Brand area   | Logo and family name                             |
| Current time | Live clock (hidden < 640px)                      |
| Help link    | Context-aware help icon with tooltip             |
| User menu    | Avatar dropdown (managers only)                  |

### BrandArea

Displays the application logo and branding.

**Location:** `src/components/layout/brand-area.tsx`

| Element        | Specification                                |
| -------------- | -------------------------------------------- |
| Icon container | 48x48px, Next.js Image component             |
| Logo           | /images/logo-icon.svg                        |
| Title          | Translated "Kynite", 20px Bold, display font |
| Tagline        | Translated tagline, 12px, primary color      |

### CurrentTime

Live-updating clock display that respects user preferences.

**Location:** `src/components/layout/current-time.tsx`

| Property    | Specification                              |
| ----------- | ------------------------------------------ |
| Format      | 24-hour or 12-hour (from user preferences) |
| Update rate | Every 1 second                             |
| Font        | 18px SemiBold, tabular-nums                |
| Visibility  | Hidden on mobile (< 640px)                 |
| SSR         | Uses suppressHydrationWarning              |

### HelpLink

Context-aware help icon that links to documentation.

**Location:** `src/components/ui/help-link.tsx`

```typescript
interface HelpLinkProps {
  page?: "getting-started" | "calendar" | "chores" | "rewards" | "wall-hub";
  section?: string;
  variant?: "icon" | "text";
  className?: string;
  label?: string;
}
```

| Property | Description                           |
| -------- | ------------------------------------- |
| page     | Optional target help page             |
| section  | Optional anchor for deep linking      |
| variant  | Icon-only (default) or text with icon |
| Tooltip  | Shows translated help page name       |

### UserMenu

Dropdown menu for user account actions (managers only).

**Location:** `src/components/auth/user-menu.tsx`

```typescript
interface UserMenuProps {
  user: {
    name: string;
    email: string;
    image?: string | null;
  };
}
```

| Menu Item   | Description                     |
| ----------- | ------------------------------- |
| User info   | Name and email display          |
| Settings    | Navigate to /settings           |
| Theme       | Cycle through system/light/dark |
| Language    | Toggle between nl/en locales    |
| Time format | Switch between 24h/12h format   |
| Logout      | Sign out and redirect to login  |

---

## Calendar Header (Subcomponent)

The calendar page has its own header with additional controls.

**Location:** `src/components/calendar/header/calendar-header.tsx`

| Element              | Description                                   |
| -------------------- | --------------------------------------------- |
| Today button         | Navigate to current date                      |
| Date navigator       | Previous/next date navigation                 |
| Filter events        | Event type filtering                          |
| View tabs            | Day/week/month/year/agenda view selection     |
| User select          | Filter by family member (managers only)       |
| Sync error indicator | Warning icon when Google accounts have errors |
| Language switcher    | Quick locale toggle                           |
| Settings             | Calendar-specific settings (managers only)    |

### Sync Error Indicator

Displays a warning when linked Google accounts have sync errors.

| Property | Specification                                   |
| -------- | ----------------------------------------------- |
| Icon     | AlertTriangle (Lucide), destructive color       |
| Trigger  | useAccountErrors() hook returns hasErrors: true |
| Tooltip  | Translated sync error title and hint            |

---

## Access Control

The header uses the `useIsManager()` hook to determine visibility of manager-only elements:

```typescript
function useIsManager(): boolean {
  // Returns true if:
  // - User has a session
  // - User is NOT a device
  // - User's memberRole is "manager"
}
```

| User Type   | Menu | Time | Help | User Menu |
| ----------- | ---- | ---- | ---- | --------- |
| Manager     | Yes  | Yes  | Yes  | Yes       |
| Participant | Yes  | Yes  | Yes  | No        |
| Device      | Yes  | Yes  | Yes  | No        |

---

## Responsive Behavior

| Breakpoint | Changes                            |
| ---------- | ---------------------------------- |
| < 640px    | Current time hidden                |
| >= 640px   | Current time visible in center     |
| All sizes  | Header height fixed at 64px (h-16) |

---

## Styling

| Property   | Value                               |
| ---------- | ----------------------------------- |
| Height     | 64px (h-16)                         |
| Background | bg-background                       |
| Border     | border-b (bottom border)            |
| Padding    | px-4                                |
| Layout     | flex, items-center, justify-between |

---

## Implementation Notes

- **Locale handling:** Uses next-intl for translations and useLocale for locale-aware help links
- **State management:** Menu state managed by parent AppShell component
- **Auth state:** Uses better-auth useSession() for user data
- **Components:** Uses shadcn/ui Button, Avatar, DropdownMenu from `src/components/ui/`
- **Navigation:** Uses ProgressLink for navigation progress indicator support

---

## Related Files

- `src/components/layout/app-shell.tsx` - Parent component managing header + navigation
- `src/components/layout/navigation-menu.tsx` - Slide-out navigation drawer
- `src/hooks/use-is-manager.ts` - Manager role detection hook
- `src/hooks/use-settings.ts` - useAccountErrors hook for sync status

---

## Design Reference

See `docs/design/ui/header/` for visual mockups.
