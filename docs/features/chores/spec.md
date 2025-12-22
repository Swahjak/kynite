# Chores Feature Specification

## Overview

The chores view serves as the task display and completion interface for the Family Planner. It provides family members with an at-a-glance view of outstanding household tasks, optimized for quick completion on wall-mounted displays.

## Documents

| Document | Description |
|----------|-------------|
| [Data Model](./data-model.md) | Chore entities, database schema, API endpoints |
| [UI Specification](./ui.md) | Components, views, interaction modes |

## Design Reference

Visual mockups available in `docs/design/chores/`:
- `chores-design-*.png` - Chores view mockups

> **Note:** Mockups are reference only. Implement using project brand guidelines.

## Key Constraints

- **Read-only interface**: Chore creation, editing, and assignment is managed through a separate administration interface
- **Completion-focused**: The only interactive action is marking chores as complete
- **Display-first**: Optimized for passive viewing and quick interactions

## Key Features

- Display outstanding chores for all family members
- Single-tap task completion
- Daily progress tracking and streaks
- Urgent/overdue task highlighting
- Gamification feedback (XP rewards)
