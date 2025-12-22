# App Header Specification

## Overview

The App Header is the primary navigation bar that appears at the top of every screen.

**Mode determination:** The interaction mode is determined by the route group - `(wall)/` for Wall Display, `(manage)/` for Management.

---

## Header Elements

| Element       | Wall      | Manage      | Status      |
| ------------- | --------- | ----------- | ----------- |
| Brand Area    | View only | Opens menu  | MVP         |
| Weather       | Visible   | Visible     | **Phase 2** |
| Add Event     | Hidden    | Button      | MVP         |
| Notifications | View only | Interactive | **Phase 2** |
| Avatar        | Hidden    | Opens menu  | MVP         |

### Wall Display Mode (`(wall)/` routes)

Simplified "kiosk" header:

- Brand logo and family name visible
- Weather widget visible (Phase 2)
- No interactive buttons

### Management Mode (`(manage)/` routes)

Full header with interactive elements:

- Add Event button (primary CTA)
- Notifications with badge (Phase 2)
- User menu via avatar

---

## Components

### Brand Area

| Element        | Specification                         |
| -------------- | ------------------------------------- |
| Icon container | 48×48px, primary bg, circular         |
| Icon           | Home (Lucide), 24px, dark             |
| Title          | "Family Planner", 20px Bold           |
| Tagline        | "FAMILY OS", 12px, primary, uppercase |

### Weather Display (Phase 2)

| Element     | Specification               |
| ----------- | --------------------------- |
| Container   | Pill shape, border          |
| Icon        | Weather condition, 20px     |
| Temperature | 14px SemiBold, tabular-nums |

_Requires: Weather API integration spec_

### Primary Action Button (Add Event)

**Management Mode Only**

| Property   | Value               |
| ---------- | ------------------- |
| Background | Primary (#13ec92)   |
| Text       | Dark, 14px SemiBold |
| Icon       | Plus, 18px          |
| Min height | 44px                |

### Action Icons

| Property   | Value            |
| ---------- | ---------------- |
| Size       | 44×44px          |
| Icon size  | 22px             |
| Icon color | Secondary        |
| Hover      | Surface hover bg |

### Notification Badge (Phase 2)

| Property   | Value             |
| ---------- | ----------------- |
| Position   | Top-right of bell |
| Min size   | 18px              |
| Background | Red-500           |
| Font       | 10px Bold         |

_Requires: Notification system spec_

---

## Responsive Behavior

| Breakpoint | Changes                       |
| ---------- | ----------------------------- |
| < 640px    | Add Event icon-only           |
| 640-1024px | All elements, reduced spacing |
| > 1024px   | Full layout                   |

---

## Implementation Notes

- **Locale handling:** Routes prefixed with `[locale]` via next-intl
- **Mode layouts:** `(wall)/layout.tsx` and `(manage)/layout.tsx` render different headers
- **Add Event:** Opens dialog via `CalendarProvider` context
- **Auth state:** Use better-auth session for avatar/user menu
- **Components:** Use shadcn/ui Button, Avatar from `src/components/ui/`

---

## Design Reference

See `docs/design/ui/header/` for visual mockups.
