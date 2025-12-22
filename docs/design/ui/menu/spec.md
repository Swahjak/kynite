# Menu Specification

This document defines the navigation menu component for Family Planner, based on design mockups and brand guidelines.

---

## Overview

The menu is a slide-out drawer (Sheet) triggered from the top bar. It provides primary navigation for the application on mobile and tablet devices.

### Key Features

- Slide-in from left side
- Brand header with family identifier
- Primary navigation links
- Help/support access
- Touch-optimized targets (44px minimum)

---

## Anatomy

```
┌─────────────────────────────┐
│  ┌────┐                     │
│  │ 🏠 │  Family Planner     │  ← Brand Header
│  └────┘  [Family Name]      │
├─────────────────────────────┤
│                             │
│  ▣ Dashboard        ← active│  ← Navigation
│  ▢ Schedule                 │
│  ▢ Chore Log                │
│  ▢ Settings                 │
│                             │
│         (spacer)            │
│                             │
├─────────────────────────────┤
│  ⓘ Help                     │  ← Footer
└─────────────────────────────┘
```

---

## Trigger (Top Bar)

The menu is triggered by clicking the brand logo area in the top bar header.

### Structure

```tsx
<button className="flex items-center gap-3">
  <div className="brand-icon">
    <Home />
  </div>
  <div className="brand-text">
    <span className="title">Family Planner</span>
    <span className="subtitle">{familyName}</span>
  </div>
</button>
```

### Styling

| Element | Property | Value |
|---------|----------|-------|
| **Brand Icon** | Size | 48×48px |
| | Background | `#13ec92` (Primary) |
| | Border Radius | `full` (circle) |
| | Icon Size | 24px |
| | Icon Color | `#ffffff` |
| **Title** | Font | Lexend |
| | Size | 20px (1.25rem) |
| | Weight | 700 (Bold) |
| | Color | `var(--color-text-primary)` |
| **Subtitle** | Font | Noto Sans |
| | Size | 14px (0.875rem) |
| | Weight | 400 |
| | Color | `var(--color-text-secondary)` |

### Behavior

- **Hover**: `opacity: 0.8`
- **Transition**: `opacity 200ms ease`
- **Focus**: `outline: 2px solid #13ec92; outline-offset: 2px`

---

## Menu Container (Sheet)

### Dimensions

| Property | Value |
|----------|-------|
| Width | 256px (16rem) |
| Height | 100vh (full height) |
| Position | Left side |

### Styling

| Property | Light Mode | Dark Mode |
|----------|------------|-----------|
| Background | `#ffffff` | `#253830` |
| Border Right | `1px solid #dbe6e1` | `1px solid #2a3831` |
| Shadow | `0 25px 50px rgba(0,0,0,0.25)` | Same |

### Animation

```css
/* Enter */
animation: slideInLeft 200ms ease-out;
transform-origin: left;

@keyframes slideInLeft {
  from {
    transform: translateX(-100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Exit */
animation: slideOutLeft 150ms ease-in;
```

### Overlay

| Property | Value |
|----------|-------|
| Background | `rgba(0, 0, 0, 0.5)` |
| Blur | None (optional: `backdrop-filter: blur(4px)`) |
| Transition | `opacity 200ms ease` |

---

## Brand Header (Inside Menu)

Repeated branding at the top of the menu drawer.

### Structure

```tsx
<div className="menu-header">
  <div className="brand-icon">
    <Home />
  </div>
  <div className="brand-text">
    <span className="title">Family Planner</span>
    <span className="subtitle">{familyName}</span>
  </div>
</div>
```

### Styling

| Property | Value |
|----------|-------|
| Padding | 24px |
| Border Bottom | `1px solid var(--color-border)` |
| Gap (icon to text) | 12px |
| Icon Size | 48×48px |
| Title Size | 16px (1rem), Bold |
| Subtitle Size | 14px (0.875rem), Regular |

---

## Navigation Items

### Structure

```tsx
<nav>
  <a href="/dashboard" className="nav-item active">
    <LayoutDashboard />
    <span>Dashboard</span>
  </a>
  <a href="/schedule" className="nav-item">
    <Calendar />
    <span>Schedule</span>
  </a>
  <a href="/chores" className="nav-item">
    <CheckSquare />
    <span>Chore Log</span>
  </a>
  <a href="/settings" className="nav-item">
    <Settings />
    <span>Settings</span>
  </a>
</nav>
```

