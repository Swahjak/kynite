# Dashboard UI Specification

## Interaction Modes

| Mode             | Device         | User           | Purpose                              |
| ---------------- | -------------- | -------------- | ------------------------------------ |
| **Wall Display** | Mounted tablet | Kids/Family    | View schedule, see timers, see stars |
| **Management**   | Mobile/Desktop | Parents/Admins | Manage timers, configure actions     |

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

### Breakpoint Summary

| Breakpoint   | Sidebar | Grid        | Clock Size | Card Padding |
| ------------ | ------- | ----------- | ---------- | ------------ |
| < sm (640px) | Hidden  | 1 col       | 5rem       | 16px         |
| sm - lg      | Hidden  | 1 col       | 6rem       | 20px         |
| lg - xl      | Hidden  | 1 col       | 6rem       | 24px         |
| xl+          | Visible | 3 col (2:1) | 7rem       | 24px         |

---

## Components

### 1. Header

#### Desktop Header

Located within the main content area (not in sidebar).

| Element             | Specification                       |
| ------------------- | ----------------------------------- |
| Date/Weather widget | Top-right, card style               |
| Date format         | `Day, Mon DD` (e.g., "Mon, Oct 24") |
| Weather             | Temperature + condition + icon      |
| Background          | Surface color with subtle border    |
| Border radius       | xl (12px)                           |

#### Mobile Header

| Element      | Specification                               |
| ------------ | ------------------------------------------- |
| Logo         | Primary icon (home) + "Family Planner" text |
| Subtitle     | "Tap for Menu" with expand indicator        |
| Menu         | Dropdown with navigation items              |
| Date/Weather | Top-right, compact                          |

### 2. Greeting & Clock

The focal point of the dashboard, designed for wall-display visibility.

| Element        | Specification                        |
| -------------- | ------------------------------------ |
| Greeting       | Time-based, personalized             |
| Font           | Text Secondary color, xl-2xl size    |
| Clock          | Display XL (5rem-7rem), Black weight |
| Font family    | Lexend                               |
| Number style   | `tabular-nums` for consistent width  |
| Letter spacing | `tracking-tight`                     |

#### Greeting Logic

```typescript
function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Good Night";
}
```

Display format: `"{Greeting}, {FamilyName}"`

### 3. Today's Flow

A timeline view of the day's events, emphasizing temporal context.

#### Section Header

| Element      | Specification                       |
| ------------ | ----------------------------------- |
| Icon         | `schedule` in Primary color         |
| Title        | "Today's Flow", H2 Bold             |
| Badge        | "{n} Events Remaining", pill style  |
| Badge colors | Primary/10 background, Primary text |

#### Event Card States

**NOW (Current Event)**

| Property      | Value                 |
| ------------- | --------------------- | ------------- |
| Background    | Surface (white)       |
| Border-left   | 4px solid Primary     |
| Border radius | 2xl (16px)            |
| Shadow        | md                    |
| Layout        | Two-column: time info | event details |

| Element       | Specification                     |
| ------------- | --------------------------------- |
| Status badge  | "NOW" pill, Primary bg, dark text |
| Time          | 2xl-3xl Bold                      |
| Duration      | "Until {end time}", Muted text    |
| Event title   | 2xl Bold                          |
| Location      | Icon + text, Secondary color      |
| Category icon | 64px circle, category tint bg     |

**NEXT (Upcoming Event)**

| Property      | Value                           |
| ------------- | ------------------------------- |
| Background    | Surface with 60% opacity        |
| Border        | Transparent, hover shows border |
| Border radius | xl (12px)                       |
| Opacity       | 70% on time section             |

| Element       | Specification            |
| ------------- | ------------------------ |
| Status label  | "NEXT", uppercase, Muted |
| Time          | xl Bold                  |
| Event title   | xl Semibold              |
| Description   | sm, Secondary color      |
| Category icon | 48px circle              |

**LATER (Future Events)**

| Property        | Value                    |
| --------------- | ------------------------ |
| Background      | Surface with 40% opacity |
| Overall opacity | 80%                      |

Same structure as NEXT but with "LATER" label.

#### Event Category Colors

