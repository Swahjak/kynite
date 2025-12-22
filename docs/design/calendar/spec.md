# Calendar Specification

> **Design Reference Only**
>
> This document contains visual mockups and styling references. For implementation
> requirements, data models, and interaction rules, see the feature specification
> in `docs/features/calendar/`.
>
> When implementing, apply the project's brand guidelines and established patterns
> from the codebase. Do not copy mockup code directly.

This document defines the comprehensive specification for the Family Planner calendar component, including views, interactions, styling, and integrations.

---

## Table of Contents

1. [Overview](#overview)
2. [Views](#views)
3. [Event Management](#event-management)
4. [Filtering & Navigation](#filtering--navigation)
5. [Drag & Drop](#drag--drop)
6. [Gamification Integration](#gamification-integration)
7. [Chores Integration](#chores-integration)
8. [Calendar Header](#calendar-header)
9. [Settings](#settings)
10. [Responsive Design](#responsive-design)
11. [Brand Styling](#brand-styling)
12. [Technical Implementation](#technical-implementation)

---

## Overview

The calendar is the core feature of Family Planner, providing a centralized view of family schedules. It integrates with Google Calendar and Google Tasks to display events, and connects with the Chores module for task management.

### Design Principles

- **Warm & Welcoming**: Use the Family Planner brand identity with primary green (#13ec92) accents
- **Organized & Reliable**: Clear visual hierarchy, intuitive navigation
- **Playful yet Functional**: Engaging for all family members while remaining practical
- **Wall Display Optimized**: Large touch targets, glanceable information, high contrast

### Key Features

- Multiple calendar views (Today, Day, Week, Month)
- Family member filtering with color-coded avatars
- Event color categorization
- Drag-and-drop event rescheduling
- Gamification elements (streaks, XP indicators)
- Chores/tasks integration
- Dark mode support
- Internationalization (nl/en)

---

## Views

The calendar supports four primary views accessible via the view tabs. The Year and Agenda views remain in the codebase but are hidden from the UI.

### View Tabs Configuration

| View | Icon | Label | Description |
|------|------|-------|-------------|
| Today | `view_day` | Today | Family-focused daily overview |
| Day | `calendar_today` | Day | Hourly timeline for selected date |
| Week | `calendar_view_week` | Week | 7-day hourly grid |
| Month | `calendar_month` | Month | Full month grid with day detail sidebar |

> **Note**: Year and Agenda views are retained in code for potential future use but removed from the view tabs UI.

---

### Today View (Custom)

**Purpose**: A family-focused daily dashboard showing each family member's schedule and tasks in parallel columns.

**Layout**: Horizontal scrolling columns, one per family member

#### Header Section

```
┌─────────────────────────────────────────────────────────────────┐
│ [Wednesday, Oct 24]        [08:45 AM]        [Day][Week][Month] │
│ [Weather: 72°F Sunny]                                           │
└─────────────────────────────────────────────────────────────────┘
```

- **Date Display**: Full date with day name (Lexend, 32px, Bold)
- **Clock**: Large digital clock with AM/PM indicator (Lexend, 48px, Bold)
- **Weather Widget**: Icon + temperature + brief description
- **View Toggle**: Pill-style toggle for Day/Week/Month

#### Family Member Columns

Each family member gets a scrollable column:

```
┌─────────────────────────────────┐
│ [Avatar] [Name]      [Lvl 12]  │
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░ 75%          │
├─────────────────────────────────┤
│ SCHEDULE                        │
│ ┌─────────────────────────────┐│
│ │ 07:00 AM  ✓                 ││
│ │ Morning Yoga                ││
│ └─────────────────────────────┘│
│ ┌─────────────────────────────┐│
│ │ 08:30 AM - 10:00 AM    NOW  ││
│ │ Deep Work Session           ││
│ │ Home Office                 ││
│ └─────────────────────────────┘│
│ ┌─────────────────────────────┐│
│ │ 12:30 PM                    ││
│ │ Lunch w/ Client             ││
│ │ Downtown Bistro             ││
│ └─────────────────────────────┘│
├─────────────────────────────────┤
│ TASKS                    2/5   │
│ ☐ Pay Electricity Bill  +20 XP │
│ ☐ Pick up Dry Cleaning  +15 XP │
│ ☑ Water Plants          Done   │
└─────────────────────────────────┘
```

#### Column Components

**User Header**:
- Avatar (48px, circular, border-2 border-white shadow)
- Name (Lexend, 18px, Bold)
- Level badge (primary background, 10px uppercase)
- XP progress bar (primary color, 6px height)

**Schedule Section**:
- Section label: "SCHEDULE" (12px, uppercase, tracking-wider, text-secondary)
- Event cards with left border color indicator (4px)
- Past events: Reduced opacity (60%), checkmark icon
- Current event: "NOW" badge, subtle shadow, optional red time indicator line
- Future events: Full opacity

**Event Card Anatomy**:
```
┌────────────────────────────────┐
│ [Time]               [Badge]   │  ← Time in category color
│ [Title]                        │  ← Bold, 14px
│ [Location/Details]             │  ← Optional, 12px, text-secondary
│ [Assignee avatars]             │  ← Optional, stacked circles
└────────────────────────────────┘
```

**Tasks Section**:
- Section label: "TASKS" with completion count (e.g., "2/5 Done")
- Task items from Chores module (see [Chores Integration](#chores-integration))
- Checkbox with XP reward indicator
- Completed tasks: Strikethrough, reduced opacity

**Empty States**:
- No events: "Free Day!" with celebration emoji
- No morning events: "No morning events" in dashed border container

**Add Column Button**:
- Rightmost position, always visible
- Dashed border, hover: primary color
- Icon: `add` (40px)

---

### Day View

**Purpose**: Detailed 24-hour timeline view for a single day with mini calendar sidebar.

**Layout**: Two-panel layout (desktop), single panel (mobile)

#### Desktop Layout

```
┌────────────────────────────────────────────────────────────────────┐
│                         [Header]                                    │
├──────────────────┬─────────────────────────────────────────────────┤
│   Mini Calendar  │              24-Hour Timeline                    │
│   + Happening    │                                                  │
│     Now Panel    │   [Multi-day events row]                        │
│                  │   ──────────────────────────────────────────────│
│                  │   00:00 │                                        │
│                  │   01:00 │                                        │
│                  │   ...   │ [Event blocks positioned by time]      │
│                  │   23:00 │                                        │
└──────────────────┴─────────────────────────────────────────────────┘
```

#### Sidebar (>md breakpoint)

**Mini Calendar**:
- Compact month grid with current day highlighted
- Click date to navigate
- Shows event indicator dots

**Happening Now Panel**:
- Live indicator for currently active events
- Pulsing dot animation
- Event title and time remaining

#### Main Timeline

**Time Column**:
- Hour labels (00:00-23:00 or 12:00 AM-11:00 PM based on settings)
- Tabular numbers for consistent width
- Font: Lexend, 12px, text-secondary

**Event Blocks**:
- Positioned by start time and duration
- Width calculated based on overlapping events
- Left border with event color (4px)
- Background: Event color at 10% opacity
- Hover: Elevate with shadow

**Multi-day Events Row**:
- Separate row above timeline for spanning events
- Horizontal bar representation
- Click to view details

**Current Time Indicator**:
- Red horizontal line spanning full width
- "NOW" badge on right edge
- Auto-scrolls into view on mount

---

### Week View

**Purpose**: 7-day overview with hourly time grid for scheduling at a glance.

**Layout**: Traditional calendar week grid with time axis

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              [Header]                                     │
├──────────────────────────────────────────────────────────────────────────┤
│        │  MON    │  TUE    │  WED    │  THU    │  FRI    │  SAT  │  SUN  │
│        │   23    │   24    │   25    │   26    │   27    │   28  │   29  │
│        │         │ TODAY   │         │         │         │       │       │
├────────┼─────────┼─────────┼─────────┼─────────┼─────────┼───────┼───────┤
│ Multi-day events row                                                      │
├────────┼─────────┼─────────┼─────────┼─────────┼─────────┼───────┼───────┤
│ 00:00  │         │         │         │         │         │       │       │
│ 01:00  │         │         │         │         │         │       │       │
│ ...    │ [Events positioned in grid]                                      │
│ 23:00  │         │         │         │         │         │       │       │
└────────┴─────────┴─────────┴─────────┴─────────┴─────────┴───────┴───────┘
```

#### Day Headers

**Structure**:
- Weekday abbreviation (MON, TUE, etc.) - 12px, uppercase, text-secondary
- Day number - 24px, Bold
- "TODAY" badge on current day (primary background)
- Weekend days: Red text for weekday label

**Today Highlight**:
- Primary background on header cell
- Primary/10 background on entire column
- Border-top accent bar (2px primary)

#### Time Grid

**Configuration**:
- 24 rows (one per hour)
- 7 columns (Mon-Sun, week starts Monday)
- Grid lines: border-default color
- Hour labels: Left axis, every hour

**Event Rendering**:
- Same as Day View event blocks
- Grouped side-by-side when overlapping
- Max 3 events visible per slot, "+N more" overflow

#### Mobile Behavior

- Shows warning message: "Week view is optimized for larger screens"
- Suggests switching to Day or Month view
- Horizontal scroll available but not recommended

---

### Month View

**Purpose**: Full month overview with quick event indicators and selected day detail sidebar.

**Layout**: Month grid with collapsible right sidebar

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              [Header]                                     │
├───────────────────────────────────────────────────────────┬──────────────┤
│                      Month Grid                           │  Day Detail  │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐            │   Sidebar    │
│  │ SUN │ MON │ TUE │ WED │ THU │ FRI │ SAT │            │              │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤            │ Oct 24 - Tue │
│  │ 29  │ 30  │  1  │  2  │  3  │  4  │  5  │            │ Today's      │
│  │     │     │  •  │     │  ══ │  •  │ 🏆  │            │ Agenda       │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤            ├──────────────┤
│  │  6  │  7  │  8  │  9  │ 10  │ 11  │ 12  │            │ [Weather]    │
│  │ ══  │     │  •  │ ══  │  •  │     │ ••  │            │              │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤            ├──────────────┤
│  │ ... │     │     │     │     │     │     │            │ [Timeline]   │
│  │     │     │     │[24] │     │     │     │ ← Today    │              │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘            │ 08:00 School │
│                                                          │ 06:00 Dinner │
│                                                          │              │
│                                                          ├──────────────┤
│                                                          │ [Routines]   │
│                                                          │ ☑ Meds       │
│                                                          │ ☐ Trash out  │
└──────────────────────────────────────────────────────────┴──────────────┘
```

#### Month Grid

**Cell Structure**:
```
┌───────────────┐
│ [Day Number]  │  ← Top-left, bold for current month
│               │
│ [Event Dots]  │  ← Up to 3 dots/bars, colors indicate events
│ [Trophy]      │  ← Bottom-right, achievement indicator
└───────────────┘
```

**Day Number Styling**:
- Current month: text-primary, font-medium
- Adjacent months: text-muted, opacity-50
- Today: Primary background circle, white text, shadow

**Event Indicators**:
- Dot variant: Small colored circles (6px)
- Bar variant: Horizontal colored bars (6px height, variable width)
- Max 3 indicators visible, prioritize multi-day events
- Click cell to view full event list

**Achievement Indicators**:
- Trophy icon (emoji_events) for days with completed chores
- Yellow/gold color when achieved
- Gray when pending for today

**Today Highlight**:
- Background: primary/10
- Border: 1px solid primary (ring-inset)
- Day number: Primary circle badge

**Hover States**:
- Background: surface-hover
- Cursor: pointer
- Day number: font-bold

#### Day Detail Sidebar

**Visibility**: Desktop only (>lg breakpoint), collapsible

**Header**:
- Selected date: "Oct 24 - Tuesday" (Lexend, 20px, Bold)
- Subtitle: "Today's Agenda" (14px, text-secondary)

**Weather Widget**:
- Background: blue-50 (light) / blue-900/20 (dark)
- Icon: Weather symbol (32px)
- Temperature: Bold, 18px
- Description: 12px, text-secondary

**Timeline Section**:
- Vertical timeline with left border (2px)
- Event nodes: Colored circles (16px) on timeline
- Time labels: 12px, bold, text-secondary
- Event cards: White background, subtle shadow

**Daily Routines Section**:
- Background: surface-elevated or slight gray
- Checkbox items from Chores module
- Completed: Strikethrough, checkmark icon

---

## Event Management

### Event Data Structure

```typescript
interface IEvent {
  id: number
  title: string
  description: string
  startDate: string      // ISO 8601 format
  endDate: string        // ISO 8601 format
  color: TEventColor     // 'blue' | 'green' | 'red' | 'yellow' | 'purple' | 'orange'
  user: IUser
}

interface IUser {
  id: string
  name: string
  picturePath: string | null
}
```

### Event Colors

Events are color-coded by category. Colors align with the brand color palette:

| Color | CSS Classes | Use Cases |
|-------|-------------|-----------|
| Blue | `blue-50`, `blue-400`, `blue-600` | Sports, activities, outdoor events |
| Purple | `purple-50`, `purple-400`, `purple-600` | Personal, gym, self-care |
| Orange | `orange-50`, `orange-400`, `orange-600` | Lessons, learning, education |
| Green | `green-50`, `green-500`, `green-700` | Family events, meals, gatherings |
| Red | `red-50`, `red-400`, `red-600` | Date nights, special occasions |
| Yellow | `yellow-50`, `yellow-400`, `yellow-700` | Celebrations, birthdays, parties |

### Event Dialogs

#### Add/Edit Event Dialog

**Trigger**: "Add Event" button, double-click on empty cell, or edit existing event

**Fields**:
- Title (required) - Text input
- Description (optional) - Textarea
- Start Date/Time - Date picker + time input
- End Date/Time - Date picker + time input
- Color - Color picker with 6 options
- Assigned User - User dropdown

**Pre-filling**:
- When clicking a specific cell/time slot, pre-fill date and time
- When editing, populate all fields from existing event

#### Event Details Dialog

**Trigger**: Click on event

**Content**:
- Event title (large, bold)
- Date and time range
- Color indicator
- Description
- Assigned user with avatar
- Edit button
- Delete button

#### Delete Event Dialog

**Trigger**: Delete button in event details

**Content**:
- Confirmation message
- Event title for reference
- Cancel and Confirm buttons

---

## Filtering & Navigation

### Date Navigation

**Controls**:
- Previous/Next buttons (chevron icons)
- "Today" button to jump to current date

**Navigation Behavior by View**:
| View | Previous | Next |
|------|----------|------|
| Today | Previous day | Next day |
| Day | Previous day | Next day |
| Week | Previous week | Next week |
| Month | Previous month | Next month |

### Family Member Filter

**Design**: Horizontal pill buttons with avatars

```
[👥 Everyone] [🟦 Mom] [🟩 Dad] [🟪 Maya] [🟧 Leo]
```

**States**:
- **Active**: Dark background (#111815), white text, bold
- **Inactive**: White background, border, text-secondary

**Avatar Indicators**:
- Material symbol faces or user photos
- Color-coded per family member (see brand guidelines)

**Behavior**:
- Single select (one member or "Everyone")
- "Everyone" shows all events
- Member selection filters events to that user only

### Color Filter

**Location**: Header dropdown menu

**Design**: Multi-select checkboxes with color swatches

**Behavior**:
- Multiple colors can be selected
- Empty selection = show all colors
- "Clear filters" button resets selection

---

## Drag & Drop

### Overview

Events can be rescheduled by dragging them to a new date/time slot.

### DnD Context

```typescript
interface DndContextValue {
  isDragging: boolean
  draggedEvent: IEvent | null
  pendingDrop: { date: Date; hour?: number; minute?: number } | null
  startDrag: (event: IEvent) => void
  endDrag: () => void
  handleEventDrop: (date: Date, hour?: number, minute?: number) => void
  handleConfirmDrop: () => void
  handleCancelDrop: () => void
}
```

### Draggable Events

**Visual Feedback**:
- Cursor: `grab` on hover, `grabbing` while dragging
- Opacity: Reduced to 50% on source while dragging
- Ghost image: Browser default drag preview

### Drop Zones

**Day/Week Views**: Hour slots are drop targets
**Month View**: Day cells are drop targets

**Drop Zone Feedback**:
- Background: `primary/10` on valid drop target hover
- Border: `primary` highlight

### Confirmation Dialog

**Optional Setting**: Can be enabled in settings

**Dialog Content**:
- Original date/time
- New date/time
- Event title
- Confirm/Cancel buttons

### Auto-Scroll

When dragging near viewport edges:
- Trigger zone: 50px from edge
- Scroll speed: 15px per frame
- Smooth scrolling animation

---

## Gamification Integration

The calendar displays gamification elements from the Family Planner gamification system.

### Family Streak Badge

**Location**: Calendar header, next to view toggle

**Design**:
```
┌─────────────────────────────┐
│ 🔥 STREAK                   │
│    85%    ▓▓▓▓▓▓▓▓░░       │
└─────────────────────────────┘
```

**Components**:
- Fire icon (local_fire_department or emoji)
- "STREAK" label (10px, uppercase, text-secondary)
- Percentage value (18px, bold, primary color)
- Progress bar (primary fill, 8px height)

### User Level & XP (Today View)

**Location**: Family member column headers

**Level Badge**:
- Background: primary/20
- Text: primary-dark, bold, 10px
- Format: "Lvl 12"

**XP Progress Bar**:
- Full width below name
- Height: 6px
- Background: border-default
- Fill: primary
- Rounded ends

### Achievement Indicators (Month View)

**Trophy Icons on Day Cells**:
- Completed all chores: Gold trophy (yellow-500)
- Partial completion: Gray trophy (text-muted)
- No chores that day: No icon

---

## Chores Integration

The calendar integrates with the Chores module to display tasks and routines.

### Data Flow

```
Chores Module → Calendar Component
     ↓
[Tasks for selected date]
     ↓
Display in Today View columns
Display in Month View sidebar
```

### Task Display

**Task Item Structure**:
```
┌─────────────────────────────────────┐
│ [☐] [Task Title]           [+20 XP] │
└─────────────────────────────────────┘
```

**Components**:
- Checkbox: Rounded, primary accent color when checked
- Title: 14px, medium weight
- XP Badge: primary/20 background, primary-dark text

**States**:
- Pending: Full opacity, unchecked
- Completed: Strikethrough, reduced opacity, "Done" badge

### Daily Routines Section

**Label**: "Daily Routines" or "Tasks" (uppercase, 12px)
**Count**: "2/5 Done" format on right

### Integration Points

The calendar spec defines visual representation only. Task data comes from the Chores module via:
- Context/state management
- API endpoints (to be defined in Chores spec)

---

## Calendar Header

The header provides navigation, filtering, and actions.

### Desktop Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ [🏠 Wall Hub]          [☀️ 72°F]  [+ Add Event] [⚙️] [🔔] [👤]           │
│  Family OS                                                                  │
├────────────────────────────────────────────────────────────────────────────┤
│ [<] [Oct 23 - Oct 29] [>]                    [Streak 85%] [Today|Week|...] │
│     Manage your family's...                                                 │
├────────────────────────────────────────────────────────────────────────────┤
│ [👥 Everyone] [Mom] [Dad] [Maya] [Leo]                                     │
└────────────────────────────────────────────────────────────────────────────┘
```

### Components

#### Brand Section (Top Left)
- Home icon in primary/20 rounded container
- "Wall Hub" text (20px, bold)
- "Family OS" tagline (10px, uppercase, text-secondary)

#### Actions (Top Right)
- Weather widget (icon + temperature)
- Add Event button (primary background, icon + text)
- Settings button (icon only)
- Notifications button (with badge dot)
- User avatar (circular, border-primary)

#### Navigation Row
- Previous/Next chevron buttons
- Date range text (32px, bold, tracking-tight)
- Subtitle text (14px, text-secondary)
- Streak badge
- View toggle pills

#### Filter Row
- Family member filter pills (horizontally scrollable on mobile)

### Mobile Adaptations

- Collapse weather to icon only
- Add Event becomes icon-only button
- Hide settings in hamburger menu
- View toggle moves to header actions
- Family filters become horizontally scrollable

---

## Settings

Settings are accessible via the settings dropdown in the header.

### Available Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Dark Mode | Toggle | System | Light/dark theme preference |
| Time Format | Toggle | 24-hour | Show times as 24h or 12h AM/PM |
| Badge Variant | Toggle | Colored | Event indicators: dots or colored bars |
| DnD Confirmation | Toggle | Off | Show confirmation before drop |
| Language | Select | nl | Dutch or English |

### Settings Panel Design

**Container**: Popover or slide-out panel

**Toggle Items**:
```
┌─────────────────────────────────┐
│ Dark Mode                    [○]│
│ Enable dark theme               │
├─────────────────────────────────┤
│ 24-Hour Format               [●]│
│ Use 24-hour time display        │
├─────────────────────────────────┤
│ Confirm Drag & Drop          [○]│
│ Ask before rescheduling events  │
└─────────────────────────────────┘
```

### Persistence

All settings persist to localStorage:
- Key prefix: `family-planner-calendar-`
- Values: JSON serialized

---

## Responsive Design

### Breakpoints

| Breakpoint | Min Width | Target Devices |
|------------|-----------|----------------|
| sm | 640px | Large phones |
| md | 768px | Tablets |
| lg | 1024px | Small laptops |
| xl | 1280px | Desktops |
| 2xl | 1536px | Large displays, wall-mounted |

### View Adaptations

#### Today View
- **Mobile (<md)**: Single column, swipe between members
- **Tablet (md-lg)**: 2 columns visible
- **Desktop (>lg)**: 3-4 columns visible
- **Wall Display (>2xl)**: All columns visible

#### Day View
- **Mobile**: Hide sidebar, full-width timeline
- **Desktop**: Show sidebar with mini calendar

#### Week View
- **Mobile**: Show warning, suggest day/month view
- **Desktop**: Full 7-column grid

#### Month View
- **Mobile**: Grid only, hide sidebar
- **Desktop**: Grid + detail sidebar

### Touch Targets

All interactive elements must meet minimum touch target size:
- Minimum: 44x44px
- Recommended: 48x48px

Add `.touch-target-lg` class for larger targets on wall displays.

---

## Brand Styling

All calendar components follow the Family Planner brand guidelines.

### Color Variables

```css
/* Primary */
--color-primary: #13ec92;
--color-primary-hover: #0fd683;
--color-primary-dark: #0d9e61;

/* Backgrounds */
--color-background-light: #f6f8f7;
--color-background-dark: #10221a;
--color-surface-light: #ffffff;
--color-surface-dark: #1c2e26;

/* Text */
--color-text-primary-light: #111815;
--color-text-primary-dark: #ffffff;
--color-text-secondary-light: #618979;
--color-text-secondary-dark: #8baea0;

/* Borders */
--color-border-light: #dbe6e1;
--color-border-dark: #2a3831;
```

### Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Page Title | Lexend | 32px | Bold |
| Section Title | Lexend | 20px | SemiBold |
| Event Title | Lexend | 14px | SemiBold |
| Time Labels | Lexend | 12px | Bold |
| Body Text | Noto Sans | 14px | Regular |
| Captions | Lexend | 12px | Medium |
| Labels | Lexend | 10px | Bold, uppercase |

### Shadows

| Level | Value | Usage |
|-------|-------|-------|
| SM | `0 1px 2px rgba(0,0,0,0.05)` | Cards, event blocks |
| MD | `0 4px 6px rgba(0,0,0,0.1)` | Dropdowns, popovers |
| LG | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dialogs |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| default | 4px | Subtle rounding |
| lg | 8px | Buttons, inputs |
| xl | 12px | Cards |
| 2xl | 16px | Large cards, modals |
| full | 9999px | Pills, avatars |

### Animations

```css
/* Standard transition */
transition: all 200ms ease;

/* Button press */
.button:active {
  transform: scale(0.95);
}

/* Card hover */
.card:hover {
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
```

Respect `prefers-reduced-motion` for accessibility.

---

## Technical Implementation

### Component Architecture

```
src/components/calendar/
├── index.tsx                 # Main calendar component
├── interfaces.ts             # TypeScript interfaces
├── types.ts                  # Type definitions
├── helpers.ts                # Utility functions
├── hooks.ts                  # Custom hooks
├── animations.ts             # Framer Motion variants
├── contexts/
│   ├── calendar-context.tsx  # Main state management
│   └── dnd-context.tsx       # Drag & drop state
├── header/
│   ├── calendar-header.tsx   # Main header component
│   ├── view-tabs.tsx         # View switcher
│   └── filter.tsx            # Color filter dropdown
├── views/
│   ├── calendar-today-view.tsx    # NEW: Today view
│   ├── calendar-day-view.tsx
│   ├── calendar-week-view.tsx
│   ├── calendar-month-view.tsx
│   ├── calendar-year-view.tsx     # Hidden from UI
│   └── agenda-events.tsx          # Hidden from UI
├── dnd/
│   ├── draggable-event.tsx
│   └── droppable-area.tsx
├── dialogs/
│   ├── add-edit-event-dialog.tsx
│   ├── event-details-dialog.tsx
│   ├── delete-event-dialog.tsx
│   └── events-list-dialog.tsx
├── settings/
│   └── settings.tsx
└── components/
    ├── event-card.tsx
    ├── event-badge.tsx
    ├── mini-calendar.tsx
    ├── time-column.tsx
    └── family-column.tsx     # NEW: For Today view
```

### State Management

**CalendarProvider** manages:
- Current view
- Selected date
- Filtered events
- User filter selection
- Color filter selection
- Settings (persisted)

**DndProvider** manages:
- Drag state
- Drop target
- Pending confirmation

### Data Dependencies

| Feature | Data Source |
|---------|-------------|
| Events | Google Calendar API |
| Tasks | Chores Module |
| Users | Auth/Family Module |
| Settings | localStorage |
| Weather | Weather API (TBD) |

### Accessibility

- Keyboard navigation for all interactive elements
- ARIA labels on buttons and controls
- Focus management in dialogs
- Screen reader announcements for state changes
- High contrast mode support
- Respect `prefers-reduced-motion`

### Internationalization

- All text strings via `next-intl`
- Date formatting via `date-fns` with locale
- Supported locales: `nl` (default), `en`
- RTL support: Not required for initial release

---

## Design References

| View | Design File | Screenshot |
|------|-------------|------------|
| Month | `calendar-month-code-1.html` | `calendar-month-design-1.png` |
| Month (alt) | `calendar-month-code-2.tsx` | `calendar-month-design-2.png` |
| Week | `calendar-week-code-1.html` | `calendar-week-design-1.png` |
| Week (alt) | `calendar-week-code-2.tsx` | `calendar-week-design-2.png` |
| Today | `calendar-today-code-1.html` | `calendar-today-design-1.png` |

---

## Implementation Notes

### Conflicts Resolved

1. **Today View**: Custom implementation required; not present in base full-calendar library
2. **Week View Layout**: Using time-grid approach (current implementation) instead of card columns (design mockups)
3. **Year/Agenda Views**: Retained in codebase but hidden from view tabs
4. **Tasks Section**: Displays data from Chores module; not managed within calendar

### Migration Path

1. Update view tabs to show only: Today, Day, Week, Month
2. Implement new Today view component (`calendar-today-view.tsx`)
3. Update header with streak badge and family member filters
4. Integrate chores data into Today view and Month sidebar
5. Apply brand styling consistently across all views
6. Add weather widget integration point

---

*Last updated: December 2024*
