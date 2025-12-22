# Google Sync Feature Specification

## Overview

The Google Sync feature enables 2-way synchronization between Family Planner and Google Calendar. It supports multiple Google accounts per family, allowing aggregation of personal, work, and shared calendars into a unified view.

## Documents

| Document | Description |
|----------|-------------|
| [Data Model](./data-model.md) | Database schema, sync metadata |
| [UI Specification](./ui.md) | Account linking, calendar selection |

## PRD Mapping

| PRD Requirement | Implementation |
|-----------------|----------------|
| FR1 - Multi-calendar, multi-account sync | `google_calendars` table with `account_id` FK |
| FR2 - Aggregate disparate sources | Family-level calendar aggregation |
| FR19 - Secure account linking | Better-Auth Google OAuth with token refresh |

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

### Sync Strategy

| Direction | Behavior |
|-----------|----------|
| Google → Planner | Pull events every 5 minutes (configurable) |
| Planner → Google | Push on local change (optimistic) |

### Conflict Resolution

**Strategy:** Last Write Wins (per PRD NFR)

| Scenario | Resolution |
|----------|------------|
| Both modified, remote newer | Keep remote, discard local |
| Both modified, local newer | Push local to remote |
| Deleted remotely | Remove from local |
| Deleted locally | Remove from remote |

## Sync Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Google    │────▶│   Planner   │────▶│   Client    │
│  Calendar   │◀────│   Backend   │◀────│   (Hub)     │
└─────────────┘     └─────────────┘     └─────────────┘
     │                    │                    │
     │   Pull (5min)      │   Poll (2-5s)      │
     │   Push (instant)   │   Optimistic UI    │
```

## Dependencies

- **Better-Auth:** OAuth token storage (`accounts` table)
- **Families:** Calendar linking is family-scoped
- **Calendar:** Events reference `google_calendars`

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Sync latency (Google → Hub) | < 5 minutes |
| Push latency (Planner → Google) | < 2 seconds |
| Token refresh | Automatic, before expiration |
| Rate limiting | Respect Google API quotas |

## Error Handling

| Error | Handling |
|-------|----------|
| Token expired | Auto-refresh via Better-Auth |
| Token revoked | Prompt re-authentication |
| Rate limited | Exponential backoff |
| Network failure | Queue changes, retry on reconnect |
| Calendar deleted | Mark as inactive, notify user |
