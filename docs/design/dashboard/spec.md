# Dashboard Specification

> **Design Reference Only**
>
> This document contains visual mockups and styling references. For implementation
> requirements, data models, and interaction rules, see the feature specification
> in `docs/features/dashboard/`.
>
> When implementing, apply the project's brand guidelines and established patterns
> from the codebase. Do not copy mockup code directly.

This document defines the design, layout, components, and behavior for the Family Planner dashboard view.

---

## Overview

The dashboard serves as the **home screen** and primary interface for the Family Planner application. It provides an at-a-glance view of the family's day, designed for quick consumption on wall-mounted displays and mobile devices.

### Purpose

- Display the current time prominently for ambient awareness
- Show today's schedule in a digestible timeline format
- Surface active timers for parental visibility
- Provide gamification elements to encourage children
- Enable quick access to common household actions

### Target Contexts

| Context | Display | Interaction |
|---------|---------|-------------|
| Wall-mounted tablet | Large (10"+), always-on | Occasional touch |
| Mobile phone | Small (5-7"), on-demand | Frequent touch |
| Desktop browser | Large, secondary use | Mouse/keyboard |

---

## Layout Structure

### Desktop (xl: 1280px+)

```
┌─────────────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌─────────────────────────────────────────────────┐│
│ │          │ │ Header (greeting + clock + date/weather)        ││
│ │ Sidebar  │ ├─────────────────────────────────────────────────┤│
│ │          │ │ ┌───────────────────────┐ ┌───────────────────┐ ││
│ │ - Logo   │ │ │                       │ │ Active Timers     │ ││
│ │ - Nav    │ │ │ Today's Flow          │ ├───────────────────┤ ││
│ │ - Help   │ │ │ (2/3 width)           │ │ Weekly Stars      │ ││
│ │          │ │ │                       │ ├───────────────────┤ ││
│ │          │ │ │                       │ │ Quick Actions     │ ││
│ └──────────┘ │ └───────────────────────┘ └───────────────────┘ ││
│              └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

- **Sidebar**: Fixed 288px (w-72), hidden below xl breakpoint
- **Main content**: 3-column grid (2:1 ratio)
- **Max width**: 1600px, centered

### Tablet/Mobile (< xl: 1280px)

```
┌─────────────────────────────────────────┐
│ Header (collapsible menu + date/weather)│
├─────────────────────────────────────────┤
│ Greeting + Clock                        │
├─────────────────────────────────────────┤
│ Today's Flow                            │
│ (full width, vertical stack)            │
├─────────────────────────────────────────┤
│ Active Timers                           │
├─────────────────────────────────────────┤
│ Weekly Stars                            │
├─────────────────────────────────────────┤
│ Quick Actions (2x2 grid)                │
└─────────────────────────────────────────┘
```

- Single column layout
- Collapsible hamburger menu replaces sidebar
- Sections stack vertically

---

## Components

### 1. Header

#### Desktop Header

Located within the main content area (not in sidebar).

| Element | Specification |
|---------|---------------|
| Date/Weather widget | Top-right, card style |
| Date format | `Day, Mon DD` (e.g., "Mon, Oct 24") |
| Weather | Temperature + condition + icon |
| Background | Surface color with subtle border |
| Border radius | xl (12px) |

#### Mobile Header

| Element | Specification |
|---------|---------------|
| Logo | Primary icon (home) + "Family Planner" text |
| Subtitle | "Tap for Menu" with expand indicator |
| Menu | Dropdown with navigation items |
| Date/Weather | Top-right, compact |

### 2. Greeting & Clock

The focal point of the dashboard, designed for wall-display visibility.

| Element | Specification |
|---------|---------------|
| Greeting | Time-based, personalized (see Voice & Tone) |
| Font | Text Secondary color, xl-2xl size |
| Clock | Display XL (5rem-7rem), Black weight |
| Font family | Lexend |
| Number style | `tabular-nums` for consistent width |
| Letter spacing | `tracking-tight` |

#### Greeting Logic

```
05:00 - 11:59 → "Good Morning, {FamilyName}"
12:00 - 16:59 → "Good Afternoon, {FamilyName}"
17:00 - 20:59 → "Good Evening, {FamilyName}"
21:00 - 04:59 → "Good Night, {FamilyName}"
```

### 3. Today's Flow

A timeline view of the day's events, emphasizing temporal context.

#### Section Header

| Element | Specification |
|---------|---------------|
| Icon | `schedule` in Primary color (#13ec92) |
| Title | "Today's Flow", H2 Bold |
| Badge | "{n} Events Remaining", pill style |
| Badge colors | Primary/10 background, Primary text |

#### Event Card States

**NOW (Current Event)**

| Property | Value |
|----------|-------|
| Background | Surface (white) |
| Border-left | 4px solid Primary (#13ec92) |
| Border radius | 2xl (16px) |
| Shadow | md |
| Layout | Two-column: time info | event details |

| Element | Specification |
|---------|---------------|
| Status badge | "NOW" pill, Primary bg, dark text |
| Time | 2xl-3xl Bold |
| Duration | "Until {end time}", Muted text |
| Event title | 2xl Bold |
| Location | Icon + text, Secondary color |
| Category icon | 64px circle, category tint bg |

**NEXT (Upcoming Event)**

| Property | Value |
|----------|-------|
| Background | Surface with 60% opacity |
| Border | Transparent, hover shows border |
| Border radius | xl (12px) |
| Opacity | 70% on time section |

| Element | Specification |
|---------|---------------|
| Status label | "NEXT", uppercase, Muted |
| Time | xl Bold |
| Event title | xl Semibold |
| Description | sm, Secondary color |
| Category icon | 48px circle |

**LATER (Future Events)**

| Property | Value |
|----------|-------|
| Background | Surface with 40% opacity |
| Overall opacity | 80% |

Same structure as NEXT but with "LATER" label.

#### Event Category Colors

Events display a category icon with tinted background:

| Category | Icon | Background | Icon Color |
|----------|------|------------|------------|
| Sports/Activities | `sports_soccer` | green-50 | #0d9e61 |
| Meals/Kitchen | `restaurant`, `skillet` | orange-50 | #FFB84D |
| Reading/Quiet | `auto_stories` | purple-50 | #9C27B0 |
| Appointments | `event` | blue-50 | blue-600 |
| Chores | `cleaning_services` | pink-50 | pink-500 |

#### Interaction

- **Tap/Click on event**: Navigate to calendar view, focused on event's time slot
- **Hover** (desktop): Subtle border appears, shadow increases

### 4. Active Timers

Displays currently running timers (display-only, managed elsewhere).

#### Section Header

| Element | Specification |
|---------|---------------|
| Icon | `timer` in orange-500 |
| Title | "Active Timers", H2 Bold |

#### Timer Card

| Property | Value |
|----------|-------|
| Background | Surface |
| Border | 1px Border Default |
| Border radius | 2xl (16px) |
| Shadow | sm |
| Padding | 20px |

| Element | Specification |
|---------|---------------|
| Title | lg Bold (e.g., "Screen Time") |
| Subtitle | sm Secondary (e.g., "Leo's Tablet") |
| Time remaining | 5xl Black, `tabular-nums` |
| Unit label | "min left", Muted |
| Progress bar | Bottom of card, 8px height, Primary fill |
| Category icon | Top-right, 40px, tinted background |

#### Timer Controls (Display Only)

The timer shows informational buttons but they are non-functional on the dashboard:

| Button | Style | Note |
|--------|-------|------|
| "+ 15m" | Secondary/outline | Visual only |
| "Pause" | Destructive outline | Visual only |

*Note: Timer management occurs in Settings or a dedicated Timers page.*

### 5. Weekly Stars

Gamification leaderboard showing children's achievement progress.

#### Section Header

| Element | Specification |
|---------|---------------|
| Label | "WEEKLY STARS", overline style |
| Style | xs Bold, uppercase, tracking-wider, Muted |

#### Family Member Row

| Property | Value |
|----------|-------|
| Background | Surface |
| Border radius | xl (12px) |
| Padding | 16px |
| Gap between rows | 12px |

| Element | Specification |
|---------|---------------|
| Avatar | 40-48px, circular, member color, ring |
| Name | Base Bold |
| Level | xs Muted (e.g., "Level 4 Explorer") |
| Star count | lg-2xl Bold |
| Star icon | `star` filled, yellow-500 |
| Star badge | Pill with border, yellow-50 bg (leader) or gray-50 (others) |

#### Level Calculation

```
Level = floor(starCount / 10)
Title varies by level (Explorer, Artist, Champion, etc.)
```

### 6. Quick Actions

A 2x2 grid of frequently used household actions that trigger predefined timers.

#### Grid Layout

| Property | Value |
|----------|-------|
| Columns | 2 |
| Gap | 12px |
| Button height | 80-96px (responsive) |

#### Action Button

| Property | Value |
|----------|-------|
| Background | Surface (white) or Primary (featured) |
| Border | 1px Border Default (non-featured) |
| Border radius | xl (12px) |
| Shadow | sm |
| Transition | `all 200ms ease` |
| Active | `scale(0.95)` |

| Element | Specification |
|---------|---------------|
| Icon | 28-32px, category color |
| Label | sm Bold |
| Layout | Vertical stack, centered |

#### Default Actions

| Action | Icon | Color | Timer Duration |
|--------|------|-------|----------------|
| Dinner Mode | `restaurant` | Primary bg | Configurable |
| Water Plants | `water_drop` | blue-500 | 5 min |
| 15m Tidy | `cleaning_services` | purple-500 | 15 min |
| Log Chore | `favorite` | pink-500 | N/A (opens modal) |

#### Interaction

- **Tap/Click**: Starts the predefined timer associated with the action
- **Hover** (desktop): Background shifts to hover state, icon scales 1.1x

### 7. Sidebar (Desktop Only)

Fixed navigation panel on the left side.

| Property | Value |
|----------|-------|
| Width | 288px (w-72) |
| Background | Surface |
| Border | Right border, Border Default |
| Visibility | xl breakpoint and above |

#### Sidebar Sections

**Header**
| Element | Specification |
|---------|---------------|
| Family photo | 48px circle with Primary ring |
| Title | "Family Planner", lg Bold |
| Subtitle | "{FamilyName}", sm Muted |

**Navigation**
| Item | Icon | State |
|------|------|-------|
| Dashboard | `dashboard` (filled) | Active |
| Schedule | `calendar_month` | Inactive |
| Chore Log | `checklist` | Inactive |
| Settings | `settings` | Inactive |

**Active nav item**
| Property | Value |
|----------|-------|
| Background | Primary (#13ec92) |
| Text | Dark (#10221a) |
| Icon | Filled variant |
| Border radius | xl (12px) |
| Shadow | sm |

**Inactive nav item**
| Property | Value |
|----------|-------|
| Background | Transparent |
| Text | Text Secondary |
| Hover | Surface Hover bg |

**Footer**
| Element | Specification |
|---------|---------------|
| Help link | `help` icon + "Help" label |
| Position | Bottom of sidebar |

---

## Data Requirements

### Dashboard Data Model

```typescript
interface DashboardData {
  family: {
    name: string;
    photoUrl?: string;
  };
  currentTime: Date;
  weather: {
    temperature: number;
    unit: 'F' | 'C';
    condition: string;
    icon: string;
  };
  todaysEvents: Event[];
  activeTimers: Timer[];
  familyMembers: FamilyMember[];
  quickActions: QuickAction[];
}

interface Event {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  category: EventCategory;
  assignedTo?: string[];
}

interface Timer {
  id: string;
  title: string;
  subtitle: string;
  remainingSeconds: number;
  totalSeconds: number;
  category: string;
  iconName: string;
}

interface FamilyMember {
  id: string;
  name: string;
  role: 'parent' | 'child';
  avatarColor: string;
  avatarUrl?: string;
  starCount: number;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  iconColor: string;
  timerDuration?: number; // seconds
  isFeatured: boolean;
}
```

### Data Sources

| Data | Source | Refresh Rate |
|------|--------|--------------|
| Current time | Client clock | Every second |
| Weather | External API | Every 30 min |
| Events | Google Calendar API | Every 5 min |
| Timers | Local state / DB | Real-time |
| Star counts | Database | On demand |

---

## Accessibility

### WCAG 2.1 AA Compliance

| Requirement | Implementation |
|-------------|----------------|
| Color contrast | All text meets 4.5:1 (normal) or 3:1 (large) |
| Focus indicators | 2px Primary outline with 2px offset |
| Touch targets | Minimum 44x44px for all interactive elements |
| Screen readers | Semantic HTML, ARIA labels on icons |
| Reduced motion | Respect `prefers-reduced-motion` |

### Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move between interactive elements |
| Enter/Space | Activate buttons, open menus |
| Escape | Close menus/modals |
| Arrow keys | Navigate within menus |

### Screen Reader Considerations

- Clock should announce on focus: "Current time: {time}"
- Events should include full context: "{title} at {time}, {location}"
- Timers should announce remaining time
- Star counts should be labeled: "{name} has {count} stars"

---

## Dark Mode

The dashboard fully supports dark mode via the `dark` class on `<html>`.

### Color Mapping

| Element | Light | Dark |
|---------|-------|------|
| Page background | #f6f8f7 | #10221a |
| Surface/Cards | #ffffff | #1c2e26 |
| Text Primary | #111815 | #ffffff |
| Text Secondary | #618979 | #8baea0 |
| Borders | #dbe6e1 | #2a3831 |
| Primary | #13ec92 | #13ec92 (unchanged) |

### Transition

```css
body {
  transition: background-color 200ms ease, color 200ms ease;
}
```

---

## Responsive Behavior

### Breakpoint Summary

| Breakpoint | Sidebar | Grid | Clock Size | Card Padding |
|------------|---------|------|------------|--------------|
| < sm (640px) | Hidden | 1 col | 5rem | 16px |
| sm - lg | Hidden | 1 col | 6rem | 20px |
| lg - xl | Hidden | 1 col | 6rem | 24px |
| xl+ | Visible | 3 col (2:1) | 7rem | 24px |

### Mobile Optimizations

- Hamburger menu expands to full-width dropdown
- Event cards stack vertically
- Quick action buttons increase touch target
- Timer progress bar remains visible

---

## Animation Specifications

### Transitions

| Element | Property | Duration | Easing |
|---------|----------|----------|--------|
| Buttons | all | 200ms | ease |
| Cards (hover) | box-shadow, transform | 200ms | ease |
| Icons (hover) | transform | 200ms | ease |
| Color mode | background-color, color | 200ms | ease |
| Menu appear | opacity, transform | 200ms | ease-out |

### Interactive States

| State | Effect |
|-------|--------|
| Button hover | Background shifts to hover color |
| Button active | `scale(0.95)` |
| Card hover | Shadow increases to md |
| Icon hover | `scale(1.1)` |
| Nav item hover | Background to Surface Hover |

### Timer Animation

- Progress bar width transitions smoothly as time decreases
- Time display updates every second with no visual transition (instant update)

---

## Implementation Notes

### Component Structure

```
src/components/dashboard/
├── dashboard-page.tsx        # Main page component
├── greeting-clock.tsx        # Time + greeting display
├── todays-flow/
│   ├── todays-flow.tsx       # Section wrapper
│   ├── event-card-now.tsx    # Current event card
│   └── event-card-later.tsx  # Next/Later event card
├── active-timers/
│   ├── active-timers.tsx     # Section wrapper
│   └── timer-card.tsx        # Individual timer display
├── weekly-stars/
│   ├── weekly-stars.tsx      # Section wrapper
│   └── member-row.tsx        # Family member row
├── quick-actions/
│   ├── quick-actions.tsx     # Grid wrapper
│   └── action-button.tsx     # Individual action button
└── sidebar/
    ├── sidebar.tsx           # Desktop sidebar
    └── mobile-menu.tsx       # Mobile hamburger menu
```

### State Management

- Use `CalendarContext` for event data integration
- Local state for UI interactions (menu open, etc.)
- Timer state synced via database or real-time updates

### Performance Considerations

- Clock updates via `setInterval` (1 second)
- Memoize event filtering and sorting
- Lazy load non-critical components
- Use `will-change` for animated elements

---

## Design Assets Reference

| File | Description |
|------|-------------|
| `dashboard-design-1.png` | Desktop layout with sidebar |
| `dashboard-design-2.png` | Tablet layout without sidebar |
| `dashboard-code-1.html` | Full HTML/CSS reference implementation |
| `dashboard-code-2.tsx` | React component reference |

---

*Last updated: December 2024*
