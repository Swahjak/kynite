# App Header Specification

> **Design Reference Only**
>
> This document contains visual mockups and styling references. For implementation
> requirements, data models, and interaction rules, see the feature specification
> in `docs/features/ui/header.md`.
>
> When implementing, apply the project's brand guidelines and established patterns
> from the codebase. Do not copy mockup code directly.

This document defines the main application header (top bar) for Family Planner, based on design mockups and brand guidelines.

---

## Overview

The App Header is the primary navigation bar that appears at the top of every screen. It provides brand identity, quick actions, and access to user settings.

### Key Features

- Brand identity with menu trigger
- Weather display (optional)
- Quick "Add Event" action
- Notification center access
- Settings access
- User/family avatar

---

## Anatomy

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ┌────┐                                                                    │
│  │ 🏠 │ Family Planner    ☀️ 72°F    [ + Add Event ]  ⚙️  🔔  (👨‍👩‍👧)        │
│  └────┘ FAMILY OS                                                          │
└────────────────────────────────────────────────────────────────────────────┘
   └─────────────┘           └──────┘  └────────────┘  └──────────────────┘
     Brand Area               Weather    Primary CTA      Action Icons
```

---

## Container

### Dimensions

| Property           | Value         |
| ------------------ | ------------- |
| Height             | 72px (4.5rem) |
| Width              | 100%          |
| Padding Horizontal | 24px (1.5rem) |
| Padding Vertical   | 16px (1rem)   |

### Styling

| Property      | Light Mode                   | Dark Mode           |
| ------------- | ---------------------------- | ------------------- |
| Background    | `#ffffff`                    | `#253830`           |
| Border Bottom | `1px solid #dbe6e1`          | `1px solid #2a3831` |
| Shadow        | `0 1px 2px rgba(0,0,0,0.05)` | Same                |

### Layout

```css
display: flex;
align-items: center;
justify-content: space-between;
```

---

## Brand Area (Left)

The brand area serves as the menu trigger (opens the navigation drawer).

### Structure

```tsx
<button className="brand-trigger">
  <div className="brand-icon">
    <Home />
  </div>
  <div className="brand-text">
    <span className="title">Family Planner</span>
    <span className="tagline">FAMILY OS</span>
  </div>
  <ChevronDown className="dropdown-indicator" />
</button>
```

### Brand Icon

| Property      | Value                                           |
| ------------- | ----------------------------------------------- |
| Size          | 48×48px                                         |
| Background    | `#13ec92` (Primary)                             |
| Border Radius | `full` (circle)                                 |
| Border        | `3px solid rgba(19, 236, 146, 0.3)` (glow ring) |
| Icon          | `Home` (Lucide)                                 |
| Icon Size     | 24px                                            |
| Icon Color    | `#10221a` (dark on primary)                     |

### Brand Text

| Element     | Property       | Value                       |
| ----------- | -------------- | --------------------------- |
| **Title**   | Font           | Lexend                      |
|             | Size           | 20px (1.25rem)              |
|             | Weight         | 700 (Bold)                  |
|             | Color          | `var(--color-text-primary)` |
| **Tagline** | Font           | Lexend                      |
|             | Size           | 12px (0.75rem)              |
|             | Weight         | 500 (Medium)                |
|             | Color          | `#13ec92` (Primary)         |
|             | Letter Spacing | `0.1em` (tracking-wider)    |
|             | Text Transform | Uppercase                   |

### Dropdown Indicator

| Property    | Value                         |
| ----------- | ----------------------------- |
| Icon        | `ChevronDown` (Lucide)        |
| Size        | 16px                          |
| Color       | `var(--color-text-secondary)` |
| Margin Left | 4px                           |

### Behavior

| State      | Effect                        |
| ---------- | ----------------------------- |
| Hover      | `opacity: 0.8`                |
| Active     | Opens navigation menu (Sheet) |
| Transition | `opacity 200ms ease`          |

---

## Weather Display (Optional)

Shows current weather conditions when enabled.

### Structure

```tsx
<div className="weather-display">
  <Sun className="weather-icon" />
  <span className="temperature">72°F</span>
</div>
```

### Styling

| Property                | Value                           |
| ----------------------- | ------------------------------- |
| Container Padding       | 8px 16px                        |
| Container Border        | `1px solid var(--color-border)` |
| Container Border Radius | `full` (pill shape)             |
| Gap                     | 8px                             |

### Weather Icon

