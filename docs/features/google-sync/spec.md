# Google Sync Feature Specification

## Overview

The Google Sync feature enables 2-way synchronization between Family Planner and Google Calendar. It supports multiple Google accounts per family, allowing aggregation of personal, work, and shared calendars into a unified view.

## Documents

| Document                      | Description                             |
| ----------------------------- | --------------------------------------- |
| [Data Model](./data-model.md) | Database schema, sync metadata          |
| [UI Specification](./ui.md)   | Account linking, calendar selection     |
| [API Reference](./api.md)     | Google Calendar API integration details |

## PRD Mapping

| PRD Requirement                          | Implementation                                |
| ---------------------------------------- | --------------------------------------------- |
| FR1 - Multi-calendar, multi-account sync | `google_calendars` table with `account_id` FK |
| FR2 - Aggregate disparate sources        | Family-level calendar aggregation             |
| FR19 - Secure account linking            | Better-Auth Google OAuth with token refresh   |

## Key Features

### Multi-Account Support

Family managers can link multiple Google accounts:

- Personal accounts (sarah@gmail.com)
- Work accounts (sarah@company.com)
- Shared family accounts (family@gmail.com)

### Calendar Selection

Each Google account may have multiple calendars:

- Primary calendar
- Shared calendars
- Subscribed calendars (holidays, sports)

Users select which calendars to sync per account.

### Calendar Privacy

Each calendar can be marked as private:

- `isPrivate: true` - Event details hidden in family calendar view
- Private events show as "Busy" blocks
- Full details visible only to calendar owner
- Privacy setting stored per-calendar in `google_calendars.is_private`

### Sync Strategy

| Direction        | Behavior                                               |
| ---------------- | ------------------------------------------------------ |
| Google → Planner | Push notifications (real-time) + polling fallback (5m) |
| Planner → Google | Push on local change (optimistic) - future enhancement |

### Initial Sync

When a calendar is first linked:

- Pull events from 3 months ago to 1 year ahead
- Paginated import (250 events/page, max 2 pages per cron run)
- Resume from `paginationToken` on subsequent runs if interrupted
- Store `syncCursor` token on completion for incremental updates

### Sync Architecture

Sync uses a **hybrid push + pull architecture**:

**Push Notifications (Primary):**

- Webhook receives Google notifications at `/api/webhooks/google-calendar`
- Triggers immediate incremental sync when events change
- Channel stored in `google_calendar_channels` table
- Channels auto-renewed hourly before expiration (~7 day TTL)

**Polling Fallback (Secondary):**

- Cron job runs every 5-15 minutes via `/api/cron/sync-calendars`
- Catches any missed push notifications
- Resumes incomplete syncs (large calendars)
- Processes calendars with `lastSyncedAt` older than 5 minutes

**Channel Management:**

- `/api/cron/setup-channels` - Daily setup for calendars without channels
- `/api/cron/renew-channels` - Hourly renewal for expiring channels

### Conflict Resolution

**Strategy:** Last Write Wins (per PRD NFR)

| Scenario                    | Resolution                 |
| --------------------------- | -------------------------- |
| Both modified, remote newer | Keep remote, discard local |
| Both modified, local newer  | Push local to remote       |
| Deleted remotely            | Remove from local          |
| Deleted locally             | Remove from remote         |

## Sync Flow

```
┌─────────────────┐     ┌────────────────────────┐     ┌─────────────┐
│     Google      │     │    Planner Backend     │     │   Client    │
│    Calendar     │     │                        │     │   (Hub)     │
└────────┬────────┘     └───────────┬────────────┘     └──────┬──────┘
         │                          │                         │
         │  POST /webhooks/google   │                         │
         │  (push notification)     │                         │
         │─────────────────────────▶│                         │
         │                          │  Incremental sync       │
         │                          │  (background)           │
         │                          │─────────────────────────│
         │                          │                         │
         │  GET /events?syncToken   │                         │
         │◀─────────────────────────│                         │
         │                          │                         │
         │  Changed events          │                         │
         │─────────────────────────▶│  Update DB + notify     │
         │                          │─────────────────────────▶
         │                          │                         │
   ┌─────┴─────┐              ┌─────┴─────┐                   │
   │  Polling  │              │   Cron    │                   │
   │  Fallback │              │  /sync    │                   │
   └───────────┘              └───────────┘                   │
         │  Every 5min (if push missed)                       │
         │◀────────────────────────│                          │
```

**Key Points:**

- Push notifications provide near real-time updates
- Cron polling ensures no events are missed
- Status events (focus time, out of office) are filtered out

### Recurring Events (Post-MVP)

MVP displays recurring events from Google but does not support:

- Editing recurrence rules
- Modifying individual instances
- Creating new recurring events

Recurring events appear as individual instances within the sync date range.

### Timezone Handling

- All timestamps stored as UTC in database
- User's timezone stored in family settings
- All-day events stored with date-only (no time component)
- Display converts UTC to user's local timezone

## Dependencies

- **Better-Auth:** OAuth token storage (`accounts` table)
- **Families:** Calendar linking is family-scoped
- **Calendar:** Events reference `google_calendars`

## Non-Functional Requirements

| Requirement                     | Target                       |
| ------------------------------- | ---------------------------- |
| Sync latency (Google → Hub)     | < 5 minutes                  |
| Push latency (Planner → Google) | < 2 seconds                  |
| Token refresh                   | Automatic, before expiration |
| Rate limiting                   | Respect Google API quotas    |

## Error Handling

| Error            | Handling                          |
| ---------------- | --------------------------------- |
| Token expired    | Auto-refresh via Better-Auth      |
| Token revoked    | Prompt re-authentication          |
| Rate limited     | Exponential backoff               |
| Network failure  | Queue changes, retry on reconnect |
| Calendar deleted | Mark as inactive, notify user     |