| Category          | Icon                    | Background | Icon Color |
| ----------------- | ----------------------- | ---------- | ---------- |
| Sports/Activities | `sports_soccer`         | green-50   | #0d9e61    |
| Meals/Kitchen     | `restaurant`, `skillet` | orange-50  | #FFB84D    |
| Reading/Quiet     | `auto_stories`          | purple-50  | #9C27B0    |
| Appointments      | `event`                 | blue-50    | blue-600   |
| Chores            | `cleaning_services`     | pink-50    | pink-500   |

#### Interaction

- **Tap/Click on event**: Navigate to calendar view, focused on event's time slot
- **Hover** (desktop): Subtle border appears, shadow increases

### 4. Active Timers

Displays currently running timers (display-only on Wall Display mode, manageable in Management mode).

#### Section Header

| Element | Specification            |
| ------- | ------------------------ |
| Icon    | `timer` in orange-500    |
| Title   | "Active Timers", H2 Bold |

#### Timer Card

| Property      | Value              |
| ------------- | ------------------ |
| Background    | Surface            |
| Border        | 1px Border Default |
| Border radius | 2xl (16px)         |
| Shadow        | sm                 |
| Padding       | 20px               |

| Element        | Specification                            |
| -------------- | ---------------------------------------- |
| Title          | lg Bold (e.g., "Screen Time")            |
| Subtitle       | sm Secondary (e.g., "Leo's Tablet")      |
| Time remaining | 5xl Black, `tabular-nums`                |
| Unit label     | "min left", Muted                        |
| Progress bar   | Bottom of card, 8px height, Primary fill |
| Category icon  | Top-right, 40px, tinted background       |

#### Timer Controls

| Button  | Style               | Wall Display | Management |
| ------- | ------------------- | ------------ | ---------- |
| "+ 15m" | Secondary/outline   | Visual only  | Functional |
| "Pause" | Destructive outline | Visual only  | Functional |

### 5. Weekly Stars

Gamification leaderboard showing children's achievement progress.

#### Section Header

| Element | Specification                             |
| ------- | ----------------------------------------- |
| Label   | "WEEKLY STARS", overline style            |
| Style   | xs Bold, uppercase, tracking-wider, Muted |

#### Family Member Row

| Property         | Value     |
| ---------------- | --------- |
| Background       | Surface   |
| Border radius    | xl (12px) |
| Padding          | 16px      |
| Gap between rows | 12px      |

| Element    | Specification                                               |
| ---------- | ----------------------------------------------------------- |
| Avatar     | 40-48px, circular, member color, ring                       |
| Name       | Base Bold                                                   |
| Level      | xs Muted (e.g., "Level 4 Explorer")                         |
| Star count | lg-2xl Bold                                                 |
| Star icon  | `star` filled, yellow-500                                   |
| Star badge | Pill with border, yellow-50 bg (leader) or gray-50 (others) |

#### Level Calculation

```typescript
function getLevel(starCount: number): number {
  return Math.floor(starCount / 10);
}

// Title varies by level
const levelTitles = ["Beginner", "Explorer", "Artist", "Champion", "Master"];
```

### 6. Quick Actions

A 2x2 grid of frequently used household actions that trigger predefined timers.

#### Grid Layout

| Property      | Value                |
| ------------- | -------------------- |
| Columns       | 2                    |
| Gap           | 12px                 |
| Button height | 80-96px (responsive) |

#### Action Button

| Property      | Value                                 |
| ------------- | ------------------------------------- |
| Background    | Surface (white) or Primary (featured) |
| Border        | 1px Border Default (non-featured)     |
| Border radius | xl (12px)                             |
| Shadow        | sm                                    |
| Transition    | `all 200ms ease`                      |
| Active        | `scale(0.95)`                         |

| Element | Specification            |
| ------- | ------------------------ |
| Icon    | 28-32px, category color  |
| Label   | sm Bold                  |
| Layout  | Vertical stack, centered |

#### Default Actions

| Action       | Icon                | Color      | Timer Duration    |
| ------------ | ------------------- | ---------- | ----------------- |
| Dinner Mode  | `restaurant`        | Primary bg | Configurable      |
| Water Plants | `water_drop`        | blue-500   | 5 min             |
| 15m Tidy     | `cleaning_services` | purple-500 | 15 min            |
| Log Chore    | `favorite`          | pink-500   | N/A (opens modal) |

#### Interaction

- **Tap/Click**: Starts the predefined timer associated with the action
- **Hover** (desktop): Background shifts to hover state, icon scales 1.1x

