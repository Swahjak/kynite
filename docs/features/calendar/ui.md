# Calendar UI Specification

## Interaction Modes

The calendar UI supports two interaction contexts:

| Mode             | Device         | User           | Purpose                    |
| ---------------- | -------------- | -------------- | -------------------------- |
| **Wall Display** | Mounted tablet | Kids/Family    | View schedules, see timers |
| **Management**   | Mobile/Desktop | Parents/Admins | CRUD operations, settings  |

### Wall Display Mode

**Allowed Actions:**

- View all calendar views (Day, Week, Month, Year, Agenda)
- Navigate between dates
- Filter by family member
- Filter by event color
- View event details (read-only)

**Hidden/Disabled:**

- "Add Event" button
- Event edit/delete actions
- Drag-and-drop rescheduling
- Settings panel
- DnD confirmation dialogs

**Touch Targets:** 48px minimum

### Management Mode

**Full Access:**

- All viewing capabilities
- Create, edit, delete events
- Drag-and-drop event rescheduling
- Settings configuration
- User preferences

---

## Views

### Available Views

| View   | Description                                          |
| ------ | ---------------------------------------------------- |
| Day    | 24-hour timeline for selected date with hourly slots |
| Week   | 7-day hourly grid (shared component with Day view)   |
| Month  | Full month grid with event dots/badges               |
| Year   | 12-month overview calendar                           |
| Agenda | List view of events, groupable by date or color      |

View type: `TCalendarView = "day" | "week" | "month" | "year" | "agenda"`

### Day View

24-hour timeline with optional mini calendar sidebar.

**Components:**

- Mini calendar (desktop only)
- Time column (hourly labels)
- Event blocks (positioned by time)
- Current time indicator
- Drag-and-drop support
- Event resizing support

### Week View

7-day grid with hourly time slots. Shares components with Day view (`week-and-day-view/`).

**Components:**

- Day headers with date
- Hourly time grid
- Event blocks spanning across hours
- Current time indicator
- Drag-and-drop support
- Event resizing support

**Note:** Shows warning on mobile - "Week view is optimized for larger screens"

### Month View

Full month grid with event indicators and selectable dates.

**Components:**

- Month grid with event dots or colored badges (configurable via `badgeVariant`)
- Date cells with event count
- Selected date highlighting

### Year View

12-month mini calendar grid for year-at-a-glance overview.

**Components:**

- 12 mini month grids
- Clickable months to navigate to Month view
- Visual indicators for event density

### Agenda View

Scrollable list of events with grouping options.

**Components:**

- Event list cards
- Group headers (by date or by color)
- Configurable grouping via `agendaModeGroupBy` setting

---

## Components

### Event Card

| Element     | Specification                   |
| ----------- | ------------------------------- |
| Left border | 4px solid event color           |
| Background  | Event color at 10% opacity      |
| Title       | Bold, 14px                      |
| Time        | Category color                  |
| Location    | Optional, 12px, secondary color |

### Hidden Event Indicator

Events from private calendars (where viewer is not owner) display:

| Element     | Specification                          |
| ----------- | -------------------------------------- |
| Title       | Shows "Hidden" instead of actual title |
| Description | Hidden (null)                          |
| Location    | Hidden (null)                          |
| isHidden    | Flag set to true                       |

### Read-Only Event Indicator

Events from read-only Google Calendars display:

| Element        | Specification                             |
| -------------- | ----------------------------------------- |
| Lock icon      | Top-right corner of event card            |
| Tooltip        | "This event is from a read-only calendar" |
| Edit actions   | Disabled in Management mode               |
| Delete actions | Disabled in Management mode               |
| Drag-and-drop  | Disabled                                  |

### Filter Tabs

Horizontal pill buttons for view switching.

**States:**

- Active: Dark background, white text, bold
- Inactive: White background, border, secondary text

### Family Member Filter

Horizontal pills with avatars for filtering events by person.

### Drag-and-Drop Components

Located in `src/components/calendar/dnd/`:

| Component      | Description                                              |
| -------------- | -------------------------------------------------------- |
| DraggableEvent | Wrapper for events that can be dragged to reschedule     |
| DroppableArea  | Target areas where events can be dropped (time slots)    |
| ResizableEvent | Wrapper for events that can be resized (change duration) |

### DnD Confirmation Dialog

Optional confirmation dialog shown when rescheduling events via drag-and-drop.

| Element      | Specification                               |
| ------------ | ------------------------------------------- |
| Dialog title | "Reschedule Event"                          |
| Content      | Shows original and new date/time            |
| Actions      | Cancel, Confirm                             |
| Toggle       | Can be disabled via `showConfirmation` prop |

---

## Responsive Behavior

| Breakpoint | Day View            | Week View     | Month View | Year View | Agenda View |
| ---------- | ------------------- | ------------- | ---------- | --------- | ----------- |
| < md       | Full-width timeline | Warning shown | Grid only  | Grid only | Full list   |
| md - lg    | Show sidebar        | Full grid     | Grid only  | Grid only | Full list   |
| > lg       | Show sidebar        | Full grid     | Full grid  | Full grid | Full list   |
| > 2xl      | Show sidebar        | Full grid     | Full grid  | Full grid | Full list   |

---

## Accessibility

- Keyboard navigation for all interactive elements
- ARIA labels on buttons and controls
- Focus management in dialogs
- Screen reader announcements for state changes
- High contrast mode support
- Respect `prefers-reduced-motion`
