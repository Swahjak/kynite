# Dashboard UI Specification

## Interaction Modes

| Mode | Device | User | Purpose |
|------|--------|------|---------|
| **Wall Display** | Mounted tablet | Kids/Family | View schedule, see timers, see stars |
| **Management** | Mobile/Desktop | Parents/Admins | Manage timers, configure actions |

### Wall Display Mode

**Allowed Actions:**
- View clock and greeting
- View today's schedule
- View active timers (display only)
- View weekly stars
- Tap quick actions to start predefined timers

**Hidden/Disabled:**
- Timer pause/extend buttons (display only)
- Quick action configuration
- Sidebar navigation to Settings

**Touch Targets:** 48px minimum

### Management Mode

**Full Access:**
- All viewing capabilities
- Timer management (pause, extend, cancel)
- Quick action configuration
- Full navigation access

---

## Layout

### Desktop (xl+)

```
+------------------------------------------------------------------+
| Header                                                            |
+------------------------------------------------------------------+
|          |  Greeting + Clock                                      |
| Sidebar  +--------------------------------------------------------+
|          |  Today's Flow (2/3)    |  Timers + Stars (1/3)        |
|          |                        |                               |
+----------+------------------------+-------------------------------+
```

- Sidebar: 288px fixed
- Main content: 3-column grid (2:1 ratio)
- Max width: 1600px centered

### Mobile (< xl)

Single column with stacked sections. Hamburger menu replaces sidebar.

---

## Components

### Greeting & Clock

| Element | Specification |
|---------|---------------|
| Greeting | Time-based, xl-2xl, secondary color |
| Clock | 5-7rem, black weight, tabular-nums |
| Font | Lexend |

### Today's Flow

**Event Card States:**

| State | Background | Border | Features |
|-------|------------|--------|----------|
| NOW | Surface white | 4px primary left | "NOW" badge, shadow |
| NEXT | 60% opacity | Transparent | "NEXT" label |
| LATER | 40% opacity | Transparent | "LATER" label |

### Active Timers

**Display Only on Wall Display:**
- Timer title and subtitle
- Time remaining (5xl, tabular-nums)
- Progress bar (8px, primary fill)
- "+15m" and "Pause" buttons visible but non-functional

### Weekly Stars

| Element | Specification |
|---------|---------------|
| Avatar | 40-48px circular with ring |
| Name | Base Bold |
| Level | xs Muted |
| Stars | lg-2xl Bold with star icon |

### Quick Actions

2x2 grid of action buttons that trigger predefined timers.

| Action | Icon | Timer |
|--------|------|-------|
| Dinner Mode | restaurant | Configurable |
| Water Plants | water_drop | 5 min |
| 15m Tidy | cleaning_services | 15 min |
| Log Chore | favorite | Opens modal |

---

## Accessibility

- Clock announces on focus: "Current time: {time}"
- Events include full context: "{title} at {time}, {location}"
- Star counts labeled: "{name} has {count} stars"
- All buttons have descriptive aria-labels
