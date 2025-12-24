# Timer Feature Design

> Design document created: 2025-12-24

## Overview

Add timer functionality to the Family Planner app for screen time limits, chore motivation, and activity tracking. Timers integrate with the existing reward system and support multi-device sync.

## Core Concepts

### Timer Modes

| Mode               | Description                                                | Storage                 |
| ------------------ | ---------------------------------------------------------- | ----------------------- |
| **Timer Template** | Reusable definitions (e.g., "Screen time", "Toys cleanup") | `timer_templates` table |
| **Active Timer**   | Running instance, from template OR one-off                 | `active_timers` table   |

### Categories

Three categories with default behaviors (all overridable per timer):

| Category     | Default Control | Default Alerts   | Default Reward      |
| ------------ | --------------- | ---------------- | ------------------- |
| **Screen**   | Parents only    | Escalating       | Yes (on compliance) |
| **Chore**    | Anyone          | Completion sound | Yes (on completion) |
| **Activity** | Anyone          | None             | No                  |

### Timer Lifecycle

```
Template → Start (assign member) → Running → Paused? → Completed/Expired
                                                           ↓
                                              Confirm (within cooldown) → Stars awarded
```

## Data Model

### `timer_templates` Table

```sql
id: text primary key
family_id: text references families(id)
title: text not null
description: text
category: text not null  -- "screen" | "chore" | "activity"
duration_seconds: integer not null
star_reward: integer default 0  -- 0 = no reward
control_mode: text default "anyone"  -- "parents_only" | "anyone"
alert_mode: text default "completion"  -- "none" | "completion" | "escalating"
cooldown_seconds: integer  -- time to confirm for reward, null = no cooldown
show_as_quick_action: boolean default false  -- display on dashboard
is_active: boolean default true  -- soft delete / disable
created_at: timestamp
updated_at: timestamp
```

### `active_timers` Table

```sql
id: text primary key
family_id: text references families(id)
template_id: text references timer_templates(id)  -- null = one-off timer
title: text not null
description: text
assigned_to_id: text references family_members(id)
category: text not null
duration_seconds: integer not null
star_reward: integer default 0
alert_mode: text not null
cooldown_seconds: integer

status: text not null  -- "running" | "paused" | "completed" | "expired" | "cancelled"
remaining_seconds: integer not null
started_at: timestamp not null
paused_at: timestamp
completed_at: timestamp
started_by_id: text references family_members(id)
confirmed_by_id: text references family_members(id)
owner_device_id: text  -- device that controls this timer
last_sync_at: timestamp  -- for orphan detection

created_at: timestamp
updated_at: timestamp
```

### Key Design Decisions

