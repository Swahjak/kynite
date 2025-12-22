# Design Reference

This folder contains **visual mockups and code references** for the Family Planner UI.

> **Important**: These designs are reference materials only. When implementing,
> always apply the project's brand guidelines and established patterns from
> the codebase. Do not copy mockup code directly.

## Contents

- `calendar/` - Calendar view mockups
- `chores/` - Chores view mockups
- `dashboard/` - Dashboard mockups
- `reward-store/` - Reward store mockups
- `ui/` - Shared component mockups (header, menu)

## Usage

1. Reference these mockups for visual direction
2. Apply brand colors, typography, and spacing from the project's Tailwind config
3. Use existing shadcn/ui components where possible
4. Follow accessibility guidelines from feature specs in `docs/features/`

## Relationship to Feature Specs

Each design folder has a corresponding feature spec in `docs/features/`:

| Design                 | Feature Spec             |
| ---------------------- | ------------------------ |
| `design/calendar/`     | `features/calendar/`     |
| `design/chores/`       | `features/chores/`       |
| `design/dashboard/`    | `features/dashboard/`    |
| `design/reward-store/` | `features/reward-store/` |

The feature specs define **what** to build. These designs show **how** it could look.
