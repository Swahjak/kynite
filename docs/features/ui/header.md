# App Header Specification

## Overview

The App Header is the primary navigation bar that appears at the top of every screen.

## Interaction Modes

| Element | Wall Display | Management |
|---------|--------------|------------|
| Brand Area | View only | Opens menu |
| Weather | Visible | Visible |
| Add Event | **Hidden** | Visible |
| Settings | **Hidden** | Visible |
| Notifications | View only | Interactive |
| Avatar | View only | Opens menu |

### Wall Display Mode

The header displays in a simplified "kiosk" mode:
- Brand logo and family name visible
- Weather widget visible
- Notifications badge visible (view only)
- No interactive buttons except navigation

### Management Mode

Full header with all interactive elements:
- Add Event button (primary CTA)
- Settings button
- Notifications with badge
- User menu via avatar

---

## Components

### Brand Area

| Element | Specification |
|---------|---------------|
| Icon container | 48×48px, primary bg, circular |
| Icon | Home (Lucide), 24px, dark |
| Title | "Family Planner", 20px Bold |
| Tagline | "FAMILY OS", 12px, primary, uppercase |

### Weather Display (Optional)

| Element | Specification |
|---------|---------------|
| Container | Pill shape, border |
| Icon | Weather condition, 20px |
| Temperature | 14px SemiBold, tabular-nums |

### Primary Action Button

**Management Mode Only**

| Property | Value |
|----------|-------|
| Background | Primary (#13ec92) |
| Text | Dark, 14px SemiBold |
| Icon | Plus, 18px |
| Min height | 44px |

### Action Icons

| Property | Value |
|----------|-------|
| Size | 44×44px |
| Icon size | 22px |
| Icon color | Secondary |
| Hover | Surface hover bg |

### Notification Badge

| Property | Value |
|----------|-------|
| Position | Top-right of bell |
| Min size | 18px |
| Background | Red-500 |
| Font | 10px Bold |

---

## Responsive Behavior

| Breakpoint | Changes |
|------------|---------|
| < 640px | Hide weather, Add Event icon-only |
| 640-1024px | All elements, reduced spacing |
| > 1024px | Full layout |

---

## Design Reference

See `docs/design/ui/header/` for visual mockups.