### Navigation Item Styling

| Property | Default | Hover | Active |
|----------|---------|-------|--------|
| Background | Transparent | `#f0f4f3` / `#2f453b` | `#13ec92` |
| Text Color | `var(--color-text-secondary)` | `var(--color-text-primary)` | `#10221a` |
| Font Weight | 500 (Medium) | 500 | 500 |
| Border Radius | 8px (lg) | 8px | 8px |
| Padding | 12px 16px | Same | Same |
| Gap (icon to text) | 12px | Same | Same |
| Icon Size | 20px | Same | Same |

### Touch Target

| Property | Value |
|----------|-------|
| Min Height | 48px |
| Min Width | 100% |
| Margin Bottom | 8px |

### Transitions

```css
.nav-item {
  transition: background-color 200ms ease, color 200ms ease;
}

.nav-item:active {
  transform: scale(0.98);
}
```

---

## Footer (Help Section)

### Structure

```tsx
<div className="menu-footer">
  <button className="nav-item">
    <div className="help-icon">
      <HelpCircle />
    </div>
    <span>Help</span>
  </button>
</div>
```

### Styling

| Property | Value |
|----------|-------|
| Border Top | `1px solid var(--color-border)` |
| Padding | 16px |
| Help Icon Container | 32×32px circle, `#e5e7eb` background |

---

## Icons (Lucide)

The menu uses Lucide icons for consistency with the existing codebase.

| Item | Icon Name | Import |
|------|-----------|--------|
| Brand Logo | `Home` | `lucide-react` |
| Dashboard | `LayoutDashboard` | `lucide-react` |
| Schedule | `Calendar` | `lucide-react` |
| Chore Log | `CheckSquare` | `lucide-react` |
| Settings | `Settings` | `lucide-react` |
| Help | `HelpCircle` | `lucide-react` |

### Icon Sizing

| Context | Size |
|---------|------|
| Brand Icon | 24px |
| Nav Items | 20px |
| Help Icon | 16px |

---

## Color Reference

### Primary Brand Color

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#13ec92` | Active nav item, brand icon background, focus rings |
| Primary Text | `#10221a` | Text on primary background |

### Surface Colors

| Token | Light | Dark |
|-------|-------|------|
| Surface Elevated | `#ffffff` | `#253830` |
| Surface Hover | `#f0f4f3` | `#2f453b` |

### Text Colors

| Token | Light | Dark |
|-------|-------|------|
| Text Primary | `#111815` | `#ffffff` |
| Text Secondary | `#618979` | `#8baea0` |

### Border Colors

| Token | Light | Dark |
|-------|-------|------|
| Border Default | `#dbe6e1` | `#2a3831` |

---

## Accessibility

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Tab` | Move focus to next nav item |
| `Shift + Tab` | Move focus to previous nav item |
| `Enter` / `Space` | Activate focused item |
| `Escape` | Close menu |

### ARIA Attributes

```tsx
<Sheet>
  <SheetTrigger aria-label="Open navigation menu">
    {/* trigger content */}
  </SheetTrigger>
  <SheetContent
    role="dialog"
    aria-label="Navigation menu"
    aria-modal="true"
  >
    <nav aria-label="Main navigation">
      <a aria-current={isActive ? "page" : undefined}>
        {/* nav item */}
      </a>
    </nav>
  </SheetContent>
</Sheet>
```

### Focus Management

1. When menu opens, focus moves to first nav item
2. Focus is trapped within the menu while open
3. When menu closes, focus returns to trigger button

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .menu-container,
  .nav-item {
    animation: none;
    transition: none;
  }
}
```

---

## Implementation Notes

### Dependencies

```tsx
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Home, LayoutDashboard, Calendar, CheckSquare, Settings, HelpCircle } from "lucide-react"
```

### Props Interface

```tsx
interface MenuProps {
  /** Currently active route */
  activeRoute: "dashboard" | "schedule" | "chores" | "settings"
  /** Family name to display */
  familyName?: string
  /** Callback when menu opens/closes */
  onOpenChange?: (open: boolean) => void
}
```

### Route Configuration

```tsx
const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/schedule", label: "Schedule", icon: Calendar },
  { href: "/chores", label: "Chore Log", icon: CheckSquare },
  { href: "/settings", label: "Settings", icon: Settings },
]
```

---

## Visual Reference

See `menu-design2.png` for the visual mockup.

---

*Last updated: December 2024*