### 7. Sidebar (Desktop Only)

Fixed navigation panel on the left side.

| Property   | Value                        |
| ---------- | ---------------------------- |
| Width      | 288px (w-72)                 |
| Background | Surface                      |
| Border     | Right border, Border Default |
| Visibility | xl breakpoint and above      |

#### Sidebar Sections

**Header**

| Element      | Specification                 |
| ------------ | ----------------------------- |
| Family photo | 48px circle with Primary ring |
| Title        | "Family Planner", lg Bold     |
| Subtitle     | "{FamilyName}", sm Muted      |

**Navigation**

| Item      | Icon                 | State    |
| --------- | -------------------- | -------- |
| Dashboard | `dashboard` (filled) | Active   |
| Schedule  | `calendar_month`     | Inactive |
| Chore Log | `checklist`          | Inactive |
| Settings  | `settings`           | Inactive |

**Active nav item**

| Property      | Value          |
| ------------- | -------------- |
| Background    | Primary        |
| Text          | Dark (#10221a) |
| Icon          | Filled variant |
| Border radius | xl (12px)      |
| Shadow        | sm             |

**Inactive nav item**

| Property   | Value            |
| ---------- | ---------------- |
| Background | Transparent      |
| Text       | Text Secondary   |
| Hover      | Surface Hover bg |

**Footer**

| Element   | Specification              |
| --------- | -------------------------- |
| Help link | `help` icon + "Help" label |
| Position  | Bottom of sidebar          |

---

## Dark Mode

The dashboard fully supports dark mode via the `dark` class on `<html>`.

### Color Mapping

| Element         | Light   | Dark                |
| --------------- | ------- | ------------------- |
| Page background | #f6f8f7 | #10221a             |
| Surface/Cards   | #ffffff | #1c2e26             |
| Text Primary    | #111815 | #ffffff             |
| Text Secondary  | #618979 | #8baea0             |
| Borders         | #dbe6e1 | #2a3831             |
| Primary         | #13ec92 | #13ec92 (unchanged) |

### Transition

```css
body {
  transition:
    background-color 200ms ease,
    color 200ms ease;
}
```

---

## Accessibility

### WCAG 2.1 AA Compliance

| Requirement      | Implementation                               |
| ---------------- | -------------------------------------------- |
| Color contrast   | All text meets 4.5:1 (normal) or 3:1 (large) |
| Focus indicators | 2px Primary outline with 2px offset          |
| Touch targets    | Minimum 44x44px for all interactive elements |
| Screen readers   | Semantic HTML, ARIA labels on icons          |
| Reduced motion   | Respect `prefers-reduced-motion`             |

### Keyboard Navigation

| Key         | Action                            |
| ----------- | --------------------------------- |
| Tab         | Move between interactive elements |
| Enter/Space | Activate buttons, open menus      |
| Escape      | Close menus/modals                |
| Arrow keys  | Navigate within menus             |

### Screen Reader Considerations

- Clock announces on focus: "Current time: {time}"
- Events include full context: "{title} at {time}, {location}"
- Timers should announce remaining time
- Star counts labeled: "{name} has {count} stars"
- All buttons have descriptive aria-labels

---

## Animations

### Transitions

| Element       | Property                | Duration | Easing   |
| ------------- | ----------------------- | -------- | -------- |
| Buttons       | all                     | 200ms    | ease     |
| Cards (hover) | box-shadow, transform   | 200ms    | ease     |
| Icons (hover) | transform               | 200ms    | ease     |
| Color mode    | background-color, color | 200ms    | ease     |
| Menu appear   | opacity, transform      | 200ms    | ease-out |

### Interactive States

| State          | Effect                           |
| -------------- | -------------------------------- |
| Button hover   | Background shifts to hover color |
| Button active  | `scale(0.95)`                    |
| Card hover     | Shadow increases to md           |
| Icon hover     | `scale(1.1)`                     |
| Nav item hover | Background to Surface Hover      |

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

- Use existing contexts where applicable (e.g., `CalendarContext` for event data)
- Local state for UI interactions (menu open, etc.)
- Timer state synced via database or real-time updates
- Dashboard settings persisted to localStorage

### Performance Considerations

- Clock updates via `setInterval` (1 second)
- Memoize event filtering and sorting
- Lazy load non-critical components
- Use `will-change` for animated elements
