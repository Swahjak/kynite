# Calendar UI Specification

## Interaction Modes

The calendar UI supports two interaction contexts:

| Mode             | Device         | User           | Purpose                    |
| ---------------- | -------------- | -------------- | -------------------------- |
| **Wall Display** | Mounted tablet | Kids/Family    | View schedules, see timers |
| **Management**   | Mobile/Desktop | Parents/Admins | CRUD operations, settings  |

### Wall Display Mode

**Allowed Actions:**

- View all calendar views (Today, Day, Week, Month)
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

| View  | Icon                 | Description                                           |
| ----- | -------------------- | ----------------------------------------------------- |
| Today | `view_day`           | Family-focused daily overview with columns per member |
| Day   | `calendar_today`     | Hourly timeline for selected date                     |
| Week  | `calendar_view_week` | 7-day hourly grid                                     |
| Month | `calendar_month`     | Full month grid with day detail sidebar               |

### Today View

Family-focused dashboard showing each family member's schedule in parallel columns.

**Components:**

- User header (avatar, name, level, XP bar)
- Schedule section (event cards)
- Tasks section (from Chores module)

### Day View

24-hour timeline with optional mini calendar sidebar.

**Components:**

- Mini calendar (desktop only)
- "Happening Now" panel
- Time column (hourly labels)
- Event blocks (positioned by time)
- Current time indicator

### Week View

7-day grid with hourly time slots.

**Note:** Shows warning on mobile - "Week view is optimized for larger screens"

### Month View

Full month grid with selected day detail sidebar.

**Components:**

- Month grid with event indicators
- Day detail sidebar (desktop only)
- Achievement indicators (trophy icons)

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

---

## Responsive Behavior

| Breakpoint | Today View           | Day View            | Week View     | Month View     |
| ---------- | -------------------- | ------------------- | ------------- | -------------- |
| < md       | Single column, swipe | Full-width timeline | Warning shown | Grid only      |
| md - lg    | 2 columns            | Show sidebar        | Full grid     | Grid only      |
| > lg       | 3-4 columns          | Show sidebar        | Full grid     | Grid + sidebar |
| > 2xl      | All columns          | Show sidebar        | Full grid     | Grid + sidebar |

---

## Accessibility

- Keyboard navigation for all interactive elements
- ARIA labels on buttons and controls
- Focus management in dialogs
- Screen reader announcements for state changes
- High contrast mode support
- Respect `prefers-reduced-motion`
