# Timers UI Specification

## Interaction Modes

| Mode             | Device         | User           | Purpose                             |
| ---------------- | -------------- | -------------- | ----------------------------------- |
| **Wall Display** | Mounted tablet | Kids/Family    | View countdown, start quick actions |
| **Management**   | Mobile/Desktop | Parents/Admins | Create templates, full control      |

### Wall Display Mode

**Allowed Actions:**

- View active timer countdown
- Start timer from templates (if `controlMode: anyone`)
- View quick action templates on dashboard
- Pause/resume own timers (if `controlMode: anyone`)
- Confirm timer completion

**Hidden/Disabled:**

- FAB (Add Template button)
- Edit/delete template actions
- Template configuration forms
- Timers with `controlMode: parents_only` (view only)

**Touch Targets:** 48px minimum

### Management Mode

**Full Access:**

- All viewing capabilities
- Create/edit/delete timer templates
- Start any timer
- Pause/resume/extend any timer
- Configure control modes and rewards
- Manage quick action visibility

---

## Layout Structure

### Timers Page (Desktop/Tablet)

```
+-------------------------------------------------------------------+
| Header: Timers                                                     |
+-------------------------------------------------------------------+
| Template Grid                                                       |
| +----------------+ +----------------+ +----------------+           |
| | [emoji] Title  | | [emoji] Title  | | [emoji] Title  |           |
| | 15 min  [star] | | 30 min  [star] | | 1u             |           |
| | [badges]  [>]  | | [badges]  [>]  | | [badges]  [>]  |           |
| +----------------+ +----------------+ +----------------+           |
| +----------------+ +----------------+                              |
| | [emoji] Title  | | [emoji] Title  |                              |
| | 45 min  [star] | | 20 min  [star] |                              |
| | [badges]  [>]  | | [badges]  [>]  |                              |
| +----------------+ +----------------+                              |
+-------------------------------------------------------------------+
| FAB [+] (Management mode only)                                     |
+-------------------------------------------------------------------+
```

### Mobile (< md)

Single column layout with vertically stacked template cards.

### Active Timer Overlay (when timer running)

```
+-------------------------------------------------------------------+
| [Full screen overlay or prominent banner]                          |
|                                                                     |
|        [emoji]  Timer Title                                        |
|                                                                     |
|              12:45                                                  |
|        (large countdown display)                                   |
|                                                                     |
|  [Pause]     [Extend +5m]     [Cancel]                            |
|                                                                     |
|  Assigned to: [Avatar] Name                                        |
|  Stars: 10                                                          |
+-------------------------------------------------------------------+
```

---

## Components

### Timer Template Card

Displays a reusable timer definition with quick start capability.

| Element        | Specification                              |
| -------------- | ------------------------------------------ |
| Container      | Card component, rounded corners            |
| Category emoji | Based on category type                     |
| Title          | lg font-medium, truncate single line       |
| Duration       | sm, muted foreground                       |
| Star badge     | Star icon + count (if starReward > 0)      |
| Control badge  | "parents only" or "anyone"                 |
| Alert badge    | Alert mode indicator                       |
| Quick badge    | Lightning icon if showAsQuickAction        |
| Edit button    | Ghost variant, Edit2 icon (managers only)  |
| Delete button  | Ghost variant, Trash2 icon (managers only) |
| Start button   | Primary variant, Play icon                 |

#### Category Emojis

| Category   | Emoji | Description                 |
| ---------- | ----- | --------------------------- |
| `screen`   | TV    | Screen time limits          |
| `chore`    | Broom | Timed household tasks       |
| `activity` | Book  | Homework, reading, practice |

```typescript
const categoryEmoji: Record<string, string> = {
  screen: "TV",
  chore: "Broom",
  activity: "Book",
};
```

### Timer Template Form

Form for creating and editing timer templates.

| Field                | Input Type      | Validation                 |
| -------------------- | --------------- | -------------------------- |
| Title                | Text input      | Required, 1-100 chars      |
| Category             | Select dropdown | screen/chore/activity      |
| Duration (minutes)   | Number input    | 1-1440 (converted to sec)  |
| Star Reward          | Number input    | 0-1000                     |
| Alert Mode           | Select dropdown | none/completion/escalating |
| Control Mode         | Select dropdown | anyone/parents_only        |
| Cooldown (minutes)   | Number input    | 0-60 (optional)            |
| Show as Quick Action | Switch toggle   | Boolean                    |

