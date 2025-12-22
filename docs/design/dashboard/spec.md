# Dashboard Design Reference

> **Visual Reference Only**
>
> This document contains visual mockups and styling references. For implementation
> requirements, data models, and interaction rules, see the feature specification
> in `docs/features/dashboard/`.
>
> When implementing, apply the project's brand guidelines and established patterns
> from the codebase. Do not copy mockup code directly.

---

## Overview

The dashboard serves as the **home screen** for the Family Planner application. It provides an at-a-glance view of the family's day, designed for quick consumption on wall-mounted displays and mobile devices.

### Target Contexts

| Context             | Display                 | Interaction      |
| ------------------- | ----------------------- | ---------------- |
| Wall-mounted tablet | Large (10"+), always-on | Occasional touch |
| Mobile phone        | Small (5-7"), on-demand | Frequent touch   |
| Desktop browser     | Large, secondary use    | Mouse/keyboard   |

---

## Layout Reference

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

---

## Design Assets

| File                     | Description                            |
| ------------------------ | -------------------------------------- |
| `dashboard-design-1.png` | Desktop layout with sidebar            |
| `dashboard-design-2.png` | Tablet layout without sidebar          |
| `dashboard-code-1.html`  | Full HTML/CSS reference implementation |
| `dashboard-code-2.tsx`   | React component reference              |

---

## Color Reference

These are the design mockup colors. Apply project brand guidelines when implementing.

| Element         | Light   | Dark    |
| --------------- | ------- | ------- |
| Page background | #f6f8f7 | #10221a |
| Surface/Cards   | #ffffff | #1c2e26 |
| Primary accent  | #13ec92 | #13ec92 |

---

_For complete specifications, see [docs/features/dashboard/](../../features/dashboard/spec.md)_
