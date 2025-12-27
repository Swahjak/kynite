# Timers Feature Specification

## Overview

The Timers feature enables families to set and track timed activities for children. Whether limiting screen time, ensuring chores get completed within a timeframe, or timing homework sessions, timers provide visual countdowns with optional star rewards upon completion. Timers can be started from reusable templates or created as one-off instances.

## Documents

| Document                      | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| [Data Model](./data-model.md) | Timer templates, active timers, database schema, API |
| [UI Specification](./ui.md)   | Components, countdown display, interaction patterns  |

## Design Reference

Visual mockups available in `docs/design/timers/`:

- `timers-design-*.png` - Timer interface mockups

> **Note:** Mockups are reference only. Implement using project brand guidelines.

## Key Constraints

- **Template-based**: Reusable timer definitions reduce repetitive setup
- **Device ownership**: One device "owns" each running timer for countdown accuracy
- **Real-time sync**: Pusher broadcasts timer events to all family devices
- **Confirmation window**: Optional cooldown period for verifying timer completion before awarding stars

## Key Features

### Timer Templates

Reusable timer definitions that can be started with one tap:

- **Categories**: Screen time, chore tasks, activities
- **Duration**: 30 seconds to 24 hours
- **Star rewards**: Optional stars earned on completion (0-1000)
- **Control modes**: Anyone can control, or parents only
- **Alert modes**: None, on completion, or escalating alerts
- **Cooldown period**: Optional confirmation window (0-60 minutes)
- **Quick actions**: Pin templates to dashboard for fast access

### Active Timers

Running timer instances with real-time countdown:

- **States**: Running, paused, completed, expired, cancelled
- **Pause/resume**: Owner device can pause and resume
- **Extend**: Add time to running or paused timers (1-60 minutes)
- **Device sync**: Background sync every 60 seconds
- **Orphan recovery**: Timers reclaimed if owner device disconnects for 60+ seconds

### Completion Flow

1. Timer reaches zero
2. If cooldown configured: Timer enters "expired" state, waiting for confirmation
3. Family member confirms within cooldown window
4. Stars awarded to assigned family member
5. Star transaction recorded for Reward Store integration

### Alert Modes

| Mode         | Behavior                                               |
| ------------ | ------------------------------------------------------ |
| `none`       | Silent completion                                      |
| `completion` | Single alert when timer finishes                       |
| `escalating` | Increasingly urgent alerts as timer nears/reaches zero |

### Control Modes

| Mode           | Behavior                                             |
| -------------- | ---------------------------------------------------- |
| `anyone`       | Any family member can start, pause, extend           |
| `parents_only` | Only managers can control timer (view-only for kids) |

## User Personas

| Persona    | Access                    | Actions                                       |
| ---------- | ------------------------- | --------------------------------------------- |
| **Child**  | Start timers (if allowed) | View countdown, receive rewards               |
| **Parent** | Full control              | Create templates, start/pause/extend, confirm |

## Relationship to Other Features

| Feature          | Relationship                                          |
| ---------------- | ----------------------------------------------------- |
| **Dashboard**    | Quick action templates shown on dashboard             |
| **Reward Store** | Stars earned from timers can be spent in Reward Store |
| **Chores**       | Timer category "chore" for timed task completion      |
| **Families**     | Timers scoped to family, assigned to family members   |

## Real-Time Architecture

Timer state is synchronized across all family devices using Pusher:

| Event             | Payload                   | Purpose                            |
| ----------------- | ------------------------- | ---------------------------------- |
| `timer:started`   | `{ timer }`               | New timer created                  |
| `timer:updated`   | `{ timer }`               | State change (pause, resume, sync) |
| `timer:cancelled` | `{ timerId }`             | Timer cancelled                    |
| `timer:completed` | `{ timer, starsAwarded }` | Timer finished                     |

Only the "owner device" runs the actual countdown. Other devices display synchronized state and can take over if the owner device disconnects.
