# Device/Wall-Hub UI Specification

## Interaction Modes

| Mode             | Device         | User    | Purpose                        |
| ---------------- | -------------- | ------- | ------------------------------ |
| **Wall Display** | Mounted tablet | Family  | View schedules, complete tasks |
| **Pairing**      | New device     | Manager | Enter 6-digit code to pair     |
| **Management**   | Mobile/Desktop | Manager | Add, rename, remove devices    |

### Wall Display Mode

**Allowed Actions:**

- View all events (Today, Week, Full Calendar)
- Filter by family member
- Mark chores as complete (single tap)
- Navigate between days/weeks

**Hidden/Disabled:**

- Settings and family management
- Event creation/editing
- Device management
- Calendar sync controls

**Touch Targets:** 48px minimum for all interactive elements

---

## Layout

### Wall-Hub Header

```
+----------------------------------------------------------+
| [Today] [Week] [Calendar*]                               |
+----------------------------------------------------------+
```

_\*Calendar tab hidden on mobile_

### Today View Layout

```
+----------------------------------------------------------+
| Person Filter Chips                                       |
| [Everyone] [Alice] [Bob] [Charlie]                       |
+----------------------------------------------------------+
| Mobile: Horizontal scroll with snap                       |
| Desktop: 2-4 column grid                                  |
|                                                          |
| +------------+ +------------+ +------------+             |
| | PersonCol  | | PersonCol  | | PersonCol  |             |
| |            | |            | |            |             |
| | [Header]   | | [Header]   | | [Header]   |             |
| | Events     | | Events     | | Events     |             |
| | Chores     | | Chores     | | Chores     |             |
| +------------+ +------------+ +------------+             |
+----------------------------------------------------------+
```

### Week View Layout

```
+----------------------------------------------------------+
| Person Filter Chips + Week Navigation                     |
| [Everyone] [Alice] ...     [<] Jan 15 - Jan 21 [>] [Today]|
+----------------------------------------------------------+
| Mobile: Horizontal scroll with auto-scroll to today       |
| Desktop: 7-column grid                                    |
|                                                          |
| +------+ +------+ +------+ +------+ +------+ +------+ +-+|
| | Mon  | | Tue  | | Wed  | | Thu  | | Fri  | | Sat  | |S||
| |      | |      | | NOW  | |      | |      | |      | | ||
| +------+ +------+ +------+ +------+ +------+ +------+ +-+|
+----------------------------------------------------------+
```

---

## Components

### WallHubHeader

Navigation tabs for view switching.

| Element    | Specification                                  |
| ---------- | ---------------------------------------------- |
| Tab pills  | Inline-flex, rounded-lg container              |
| Active tab | `bg-primary text-primary-foreground shadow-sm` |
| Inactive   | `text-muted-foreground hover:bg-background`    |
| Icons      | 16px (CalendarDays, CalendarRange, Calendar)   |
| Calendar   | Hidden on mobile (`hidden md:inline-flex`)     |

### PersonFilterChips

Horizontal scrollable chip bar for filtering by family member.

| Element       | Specification                                   |
| ------------- | ----------------------------------------------- |
| Container     | `flex gap-2 overflow-x-auto pb-1`               |
| Everyone chip | Users icon + "Everyone" label                   |
| Person chip   | Avatar (28px) + name, user's avatarColor border |
| Selected      | Filled background with user color               |
| Height        | 40px (`h-10`)                                   |

### PersonHeader

Person identification header for Today view columns.

| Element   | Specification                        |
| --------- | ------------------------------------ |
| Container | `bg-card border rounded-xl p-3`      |
| Avatar    | Size md (via FamilyAvatar component) |
| Name      | `text-lg font-semibold`              |
| Layout    | Flex row, items center, gap-3        |

### PersonColumn (Today View)

Person-specific column showing today's events and chores.

| Element     | Specification                                 |
| ----------- | --------------------------------------------- |
| Header      | PersonHeader component                        |
| Content     | `bg-muted/30 rounded-xl p-3`                  |
| Events      | ScheduleCard components, sorted by start time |
| Chores      | TaskCheckbox components, `mt-auto`            |
| Empty state | "No events" centered, muted text              |

### DayHeader (Week View)

Day identification header for Week view columns.

| Element     | Specification                                     |
| ----------- | ------------------------------------------------- |
| Container   | `rounded-xl border p-3 text-center`               |
| Today style | `border-primary bg-primary/10 border-2`           |
| Weekday     | `text-sm font-medium uppercase tracking-wide`     |
| Day number  | `text-2xl font-bold`                              |
| Today badge | `bg-primary text-primary-foreground rounded-full` |