- Active timer copies settings from template (template changes don't affect running timers)
- `remaining_seconds` updated on pause, countdown resumes from there
- `owner_device_id` tracks which device controls the timer
- `last_sync_at` enables orphan detection (no sync for 60+ seconds)

## Sync & Device Ownership

### Ownership Model

The device that starts a timer becomes the **owner**. Only the owner device runs the live countdown. Other devices poll for status.

| Device      | Behavior                                                                       |
| ----------- | ------------------------------------------------------------------------------ |
| **Owner**   | Runs countdown locally, syncs state to server every 60 seconds                 |
| **Viewers** | Fetch timer state periodically (every 60 seconds), display `remaining_seconds` |

### State Sync Flow

```
Owner device                          Server                         Viewer devices
    │                                    │                                  │
    ├── Start timer ──────────────────►  │ (insert active_timer)            │
    │                                    │ ◄────────────── Poll (60s) ──────┤
    │   [ticks locally]                  │                                  │
    ├── Sync remaining (60s) ─────────►  │                                  │
    │                                    │ ◄────────────── Poll (60s) ──────┤
    │                                    │                                  │
    ├── Timer complete ───────────────►  │ (status = "completed")           │
    │                                    │ ◄────────────── Poll (60s) ──────┤
```

### Cross-Device Actions

- **Extend**: Any authorized user can extend (+15 min) → updates server → owner picks up new `remaining_seconds`
- **Pause/Resume**: Owner device only
- **Confirm**: Anyone authorized can confirm completion

### Orphan Recovery

- Server tracks `last_sync_at` timestamp
- If no sync for 60+ seconds, timer becomes "orphaned"
- Next device to interact can claim ownership

## Alerts & Rewards

### Alert Modes

| Mode           | Behavior                                                       |
| -------------- | -------------------------------------------------------------- |
| **None**       | Timer shows 00:00, turns red. No sound.                        |
| **Completion** | Single alert sound when timer completes                        |
| **Escalating** | Gentle ping at 00:00 → louder at +1 min → persistent at +2 min |

### Alert Implementation

- Client-side audio (browser Audio API)
- Visual: timer card turns red, optional pulse animation
- No push notifications in v1 - requires user to have app open

### Reward Flow

```
Timer expires (00:00)
    │
    ├── cooldown_seconds > 0?
    │       │
    │       ├── YES: Start cooldown window
    │       │         │
    │       │         ├── Confirmed within cooldown → Award stars (via star service)
    │       │         │
    │       │         └── Cooldown expires → No stars (timer marked "expired")
    │       │
    │       └── NO: Just mark "completed", no reward logic
```

### Star Integration

- Use existing star service for awarding stars (not direct table insert)
- Transaction reference: `source_type = "timer"`, `source_id = active_timer.id`
- Amount: `star_reward` from the timer

## API & Services

### Timer Service

Location: `src/server/services/timer-service.ts`

```typescript
// Template management
createTemplate(familyId, data) → template
updateTemplate(templateId, data) → template
deleteTemplate(templateId) → void
getTemplates(familyId) → template[]

// Active timer operations
startTimer(templateId | oneOffData, assignedToId, deviceId) → activeTimer
pauseTimer(timerId, deviceId) → activeTimer
resumeTimer(timerId, deviceId) → activeTimer
extendTimer(timerId, seconds) → activeTimer
cancelTimer(timerId) → void
confirmTimer(timerId, confirmedById) → { timer, starsAwarded? }

// Sync
syncTimerState(timerId, remainingSeconds, deviceId) → void
getActiveTimers(familyId) → activeTimer[]
claimOrphanedTimer(timerId, deviceId) → activeTimer

// History (optional v1)
getTimerHistory(familyId, filters?) → completedTimer[]
```

### API Routes

Location: `src/app/api/v1/timers/`

| Method | Route                  | Action                   |
| ------ | ---------------------- | ------------------------ |
| GET    | `/templates`           | List family templates    |
| POST   | `/templates`           | Create template          |
| PATCH  | `/templates/[id]`      | Update template          |
| DELETE | `/templates/[id]`      | Delete template          |
| GET    | `/active`              | List active timers       |
| POST   | `/active`              | Start timer              |
| PATCH  | `/active/[id]`         | Pause/resume/extend/sync |
| POST   | `/active/[id]/confirm` | Confirm completion       |
| DELETE | `/active/[id]`         | Cancel timer             |

## UI Integration

### Existing Components to Update

| Component               | Changes                                                    |
| ----------------------- | ---------------------------------------------------------- |
| `active-timers.tsx`     | Replace mock data with real API, add real countdown        |
| `timer-card.tsx`        | Add pause button logic, confirm button when expired        |
| `quick-actions.tsx`     | Connect to timer templates, show assignment modal on click |
| `dashboard-context.tsx` | Replace mock state with API calls, add sync polling        |

### New Components

| Component                    | Purpose                                           |
| ---------------------------- | ------------------------------------------------- |
| `timer-assignment-modal.tsx` | Pick family member when starting template timer   |
| `timer-create-modal.tsx`     | Create one-off timer (duration, title, assign)    |
| `timer-confirm-dialog.tsx`   | "Time's up! Did [name] stop?" with confirm button |

### Countdown Logic (Owner Device)

```typescript
useEffect(() => {
  if (!isOwner || status !== "running") return;

  const interval = setInterval(() => {
    setRemaining((r) => {
      if (r <= 1) {
        onTimerComplete();
        return 0;
      }
      return r - 1;
    });
  }, 1000);

  return () => clearInterval(interval);
}, [isOwner, status]);
```

### Sync Hook (All Devices)

```typescript
// Poll every 60s for active timers
useQuery(["activeTimers", familyId], fetchActiveTimers, {
  refetchInterval: 60_000,
});
```

### Smart Assignment Defaults

When starting a reusable timer, show last-used family member first but allow changing. Track recent assignments per template.

## Timer Management Page

### Route

`/[locale]/timers` - Standalone page for managing timer templates.

### Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  Timers                                    [+ New Timer] │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐│
│  │ 📺 Screen time          30 min    ⭐ 5    [Edit][🗑] ││
│  │    Escalating alerts • Parents only       ⚡ Quick   ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │ 🧹 Toys cleanup         15 min    ⭐ 10   [Edit][🗑] ││
│  │    Completion alert • Anyone              ⚡ Quick   ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │ 📚 Homework             45 min    —      [Edit][🗑] ││
│  │    No alerts • Anyone                               ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Components

| Component                 | Purpose                               |
| ------------------------- | ------------------------------------- |
| `timers-page.tsx`         | Main page with template list          |
| `timer-template-card.tsx` | Display card with edit/delete actions |
| `timer-template-form.tsx` | Create/edit form (modal or inline)    |

### Form Fields

- Title (required)
- Description (optional)
- Category (screen/chore/activity) - affects defaults
- Duration (minutes/seconds picker)
- Star reward (0 = none)
- Control mode (parents only / anyone)
- Alert mode (none / completion / escalating)
- Cooldown for confirmation (optional, seconds)
- **Show as quick action** (toggle) - displays on dashboard

### Quick Action Integration

Templates marked with `show_as_quick_action = true`:

- Appear in dashboard quick actions widget
- Clicking opens assignment modal → starts timer
- Coexist with existing non-timer quick actions

## Out of Scope (v1)

- Push notifications
- Recurring/scheduled timers
- Timer history analytics
- Audio customization
- Wall hub presence detection (use "device that started" ownership for now)
