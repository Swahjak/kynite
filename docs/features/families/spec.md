# Families Feature Specification

## Overview

The Families feature provides household management, grouping users into family units with role-based access. It serves as the foundation for all other features, enabling multi-user collaboration and personalized experiences.

## Documents

| Document                      | Description                               |
| ----------------------------- | ----------------------------------------- |
| [Data Model](./data-model.md) | Database schema, entities, relationships  |
| [UI Specification](./ui.md)   | Components, screens, interaction patterns |

## PRD Mapping

| PRD Requirement                      | Implementation                                  |
| ------------------------------------ | ----------------------------------------------- |
| FR17 - Multiple participant profiles | `family_members` table with individual tracking |
| FR18 - Caregiver view access         | `caregiver` role with read-only permissions     |
| FR19 - Multi-account management      | Family-level Google account linking             |

## Key Features

### Family Unit

- Create and manage family/household groups
- Invite members via email or link
- Family-wide settings and preferences

### Member Roles

| Role          | Description               | Permissions                                  |
| ------------- | ------------------------- | -------------------------------------------- |
| `manager`     | Parents, primary admins   | Full CRUD, settings, member management       |
| `participant` | Children, tracked members | View schedules, complete tasks, earn rewards |
| `caregiver`   | Grandparents, babysitters | View-only access to schedules                |

### Member Profiles

- Display name (kid-friendly override)
- Avatar color for calendar identification
- Individual tracking for rewards/progress (Phase 2)

## Dependencies

- **Better-Auth:** User authentication (`users` table)
- **Google Sync:** Calendar linking per account

## Data Flow

```
User signup → Create/Join Family → Assign Role → Access Features
```

1. User authenticates via Better-Auth
2. User creates a new family or joins existing via invite
3. User is assigned a role (defaults to `manager` for creator)
4. Role determines feature access across all modules
