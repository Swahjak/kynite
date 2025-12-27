# Dashboard Feature Specification

## Overview

The dashboard serves as the home screen and primary interface for the Family Planner. It provides an at-a-glance view of the family's day, designed for quick consumption on wall-mounted displays. The dashboard aggregates data from calendar events, chores, timers, and reward charts into a unified view with real-time updates.

## Documents

| Document                      | Description                                  |
| ----------------------------- | -------------------------------------------- |
| [Data Model](./data-model.md) | Dashboard entities, interfaces, data sources |
| [UI Specification](./ui.md)   | Components, layout, interaction modes        |

## Design Reference

Visual mockups available in `docs/design/dashboard/`:

- `dashboard-design-*.png` - Dashboard layout mockups

> **Note:** Mockups are reference only. Implement using project brand guidelines.

## Key Constraints

- View-only aggregation feature (no dedicated database tables)
- Data fetched server-side and hydrated to client context
- Real-time updates via Pusher family channel
- Timer state managed via React Query with optimistic updates

## Key Features

- **Greeting**: Time-based greeting message (morning/afternoon/evening)
- **Today's Flow**: Timeline of today's calendar events (now/next/later)
- **Today's Chores**: Pending chores with urgency grouping (urgent/due-soon/today)
- **Active Timers**: Running/paused timers with countdown, controls, and cooldown states
- **Weekly Stars**: Family member leaderboard with level progression
- **Quick Actions FAB**: Floating action button to start timer templates
