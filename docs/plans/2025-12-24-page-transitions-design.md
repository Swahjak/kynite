# Page Transitions Design

**Date**: 2025-12-24
**Status**: Approved

## Problem

Navigation within the `(app)` route group lacks visual feedback during page loads. Users experience unresponsive-feeling navigation when pages have loading time.

## Solution

Implement a two-part solution:

1. **Top progress bar** - Immediate visual feedback for all navigations
2. **Skeleton screens** - Polished loading states using hybrid approach

---

## Part 1: Navigation Progress Bar

### Components

| Component                    | Location                                                    | Purpose                           |
| ---------------------------- | ----------------------------------------------------------- | --------------------------------- |
| `NavigationProgressProvider` | `src/components/providers/navigation-progress-provider.tsx` | Context that tracks route changes |
| `NavigationProgress`         | `src/components/ui/navigation-progress.tsx`                 | Visual progress bar component     |

### Behavior

- **Navigation starts** → Bar appears, animates to ~80%
- **Navigation completes** → Bar fills to 100%, fades out
- **Fast navigations (<100ms)** → Bar doesn't show (avoids flicker)
- **Stuck navigations (>10s)** → Bar stays at 90% until complete

### Styling

- Uses existing primary color from CSS variables
- Height: 3px, fixed position at viewport top
- Z-index above all content
- Subtle shadow for visibility on light backgrounds

### Route Change Detection

- Uses `next/navigation` hooks: `usePathname()` + `useSearchParams()`
- Tracks pathname changes via `useEffect`
- No external dependencies (no nprogress library)

---

## Part 2: Skeleton Screens (Hybrid Approach)

### File Structure

```
src/app/[locale]/(app)/
├── loading.tsx              # Generic skeleton (new)
├── calendar/
│   └── loading.tsx          # Uses existing CalendarSkeleton (new)
├── settings/
│   └── loading.tsx          # Optional: future enhancement
├── chores/
│   └── loading.tsx          # Optional: future enhancement
```

### Generic App Skeleton

Location: `src/app/[locale]/(app)/loading.tsx`

- Shows content area skeleton (AppShell header/sidebar already rendered from layout)
- Page title placeholder (wider bar)
- 3-4 content block placeholders
- Uses existing Tailwind `animate-pulse` class

### Calendar Skeleton

Location: `src/app/[locale]/(app)/calendar/loading.tsx`

- Reuses existing components from `src/components/calendar/skeletons/`
- Already built: `CalendarSkeleton`, `CalendarHeaderSkeleton`, view-specific skeletons

---

## Integration

### Provider Placement

In `src/app/[locale]/(app)/layout.tsx`:

```tsx
<NavigationProgressProvider>
  <AppShell>{children}</AppShell>
</NavigationProgressProvider>
```

### Animation Stack

- Progress bar: Framer Motion (already installed)
- Skeletons: Tailwind `animate-pulse` class

### Edge Cases

| Scenario                          | Behavior                          |
| --------------------------------- | --------------------------------- |
| Same-page navigation (hash links) | No progress bar                   |
| Prefetched routes (instant)       | Bar shows briefly or not at all   |
| Error during navigation           | Bar completes, error page renders |
| Back/forward browser buttons      | Progress bar triggers normally    |

### No Changes Required

- Existing `Link` components work as-is
- No modifications to `navigation-menu.tsx`
- React Query data fetching continues independently

---

## Implementation Order

1. Create `NavigationProgress` component (UI)
2. Create `NavigationProgressProvider` (context + logic)
3. Integrate provider in `(app)/layout.tsx`
4. Add generic `loading.tsx` skeleton
5. Add calendar-specific `loading.tsx`
6. Test all navigation paths
