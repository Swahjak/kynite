# Navigation Menu Specification

## Overview

The menu is a slide-out drawer (Sheet) triggered from the header. It provides primary navigation for the application.

## Interaction Modes

| Item | Wall Display | Management |
|------|--------------|------------|
| Dashboard | Navigate | Navigate |
| Schedule | Navigate | Navigate |
| Chore Log | Navigate | Navigate |
| Settings | **Hidden** | Navigate |
| Help | Visible | Visible |

### Wall Display Mode

Simplified navigation without administrative functions:
- Dashboard, Schedule, Chore Log accessible
- Settings link hidden
- Help link visible

### Management Mode

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
|   ▣ Dashboard        active |
|   ▢ Schedule                |
|   ▢ Chore Log               |
|   ▢ Settings   (mgmt only)  |
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

| Property | Value |
|----------|-------|
| Width | 256px |
| Height | 100vh |
| Position | Left side |
| Animation | slideInLeft 200ms |

### Navigation Item

| State | Background | Text |
|-------|------------|------|
| Active | Primary (#13ec92) | Dark |
| Inactive | Transparent | Secondary |
| Hover | Surface hover | Primary |

| Property | Value |
|----------|-------|
| Min height | 48px |
| Padding | 12px 16px |
| Icon size | 20px |
| Gap | 12px |

### Navigation Items

| Item | Icon (Lucide) | Route |
|------|---------------|-------|
| Dashboard | LayoutDashboard | /dashboard |
| Schedule | Calendar | /schedule |
| Chore Log | CheckSquare | /chores |
| Settings | Settings | /settings |
| Help | HelpCircle | (modal) |

---

## Accessibility

- Tab navigation between items
- Enter/Space to activate
- Escape to close
- Focus trapped while open
- `aria-current="page"` on active item

---

## Design Reference

See `docs/design/ui/menu/` for visual mockups.
