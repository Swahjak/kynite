# Mobile Usability Improvements Design

## Overview

Improve mobile usability of the Family Planner calendar with three targeted changes:

1. **Fix container scrolling** - Calendar body scrolls internally, not the page
2. **Mobile week view** - Horizontal swipe with 80% width columns, auto-focus on current day
3. **Hide "Full" tab on mobile** - Simplify navigation on smaller screens

**Breakpoint:** `md` (768px) - below this is considered "mobile"

## 1. Container Scrolling Fix

### Problem

Page-level scrolling occurs instead of calendar-internal scrolling. The height constraints don't cascade properly through the component tree.

### Solution

Ensure proper flex/height chain from layout to calendar body:

```
app-shell.tsx (min-h-screen flex flex-col)
  └─ main (flex-1 overflow-hidden)
       └─ calendar-layout-client.tsx (h-full flex flex-col)
            └─ calendar.tsx (flex-1 overflow-hidden)
                 └─ calendar-body.tsx (h-full overflow-hidden)
                      └─ view components (h-full + internal ScrollArea)
```

### Changes

1. **`calendar-body.tsx`**: Change `overflow-scroll` → `overflow-hidden` (let children handle their own scroll)
2. **View components**: Ensure each view has `h-full` and proper internal `ScrollArea` or `overflow-auto` where needed
3. **Remove fixed heights** like `h-[736px]` where possible, use `h-full` or `flex-1` instead

## 2. Mobile Week View (Horizontal Scroll)

### Behavior (< 768px)

- Each day column takes ~80% of viewport width
- Current day is centered/focused on load
- User swipes left/right to navigate between days (no visible controls)
- All 7 days remain rendered (horizontal scroll container)

### Implementation

```tsx
// calendar-week-view.tsx (mobile section)
<div className="h-full snap-x snap-mandatory overflow-x-auto md:hidden">
  <div className="flex h-full" style={{ width: "560%" }}>
    {" "}
    {/* 7 × 80% */}
    {days.map((day) => (
      <div
        key={day}
        className="h-full w-[80vw] flex-shrink-0 snap-center overflow-y-auto"
      >
        {/* Day column content */}
      </div>
    ))}
  </div>
</div>
```

### Key CSS

- `snap-x snap-mandatory` - Enables CSS scroll snapping for swipe feel
- `snap-center` - Each day snaps to center
- `w-[80vw]` - 80% viewport width per column
- `overflow-x-auto` on container, `overflow-y-auto` on each day column

### Auto-focus on current day

- Use `useEffect` + `scrollIntoView({ behavior: 'instant', inline: 'center' })` on mount
- Target the current day's column element via ref

## 3. Hide "Full" Tab on Mobile

### Implementation

- Add `hidden md:flex` (or similar) to the "Full" tab element in the top-level navigation
- On mobile (< 768px), only Today and Week tabs are visible

### Edge case

If a user bookmarks a full calendar URL and opens on mobile, they'll see the view but won't have the tab in nav. This is acceptable - they can use browser back or navigate to other tabs.

## Files to Modify

1. `src/components/calendar/calendar-body.tsx` - overflow handling
2. `src/components/calendar/views/week-and-day-view/calendar-week-view.tsx` - mobile horizontal scroll
3. Top-level navigation component (Today/Week/Full tabs) - hide Full on mobile
4. Potentially: `calendar.tsx`, view components for height chain fixes

## Testing

- Test on mobile viewport (Chrome DevTools device mode)
- Verify swipe navigation works smoothly
- Confirm page doesn't scroll when interacting with calendar
- Check that Full tab is hidden on mobile, visible on desktop
