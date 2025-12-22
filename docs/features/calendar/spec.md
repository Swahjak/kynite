# Calendar Feature Specification

## Overview

The calendar is the core feature of Family Planner, providing a centralized view of family schedules. It integrates with Google Calendar to display events and connects with the Chores module for task management.

## Documents

| Document | Description |
|----------|-------------|
| [Data Model](./data-model.md) | Event entities, interfaces, API endpoints |
| [UI Specification](./ui.md) | Components, views, interaction modes |

## Design Reference

Visual mockups available in `docs/design/calendar/`:
- `calendar-month-design-*.png` - Month view mockups
- `calendar-week-design-*.png` - Week view mockups
- `calendar-today-design-*.png` - Today view mockups

> **Note:** Mockups are reference only. Implement using project brand guidelines.

## Key Features

- Multiple calendar views (Today, Day, Week, Month)
- Family member filtering with color-coded avatars
- Event color categorization
- Drag-and-drop event rescheduling (Management mode only)
- Integration with Google Calendar API
- Dark mode support
- Internationalization (nl/en)
