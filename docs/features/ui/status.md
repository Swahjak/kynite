# Status Indicators Specification

## Overview

Status indicators provide real-time feedback about application state, including cache freshness, network connectivity, and sync status with external services.

**Location:** `src/components/status/`

---

## Cache Status System

The cache status system monitors React Query's fetching state and network connectivity to provide visual feedback about data freshness.

### CacheStatusProvider

Context provider that tracks cache and network state.

**Location:** `src/components/status/cache-status-context.tsx`

```typescript
export type CacheStatus = "live" | "stale" | "offline";

interface CacheStatusContextValue {
  status: CacheStatus;
  isOnline: boolean;
  isFetching: boolean;
}
```

#### Status Logic

| Condition                   | Status  |
| --------------------------- | ------- |
| Offline (no network)        | offline |
| Fetching or no initial data | stale   |
| Online with fresh data      | live    |

#### Dependencies

- `@tanstack/react-query` - useIsFetching() for fetch state
- `useNetworkStatus()` hook - Network connectivity detection

### CacheStatusIndicator

Visual indicator component that displays current cache status.

**Location:** `src/components/status/cache-status-indicator.tsx`

```typescript
interface CacheStatusIndicatorProps {
  className?: string;
}
```

#### Visual States

| Status  | Color                    | Label    | Description                                   |
| ------- | ------------------------ | -------- | --------------------------------------------- |
| live    | --status-success (green) | Live     | Connected with fresh data                     |
| stale   | --status-warning (amber) | Updating | Showing cached data, refreshing in background |
| offline | --status-error (red)     | Offline  | No network connection, showing cached data    |

#### Styling

| Property   | Value                                |
| ---------- | ------------------------------------ |
| Position   | Fixed, bottom-left (bottom-4 left-4) |
| Z-index    | 50                                   |
| Background | bg-card/80 with backdrop-blur-sm     |
| Border     | border with shadow-sm                |
| Shape      | Rounded full (pill shape)            |
| Padding    | px-3 py-1.5                          |

#### Animation

- Ping animation on status dot when fetching
- Smooth transition (duration-300, ease-in-out) on state changes

#### Tooltip

Shows expanded description on hover using shadcn/ui Tooltip.

---

## Sync Error Indicators

### Account Error Badge

Displays in the calendar header when linked Google accounts have sync errors.

**Location:** `src/components/calendar/header/calendar-header.tsx`

```typescript
// Hook: src/hooks/use-settings.ts
export function useAccountErrors() {
  const { data: accounts } = useLinkedAccounts();
  const accountsWithErrors =
    accounts?.filter((account) => account.lastSyncError !== null) ?? [];

  return {
    hasErrors: accountsWithErrors.length > 0,
    errorCount: accountsWithErrors.length,
    accountsWithErrors,
  };
}
```

#### Visual Appearance

| Property | Value                         |
| -------- | ----------------------------- |
| Icon     | AlertTriangle (Lucide)        |
| Color    | text-destructive              |
| Size     | 20px (size-5)                 |
| Tooltip  | Translated sync error message |

#### Trigger Condition

Shows when any linked Google account has a `lastSyncError` value.

### Linked Account Card Error

Displays sync errors directly on account cards in settings.

**Location:** `src/components/settings/linked-google-account-card.tsx`

| Property | Value                            |
| -------- | -------------------------------- |
| Icon     | AlertCircle (Lucide)             |
| Color    | text-destructive                 |
| Size     | 16px (size-4)                    |
| Text     | Error message from lastSyncError |

---

## Usage

### Adding CacheStatusProvider

Wrap your application or authenticated routes with the provider:

```tsx
import { CacheStatusProvider, CacheStatusIndicator } from "@/components/status";

export function AppLayout({ children }) {
  return (
    <CacheStatusProvider>
      {children}
      <CacheStatusIndicator />
    </CacheStatusProvider>
  );
}
```

### Accessing Cache Status

Use the hook in any component:

```tsx
import { useCacheStatus } from "@/components/status";

function MyComponent() {
  const { status, isOnline, isFetching } = useCacheStatus();

  if (!isOnline) {
    return <OfflineMessage />;
  }

  return <Content />;
}
```

### Checking Account Errors

```tsx
import { useAccountErrors } from "@/hooks/use-settings";

function SyncStatusBadge() {
  const { hasErrors, errorCount, accountsWithErrors } = useAccountErrors();

  if (!hasErrors) return null;

  return (
    <Badge variant="destructive">
      {errorCount} account(s) with sync errors
    </Badge>
  );
}
```

---

## CSS Custom Properties

Status colors are defined as CSS custom properties in `globals.css`:

```css
:root {
  --status-success: /* green color for live status */;
  --status-warning: /* amber color for stale status */;
  --status-error: /* red color for offline/error status */;
}
```

---

## Accessibility

- Status indicator has tooltip for screen readers
- Icons include appropriate aria labels
- Color is not the only indicator (labels and tooltips provide text)
- Focus management for interactive elements

---

## Related Files

- `src/components/status/index.ts` - Public exports
- `src/components/status/cache-status-context.tsx` - Provider and hook
- `src/components/status/cache-status-indicator.tsx` - Visual component
- `src/hooks/use-network-status.ts` - Network connectivity detection
- `src/hooks/use-settings.ts` - useAccountErrors hook
- `src/components/calendar/header/calendar-header.tsx` - Sync error display
- `src/components/settings/linked-google-account-card.tsx` - Account card errors

---

## Design Reference

See `docs/design/ui/status/` for visual mockups.
