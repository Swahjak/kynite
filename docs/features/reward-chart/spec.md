# Reward Chart Feature Specification

## Overview

The Reward Chart (Star Chart) is a gamification feature that helps children track daily routines and earn stars toward goals. Each child has their own personalized chart with tasks assigned by parents. Children self-report task completion without approval required.

## Documents

| Document                      | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| [Data Model](./data-model.md) | Chart entities, task definitions, completion records |
| [UI Specification](./ui.md)   | Components, weekly grid, interaction patterns        |

## Design Reference

Visual mockups available in `docs/design/reward-chart/`:

- `reward-chart-design-*.png` - Star Chart layout mockups
- `reward-chart-code-1.html` - Interactive HTML prototype

> **Note:** Mockups are reference only. Implement using project brand guidelines.

## Key Constraints

- **Per-child charts**: Each child has their own task list and goal progress
- **Self-report completion**: Children mark tasks complete themselves (no parent approval)
- **Weekly view**: Always displays the current week (Mon-Sun)
- **Passive encouragement**: Parent messages provide motivation without blocking interaction

## Key Features

- Personalized greeting with child's name
- Current goal progress ring showing stars toward reward
- Weekly grid: tasks (rows) × days (columns)
- Task cell states: completed (star), pending (checkmark button), missed (X), not applicable (dot)
- Today's stars counter
- Next reward preview card with progress
- Parent encouragement message area

## User Personas

| Persona    | Access                | Actions                                   |
| ---------- | --------------------- | ----------------------------------------- |
| **Child**  | Own chart only        | Mark tasks complete, view progress        |
| **Parent** | All children's charts | Configure tasks, set goals, send messages |

## Relationship to Other Features

| Feature          | Relationship                                                           |
| ---------------- | ---------------------------------------------------------------------- |
| **Chores**       | Reward Chart tasks are separate from Chores (simpler, routine-focused) |
| **Reward Store** | Stars earned here can be spent in the Reward Store                     |
| **Dashboard**    | Dashboard shows aggregated star counts from this feature               |