| Property | Value                            |
| -------- | -------------------------------- |
| Size     | 20px                             |
| Color    | `#facc15` (yellow-400) for sunny |
|          | `#94a3b8` (slate-400) for cloudy |
|          | `#60a5fa` (blue-400) for rainy   |

### Temperature Text

| Property     | Value                       |
| ------------ | --------------------------- |
| Font         | Lexend                      |
| Size         | 14px (0.875rem)             |
| Weight       | 600 (SemiBold)              |
| Color        | `var(--color-text-primary)` |
| Number Style | `tabular-nums`              |

---

## Primary Action Button

The main call-to-action for adding new events.

### Structure

```tsx
<Button className="add-event-btn">
  <Plus />
  Add Event
</Button>
```

### Styling

| Property           | Value               |
| ------------------ | ------------------- |
| Background         | `#13ec92` (Primary) |
| Text Color         | `#10221a` (dark)    |
| Font               | Lexend              |
| Font Size          | 14px (0.875rem)     |
| Font Weight        | 600 (SemiBold)      |
| Padding            | 12px 20px           |
| Border Radius      | 8px (lg)            |
| Gap (icon to text) | 8px                 |
| Icon Size          | 18px                |
| Min Height         | 44px (touch target) |

### States

| State    | Effect                                            |
| -------- | ------------------------------------------------- |
| Hover    | `background: #0fd683` (Primary Hover)             |
| Active   | `transform: scale(0.95)`                          |
| Focus    | `outline: 2px solid #13ec92; outline-offset: 2px` |
| Disabled | `opacity: 0.5; cursor: not-allowed`               |

### Transition

```css
transition:
  background-color 200ms ease,
  transform 150ms ease;
```

---

## Action Icons

Icon buttons for secondary actions.

### Structure

```tsx
<div className="action-icons">
  <Button variant="ghost" size="icon">
    <Settings />
  </Button>
  <Button variant="ghost" size="icon" className="notification-btn">
    <Bell />
    <span className="notification-badge">3</span>
  </Button>
</div>
```

### Icon Button Styling

| Property            | Value                         |
| ------------------- | ----------------------------- |
| Size                | 44×44px (touch target)        |
| Border Radius       | 8px (lg)                      |
| Background          | Transparent                   |
| Icon Size           | 22px                          |
| Icon Color          | `var(--color-text-secondary)` |
| Gap between buttons | 8px                           |

### Icon Button States

| State  | Effect                                            |
| ------ | ------------------------------------------------- |
| Hover  | `background: var(--color-surface-hover)`          |
| Active | `transform: scale(0.95)`                          |
| Focus  | `outline: 2px solid #13ec92; outline-offset: 2px` |

### Notification Badge

| Property      | Value                                     |
| ------------- | ----------------------------------------- |
| Position      | Absolute, top-right of bell icon          |
| Offset        | `-4px` from top and right                 |
| Size          | 18px (min-width)                          |
| Background    | `#ef4444` (red-500)                       |
| Text Color    | `#ffffff`                                 |
| Font Size     | 10px                                      |
| Font Weight   | 700 (Bold)                                |
| Border Radius | `full`                                    |
| Padding       | 2px 5px                                   |
| Border        | `2px solid var(--color-surface-elevated)` |

---

## User Avatar

Family or user avatar displayed at the far right.

### Structure

```tsx
<button className="avatar-trigger">
  <img src={avatarUrl} alt={familyName} />
</button>
```

### Styling

| Property      | Value                              |
| ------------- | ---------------------------------- |
| Size          | 44×44px                            |
| Border Radius | `full` (circle)                    |
| Border        | `3px solid #13ec92` (Primary ring) |
| Object Fit    | `cover`                            |

### States

| State  | Effect                                            |
| ------ | ------------------------------------------------- |
| Hover  | `border-color: #0fd683; transform: scale(1.05)`   |
| Active | Opens user/family menu                            |
| Focus  | `outline: 2px solid #13ec92; outline-offset: 2px` |

### Fallback (No Image)

| Property   | Value                |
| ---------- | -------------------- |
| Background | `#e5e7eb` (gray-200) |
| Icon       | `Users` (Lucide)     |
| Icon Size  | 20px                 |
| Icon Color | `#6b7280` (gray-500) |

---

## Icons (Lucide)

| Element         | Icon Name     | Import         |
| --------------- | ------------- | -------------- |
| Brand Logo      | `Home`        | `lucide-react` |
| Dropdown        | `ChevronDown` | `lucide-react` |
| Add Event       | `Plus`        | `lucide-react` |
| Settings        | `Settings`    | `lucide-react` |
| Notifications   | `Bell`        | `lucide-react` |
| Weather Sun     | `Sun`         | `lucide-react` |
| Weather Cloud   | `Cloud`       | `lucide-react` |
| Weather Rain    | `CloudRain`   | `lucide-react` |
| Avatar Fallback | `Users`       | `lucide-react` |

