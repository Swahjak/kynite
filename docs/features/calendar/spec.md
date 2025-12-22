# Calendar Feature Specification

## Overview

The calendar is the core feature of Family Planner, providing a centralized view of family schedules. It aggregates events from multiple Google Calendars into a unified family view, with support for multi-user event participation.

## Documents

| Document                      | Description                           |
| ----------------------------- | ------------------------------------- |
| [Data Model](./data-model.md) | Database schema, events, participants |
| [UI Specification](./ui.md)   | Components, views, interaction modes  |

## Dependencies

| Feature                               | Relationship                                                   |
| ------------------------------------- | -------------------------------------------------------------- |
| [Families](../families/spec.md)       | Events are scoped to a family; participants are family members |
| [Google Sync](../google-sync/spec.md) | Events sync from linked Google Calendars                       |

## PRD Mapping

| PRD Requirement                   | Implementation                                           |
| --------------------------------- | -------------------------------------------------------- |
| FR2 - Aggregate disparate sources | Events from multiple `google_calendars` merged by family |
| FR3 - Multiple calendar views     | Day, Week, Month, List views                             |
| FR4 - CRUD operations             | Managers can create/edit/delete events                   |
| FR14 - Real-time sync             | Events update via polling + optimistic UI                |
| FR15 - Cached mode                | Events stored locally, offline indicator                 |

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

## Local Event Creation

When creating events in Family Planner:

1. **Target Calendar Selection:** User must select which synced Google Calendar to create the event in
2. **Participant Assignment:** User assigns family members (independent of Google attendees)
3. **Sync Behavior:** Event is pushed to selected Google Calendar on next sync cycle

UI shows only writable calendars (`access_role: 'owner'` or `'writer'`) as targets.

## Out of MVP Scope

The following Google Calendar features are not imported or synced in MVP:

| Feature                  | Reason                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Google attendees         | Family participants serve a different purpose (event assignment vs. meeting invitees) |
| Event reminders          | Use local notification system instead                                                 |
| Event status (tentative) | Keep display simple; all synced events shown as confirmed                             |
| Recurring event editing  | Google handles recurrence rules; instances synced individually                        |
| Organizer field          | Not relevant for family display                                                       |
