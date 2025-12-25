# Remove Edit Toggle Design

## Overview

Remove the "wall vs manage" mode toggle from the header. With device accounts now handling view-only experiences automatically, parents (managers) should always see edit options without needing to toggle.

## Current State

- `ModeToggle` component in header toggles between "wall" and "manage" modes
- `InteractionModeContext` stores mode state (persisted to localStorage)
- ~20 files use `mode === "manage"` to conditionally show edit options
- `useDeviceSession` hook conflates device detection with permission checking
- `IfNotDevice` component exists but is unused

## Design Decisions

### 1. Remove the toggle concept entirely

Delete the wall/manage mode system completely rather than making it automatic. Clean removal is better than leaving dead code.

### 2. Two simple boolean hooks for permissions

Replace `useDeviceSession` with two focused hooks:

```typescript
// src/hooks/use-is-manager.ts
export function useIsManager(): boolean {
  const { data: session } = useSession();
  if (!session) return false;
  const { isDevice, memberRole } = session.session as SessionData;
  return !isDevice && memberRole === "manager";
}

// src/hooks/use-is-device.ts
export function useIsDevice(): boolean {
  const { data: session } = useSession();
  if (!session) return false;
  return (session.session as SessionData).isDevice === true;
}
```

**Rationale:**

- Single responsibility: each hook answers one question
- Simple boolean return, no object destructuring
- Idiomatic React naming (`useIsSomething`)
- No over-abstraction

### 3. Inline permission checks

Use hooks directly rather than wrapper components:

```tsx
const isManager = useIsManager();
{
  isManager && <EditButton />;
}
```

## Files to Delete

1. `src/components/layout/mode-toggle.tsx`
2. `src/contexts/interaction-mode-context.tsx`
3. `src/contexts/__tests__/interaction-mode-context.test.tsx`
4. `src/hooks/use-device-session.ts`
5. `src/components/device/if-not-device.tsx`

## Files to Create

1. `src/hooks/use-is-manager.ts`
2. `src/hooks/use-is-device.ts`

## Files to Update

### Core layout files

- `src/app/[locale]/(app)/layout.tsx` - Remove isManager calculation, keep InteractionModeProvider removal
- `src/components/layout/app-shell.tsx` - Remove isManager prop
- `src/components/layout/app-header.tsx` - Remove ModeToggle, remove isManager prop

### Components using mode checks (~15 files)

- `src/components/layout/navigation-menu.tsx`
- `src/components/calendar/header/calendar-header.tsx`
- `src/app/[locale]/(app)/calendar/calendar-layout-client.tsx`
- `src/components/reward-store/reward-store-page.tsx`
- `src/components/reward-store/reward-card.tsx`
- `src/components/reward-chart/reward-chart-page.tsx`
- `src/components/reward-chart/bottom-cards/next-reward-card.tsx`
- `src/components/reward-chart/bottom-cards/message-card.tsx`
- `src/components/dashboard/active-timers/timer-card.tsx`
- `src/components/chores/chores.tsx`
- `src/components/chores/components/chore-card.tsx`
- `src/components/dashboard/quick-actions/action-button.tsx`

### Test files

- `src/components/layout/__tests__/app-header.test.tsx`
- `src/components/layout/__tests__/navigation-menu.test.tsx`

### Translation files

- `messages/en.json` - Remove `switchToManage`, `switchToWall`, `manageMode`
- `messages/nl.json` - Remove same keys

## Migration Pattern

```tsx
// Before
import { useInteractionMode } from "@/contexts/interaction-mode-context";

const { mode } = useInteractionMode();
const isManageMode = mode === "manage";
{
  isManageMode && <EditButton />;
}

// After
import { useIsManager } from "@/hooks/use-is-manager";

const isManager = useIsManager();
{
  isManager && <EditButton />;
}
```

## Testing Strategy

1. Run existing tests after each file migration
2. Update test mocks to use new hooks instead of InteractionModeContext
3. Verify manager users see edit options
4. Verify device sessions don't see edit options
5. Run full E2E suite before completion
