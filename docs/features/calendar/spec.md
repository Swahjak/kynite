# Calendar Feature Specification

## Overview

The calendar is the core feature of Family Planner, providing a centralized view of family schedules. It aggregates events from multiple Google Calendars into a unified family view, with support for multi-user event participation.

## Documents

| Document | Description |
|----------|-------------|
| [Data Model](./data-model.md) | Database schema, events, participants |
| [UI Specification](./ui.md) | Components, views, interaction modes |

## Dependencies

| Feature | Relationship |
|---------|--------------|
| [Families](../families/spec.md) | Events are scoped to a family; participants are family members |
| [Google Sync](../google-sync/spec.md) | Events sync from linked Google Calendars |

## PRD Mapping

| PRD Requirement | Implementation |
|-----------------|----------------|
| FR2 - Aggregate disparate sources | Events from multiple `google_calendars` merged by family |
| FR3 - Multiple calendar views | Day, Week, Month, List views |
| FR4 - CRUD operations | Managers can create/edit/delete events |
| FR14 - Real-time sync | Events update via polling + optimistic UI |
| FR15 - Cached mode | Events stored locally, offline indicator |

## Design Reference

Visual mockups available in `docs/design/calendar/`:
- `calendar-month-design-*.png` - Month view mockups
- `calendar-week-design-*.png` - Week view mockups
- `calendar-today-design-*.png` - Today view mockups

> **Note:** Mockups are reference only. Implement using project brand guidelines.

## Key Features

- Multiple calendar views (Today, Day, Week, Month)
- Family member filtering with color-coded avatars
- Multi-participant events (events can be assigned to multiple family members)
- Event color categorization
- Drag-and-drop event rescheduling (Management mode only)
- Google Calendar 2-way sync (via Google Sync feature)
- Offline support with cached events
- Dark mode support
- Internationalization (nl/en)