#### Form Defaults

```typescript
const defaultValues = {
  title: "",
  category: "chore",
  durationSeconds: 900, // 15 min
  starReward: 0,
  controlMode: "anyone",
  alertMode: "completion",
  showAsQuickAction: false,
};
```

### Active Timer Display

Large countdown display for running timers.

| Element         | Specification                   |
| --------------- | ------------------------------- |
| Countdown       | 4xl-6xl font, monospace         |
| Title           | 2xl font-bold                   |
| Category badge  | Pill with emoji + category name |
| Assigned member | Avatar + display name           |
| Star reward     | Star icon + count               |
| Progress bar    | Visual remaining time indicator |
| Pause button    | Primary, shows when running     |
| Resume button   | Primary, shows when paused      |
| Extend button   | Secondary, "+5 min" increment   |
| Cancel button   | Destructive variant             |

### Confirmation Modal

Shown when timer with cooldown reaches zero.

| Element        | Specification                         |
| -------------- | ------------------------------------- |
| Title          | "Timer Complete!"                     |
| Message        | "Confirm to earn {X} stars"           |
| Countdown      | Cooldown timer showing remaining time |
| Confirm button | Primary, "Confirm Completion"         |
| Dismiss button | Secondary, "Dismiss (No Stars)"       |

---

## Timer States

### Template Card States

| State    | Visual                                      |
| -------- | ------------------------------------------- |
| Default  | Full opacity                                |
| Hover    | Subtle background highlight                 |
| Disabled | 60% opacity (parents_only for non-managers) |

### Active Timer States

| Status      | Visual                                  | Actions Available      |
| ----------- | --------------------------------------- | ---------------------- |
| `running`   | Green accent, animated countdown        | Pause, Extend, Cancel  |
| `paused`    | Yellow/amber accent, "PAUSED" indicator | Resume, Extend, Cancel |
| `expired`   | Orange accent, "CONFIRM" prompt         | Confirm, Dismiss       |
| `completed` | Green checkmark, stars animation        | None (auto-dismiss)    |
| `cancelled` | Red/gray, "CANCELLED" indicator         | None (auto-dismiss)    |

---

## Animations

| Action              | Animation                                     | Duration | Easing   |
| ------------------- | --------------------------------------------- | -------- | -------- |
| Template card hover | Background color transition                   | 200ms    | ease     |
| Start timer         | Card scale(0.95) -> button scale(1.1)         | 150ms    | spring   |
| Countdown tick      | Number slide/fade transition                  | 200ms    | ease-out |
| Timer complete      | Scale(1) -> scale(1.2) -> scale(1) + confetti | 500ms    | spring   |
| Pause/Resume        | Button icon morph transition                  | 200ms    | ease     |
| Star award          | Stars fly to balance + celebration            | 800ms    | spring   |

---

## Dashboard Quick Actions

Timer templates marked with `showAsQuickAction: true` appear on the dashboard.

### Quick Action Button

| Element      | Specification                       |
| ------------ | ----------------------------------- |
| Container    | Compact card, horizontal layout     |
| Icon         | Category emoji or custom icon       |
| Title        | sm font-medium                      |
| Duration     | xs muted, e.g., "15m"               |
| Start button | Small primary button with Play icon |

### Layout

```
Dashboard Quick Actions Section
+--------------------------------------------------+
| Quick Timers                                      |
| +------------+ +------------+ +------------+     |
| | TV 30m [>] | | HW 45m [>] | | Chore 15m [>]|     |
| +------------+ +------------+ +------------+     |
+--------------------------------------------------+
```

---

## Dialogs

### Create/Edit Template Dialog

```
+-----------------------------------------------+
| Timer template maken / Timer template bewerken |
+-----------------------------------------------+
| Titel                                          |
| [________________________]                     |
|                                                |
| Categorie                                      |
| [v Screen / Taak / Activiteit ]               |
|                                                |
| Duur (minuten)    Sterren                     |
| [___15___]        [___0___]                   |
|                                                |
| Alarm modus                                    |
| [v Geen / Bij voltooiing / Escalerend ]       |
|                                                |
| [ ] Tonen als snelle actie op dashboard       |
|                                                |
| [        Aanmaken / Bijwerken        ]        |
+-----------------------------------------------+
```