### DayColumn (Week View)

Day-specific column showing that day's events and chores.

| Element      | Specification                                    |
| ------------ | ------------------------------------------------ |
| Header       | DayHeader component                              |
| Content      | `bg-muted/30 rounded-xl p-3` (or `bg-primary/5`) |
| Today column | Highlighted with primary color tint              |
| Past days    | `opacity-60`                                     |
| Events       | ScheduleCard components                          |
| Chores       | TaskCheckbox components for chores due that day  |

### ScheduleCard

Event display card with time, title, and participant avatars.

| Element      | Specification                                 |
| ------------ | --------------------------------------------- |
| Container    | `rounded-lg border-l-4 p-3 shadow-sm`         |
| Border color | First participant's avatarColor               |
| Background   | Subtle tint of participant's avatarColor      |
| Time display | `text-xs text-muted-foreground`               |
| Avatars      | Stacked FamilyAvatar (16px), max overlap      |
| NOW badge    | `bg-red-500 text-white rounded px-1.5 py-0.5` |
| Title        | `text-sm font-semibold`                       |

### TaskCheckbox

Chore completion control with confetti celebration.

| Element   | Specification                                          |
| --------- | ------------------------------------------------------ |
| Container | `flex items-center gap-3 rounded-lg border-dashed p-3` |
| Checkbox  | 20px, shadcn/ui Checkbox                               |
| Title     | `text-sm font-medium`                                  |
| Completed | `line-through text-muted-foreground`                   |
| Action    | Triggers confetti on completion                        |

---

## View Behaviors

### Today View

- Filters events for today only
- Shows events sorted by start time (earliest first)
- Displays chores assigned to each person
- Mobile: Horizontal scroll with CSS snap (`snap-x snap-mandatory`)
- Desktop: 2-4 column responsive grid

### Week View

- Shows 7 days starting Monday
- Week navigation with previous/next/today buttons
- Auto-scrolls to today on mobile when week changes
- Filters by selected person across all days
- Past days shown with reduced opacity

### Full Calendar

- Uses main Calendar component (accessible via WallHubHeader)
- Hidden on mobile devices
- Full calendar functionality for detailed viewing

---

## Pairing UI

### DevicePairForm

6-digit code entry form for device pairing.

| Element       | Specification                                 |
| ------------- | --------------------------------------------- |
| Container     | Card with max-width 400px, centered           |
| Icon          | Tablet icon in `bg-primary/10` circle         |
| Title         | CardTitle with localized "Pair Device"        |
| Description   | CardDescription with pairing instructions     |
| Code input    | Centered, `text-2xl tracking-widest`, 6 chars |
| Input mode    | `inputMode="numeric"` for mobile keyboard     |
| Submit button | Full width, disabled until 6 digits           |
| Loading state | Spinner + "Pairing..." text                   |
| Success state | Checkmark + success message + redirect timer  |

### DeviceDisconnected

Shown when device session expires or is revoked.

| Element     | Specification                                    |
| ----------- | ------------------------------------------------ |
| Container   | Full-screen centered Card                        |
| Icon        | WifiOff in `bg-destructive/10` circle            |
| Title       | "Device Disconnected"                            |
| Description | Instructions to re-pair                          |
| Action      | "Pair Again" button, navigates to `/device/pair` |

---

## Responsive Design

### Mobile (< md)

- Single column with horizontal scroll
- CSS snap for swipe navigation (`snap-center`)
- Column width: 288px (`w-72`)
- Auto-scroll to today in Week view
- Calendar tab hidden in header

### Tablet/Desktop (md+)

- Multi-column grid layout
- Today: 2 cols (md) / 3 cols (lg) / 4 cols (xl)
- Week: 7 column grid, min-width 800px
- Full calendar accessible via header tab

---

## Animations

| Action           | Animation                              |
| ---------------- | -------------------------------------- |
| Chore complete   | Confetti burst (via useConfetti hook)  |
| Card transitions | Standard CSS transitions               |
| View switching   | Instant (no page transition)           |
| Mobile scroll    | CSS scroll-snap for momentum scrolling |

---

## Accessibility

- ARIA labels on scroll regions ("Today view - swipe to navigate")
- Button focus states with visible outline
- Touch targets minimum 48px
- Screen reader friendly: Avatar names, event times
- Semantic HTML structure (nav, headings, buttons)
- Respect `prefers-reduced-motion` (via confetti component)