---

## Responsive Behavior

### Breakpoints

| Breakpoint       | Behavior                                        |
| ---------------- | ----------------------------------------------- |
| < 640px (mobile) | Hide weather, collapse "Add Event" to icon-only |
| 640px - 1024px   | Show all elements, reduced spacing              |
| > 1024px         | Full layout with comfortable spacing            |

### Mobile Variant

```
┌──────────────────────────────────────────────┐
│  ┌────┐                                      │
│  │ 🏠 │ Family Planner    [+]  ⚙️  🔔  (👨‍👩‍👧) │
│  └────┘ FAMILY OS                            │
└──────────────────────────────────────────────┘
```

- Weather display hidden
- "Add Event" becomes icon-only button
- Reduced horizontal padding (16px)

---

## Color Reference

### Primary Brand

| Token         | Value     | Usage                                         |
| ------------- | --------- | --------------------------------------------- |
| Primary       | `#13ec92` | CTA button, avatar ring, tagline, focus rings |
| Primary Hover | `#0fd683` | Button hover state                            |
| Primary Dark  | `#10221a` | Text on primary background                    |

### Surface Colors

| Token            | Light     | Dark      |
| ---------------- | --------- | --------- |
| Surface Elevated | `#ffffff` | `#253830` |
| Surface Hover    | `#f0f4f3` | `#2f453b` |

### Text Colors

| Token          | Light     | Dark      |
| -------------- | --------- | --------- |
| Text Primary   | `#111815` | `#ffffff` |
| Text Secondary | `#618979` | `#8baea0` |

### Utility Colors

| Token              | Value     | Usage              |
| ------------------ | --------- | ------------------ |
| Notification Badge | `#ef4444` | Unread count badge |
| Weather Sunny      | `#facc15` | Sun icon           |
| Weather Cloudy     | `#94a3b8` | Cloud icon         |

---

## Accessibility

### Keyboard Navigation

| Key               | Action                                  |
| ----------------- | --------------------------------------- |
| `Tab`             | Move focus between interactive elements |
| `Enter` / `Space` | Activate focused button                 |
| `Escape`          | Close any open menus                    |

### ARIA Attributes

```tsx
<header role="banner">
  <button
    aria-label="Open navigation menu"
    aria-expanded={isMenuOpen}
    aria-haspopup="dialog"
  >
    {/* Brand area */}
  </button>

  <button aria-label="Add new event">
    <Plus /> Add Event
  </button>

  <button aria-label="Settings">
    <Settings />
  </button>

  <button aria-label={`Notifications, ${unreadCount} unread`}>
    <Bell />
    <span aria-hidden="true">{unreadCount}</span>
  </button>

  <button aria-label="Family menu">
    <img alt={familyName} />
  </button>
</header>
```

### Screen Reader Considerations

- Notification count announced via aria-label
- Weather conditions described (not just icon)
- All buttons have descriptive labels

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .header *,
  .header *::before,
  .header *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Implementation Notes

### Dependencies

```tsx
import { Button } from "@/components/ui/button";
import {
  Home,
  ChevronDown,
  Plus,
  Settings,
  Bell,
  Sun,
  Users,
} from "lucide-react";
```

### Props Interface

```tsx
interface AppHeaderProps {
  /** Family name to display */
  familyName?: string;
  /** Family avatar URL */
  avatarUrl?: string;
  /** Show weather widget */
  showWeather?: boolean;
  /** Weather data */
  weather?: {
    temperature: number;
    unit: "F" | "C";
    condition: "sunny" | "cloudy" | "rainy" | "snowy";
  };
  /** Unread notification count */
  notificationCount?: number;
  /** Callback when menu trigger clicked */
  onMenuClick?: () => void;
  /** Callback when add event clicked */
  onAddEventClick?: () => void;
  /** Callback when settings clicked */
  onSettingsClick?: () => void;
  /** Callback when notifications clicked */
  onNotificationsClick?: () => void;
  /** Callback when avatar clicked */
  onAvatarClick?: () => void;
}
```

### Default Values

```tsx
const defaultProps = {
  familyName: "Family",
  showWeather: false,
  notificationCount: 0,
};
```

---

## Visual Reference

See `header-design-1.png` and `header-design-2.png` for visual mockups.

---

_Last updated: December 2024_