### Confirm Timer Completion Dialog

```
+-----------------------------------------------+
| Timer Voltooid!                                |
+-----------------------------------------------+
|                                                |
|              [Check icon]                      |
|                                                |
|     "{Timer Title}" is klaar!                 |
|                                                |
|     Bevestig om {X} sterren te verdienen      |
|                                                |
|     Tijd om te bevestigen: 2:45               |
|                                                |
| [    Bevestigen    ]  [  Afwijzen  ]          |
+-----------------------------------------------+
```

---

## Accessibility

### WCAG 2.1 AA Compliance

| Requirement         | Implementation                                   |
| ------------------- | ------------------------------------------------ |
| Color contrast      | Countdown text meets 4.5:1 ratio                 |
| Focus indicators    | 2px primary outline with 2px offset              |
| Touch targets       | 48x48px minimum for all interactive elements     |
| Screen readers      | Full context announcements                       |
| Keyboard navigation | Tab through cards and buttons, Enter to activate |

### Screen Reader Announcements

| Element          | Announcement                                             |
| ---------------- | -------------------------------------------------------- |
| Template card    | "{title}, {category}, {duration}, {stars} stars, button" |
| Active timer     | "Timer: {title}, {remaining} remaining"                  |
| Countdown update | Every minute: "{minutes} minutes remaining"              |
| Timer complete   | "Timer complete! {title} finished. {stars} stars earned" |
| Pause action     | "Timer paused"                                           |
| Resume action    | "Timer resumed"                                          |

### Keyboard Navigation

| Key         | Action                                 |
| ----------- | -------------------------------------- |
| Tab         | Move between cards and buttons         |
| Enter/Space | Start timer, confirm action            |
| Escape      | Close dialogs, cancel active operation |

### Motion Sensitivity

```typescript
// Respect reduced motion preference
const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

// Skip animations if user prefers reduced motion
const countdownTransition = prefersReducedMotion
  ? { duration: 0 }
  : { duration: 200, ease: "easeOut" };
```

---

## Component Structure

```
src/components/timers/
+-- timers-page.tsx              # Main page component
+-- timer-template-card.tsx      # Template display card
+-- timer-template-form.tsx      # Create/edit form
+-- active-timer-display.tsx     # Running timer UI (TBD)
+-- timer-confirmation-modal.tsx # Cooldown confirmation (TBD)
+-- quick-action-timer.tsx       # Dashboard quick action (TBD)

src/hooks/
+-- use-timers.ts                # React Query hooks for templates and active timers
+-- use-timer-countdown.ts       # Countdown logic with device ownership
```

### State Management

```typescript
// Timer hooks
export function useTimerTemplates() {
  return useQuery({
    queryKey: ["timers", "templates"],
    queryFn: () => apiFetch("/api/v1/timers/templates"),
  });
}

export function useActiveTimers() {
  return useQuery({
    queryKey: ["timers", "active"],
    queryFn: () => apiFetch("/api/v1/timers/active"),
    staleTime: Infinity, // Real-time updates via Pusher
  });
}

export function useStartTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params) =>
      apiFetch("/api/v1/timers/active", {
        method: "POST",
        body: JSON.stringify(params),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timers", "active"] });
    },
  });
}
```

### Countdown Hook

```typescript
interface UseTimerCountdownOptions {
  initialSeconds: number;
  isOwner: boolean; // Only owner device runs countdown
  isRunning: boolean; // Pause state
  timerId: string;
  onComplete?: () => void; // Called when timer reaches zero
  onSync?: (remaining: number) => void; // Called every 60s to sync
}

export function useTimerCountdown(options: UseTimerCountdownOptions) {
  // Returns { remaining, reset }
  // Owner device decrements locally
  // Syncs to server every 60 seconds
}
```

### Device ID Management

```typescript
// Persistent device ID for timer ownership
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem("deviceId", deviceId);
  }
  return deviceId;
}
```

---

## Performance Considerations

- Use `staleTime: Infinity` for active timers (real-time updates via Pusher)
- Memoize countdown display to prevent unnecessary re-renders
- Debounce sync calls to server (every 60 seconds minimum)
- Use optimistic updates for pause/resume actions
- Prefetch templates on dashboard load for quick actions
