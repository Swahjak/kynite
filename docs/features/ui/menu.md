# Navigation Menu Specification

## Overview

The menu is a slide-out drawer (Sheet) triggered from the header. It provides primary navigation for the application.

**Mode determination:** The interaction mode is determined by the route group - `(wall)/` for Wall Display, `(manage)/` for Management.

---

## Navigation Items

| Item     | Icon (Lucide) | Route       | Wall | Manage |
| -------- | ------------- | ----------- | ---- | ------ |
| Calendar | Calendar      | `/calendar` | Yes  | Yes    |
| Chores   | CheckSquare   | `/chores`   | No   | Yes    |
| Settings | Settings      | `/settings` | No   | Yes    |
| Help     | HelpCircle    | (modal)     | Yes  | Yes    |

### Wall Display Mode (`(wall)/` routes)

Simplified navigation for kiosk/hub display:

- Calendar accessible (main hub view)
- Chores, Settings hidden
- Help visible

### Management Mode (`(manage)/` routes)

Full navigation with all items:

- All navigation items accessible
- Settings for configuration

---

## Anatomy

```
+-----------------------------+
| Brand Header                |
|   [Icon] Family Planner     |
|          [Family Name]      |
+-----------------------------+
| Navigation                  |
|   ▣ Calendar         active |
|   ▢ Chores    (mgmt only)   |
|   ▢ Settings  (mgmt only)   |
|                             |
|         (spacer)            |
+-----------------------------+
| Footer                      |
|   ⓘ Help                    |
+-----------------------------+
```

---

## Components

### Menu Container (Sheet)

| Property  | Value             |
| --------- | ----------------- |
| Width     | 256px             |
| Height    | 100vh             |
| Position  | Left side         |
| Animation | slideInLeft 200ms |

### Navigation Item

| State    | Background        | Text      |
| -------- | ----------------- | --------- |
| Active   | Primary (#13ec92) | Dark      |
| Inactive | Transparent       | Secondary |
| Hover    | Surface hover     | Primary   |

| Property   | Value     |
| ---------- | --------- |
| Min height | 48px      |
| Padding    | 12px 16px |
| Icon size  | 20px      |
| Gap        | 12px      |

---

## Accessibility

- Tab navigation between items
- Enter/Space to activate
- Escape to close
- Focus trapped while open
- `aria-current="page"` on active item

---

## Implementation Notes

- **Locale handling:** Routes prefixed with `[locale]` via next-intl (e.g., `/en/calendar`)
- **Mode layouts:** `(wall)/layout.tsx` and `(manage)/layout.tsx` control which items render
- **State management:** Use `CalendarProvider` for calendar-related state
- **Components:** Use shadcn/ui Sheet from `src/components/ui/`

---

## Design Reference

See `docs/design/ui/menu/` for visual mockups.
