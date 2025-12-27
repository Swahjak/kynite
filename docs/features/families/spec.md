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
- Invite members via shareable invite links
- Family-wide settings and preferences
- Maximum 10 children per family

### Member Roles

| Role          | Description                    | Permissions                                  |
| ------------- | ------------------------------ | -------------------------------------------- |
| `manager`     | Parents, primary admins        | Full CRUD, settings, member management       |
| `participant` | Adult family members           | View schedules, complete tasks, earn rewards |
| `caregiver`   | Grandparents, babysitters      | View-only access to schedules                |
| `child`       | Children (managed profiles)    | View schedules, complete tasks, earn rewards |
| `device`      | Wall-mounted displays, tablets | View-only access for display purposes        |

### Member Profiles

- Display name (kid-friendly override)
- Avatar color for calendar identification (8 colors: blue, green, red, yellow, purple, orange, pink, teal)
- Custom SVG avatar support
- Individual star balance tracking for rewards

### Invitation System

- Shareable invite links with unique tokens
- Optional expiration (configurable days)
- Optional usage limits (max uses)
- Track usage count per invite
- New members join as `participant` role by default

### Child Account Management

Child accounts are special managed profiles:

- Created by managers as placeholder accounts
- No password or OAuth - profiles managed by parents
- Use placeholder email format: `child_{id}@placeholder.internal`
- User type set to `child` (vs `human` for regular users)
- Can be upgraded to full accounts via upgrade tokens

#### Child Upgrade Tokens

- One-time tokens to link a child profile to a real account
- 24-hour expiration
- Allows child to authenticate with Google/email
- Upgrades role from `child` to `participant`
- Converts user type from `child` to `human`

### Device Pairing

Devices (wall displays, tablets) can be paired to families:

- Short-lived pairing codes (configurable expiration)
- Tracks device name and pairing attempts
- Devices get `device` role with view-only access

## Dependencies

- **Better-Auth:** User authentication (`users` table)
- **Google Sync:** Calendar linking per account

## Data Flow

```
User signup -> Create/Join Family -> Assign Role -> Access Features
```

1. User authenticates via Better-Auth
2. User creates a new family or joins existing via invite
3. User is assigned a role (defaults to `manager` for creator, `participant` for invite)
4. Role determines feature access across all modules

## API Endpoints

### Family Management

| Method | Endpoint                      | Description             | Access   |
| ------ | ----------------------------- | ----------------------- | -------- |
| POST   | `/api/v1/families`            | Create new family       | Any user |
| GET    | `/api/v1/families`            | List user's families    | Any user |
| GET    | `/api/v1/families/[familyId]` | Get family with members | Members  |
| PATCH  | `/api/v1/families/[familyId]` | Update family name      | Manager  |
| DELETE | `/api/v1/families/[familyId]` | Delete family (cascade) | Manager  |

### Member Management

| Method | Endpoint                                         | Description                | Access       |
| ------ | ------------------------------------------------ | -------------------------- | ------------ |
| GET    | `/api/v1/families/[familyId]/members`            | List family members        | Members      |
| POST   | `/api/v1/families/[familyId]/members`            | Add member by userId       | Manager      |
| PATCH  | `/api/v1/families/[familyId]/members/[memberId]` | Update member profile/role | Self/Manager |
| DELETE | `/api/v1/families/[familyId]/members/[memberId]` | Remove member (or leave)   | Self/Manager |

### Star Balance

| Method | Endpoint                                                     | Description             | Access  |
| ------ | ------------------------------------------------------------ | ----------------------- | ------- |
| GET    | `/api/v1/families/[familyId]/members/[memberId]/stars`       | Get balance (+ history) | Members |
| POST   | `/api/v1/families/[familyId]/members/[memberId]/stars/bonus` | Award bonus stars       | Manager |

### Invitations

| Method | Endpoint                                         | Description         | Access  |
| ------ | ------------------------------------------------ | ------------------- | ------- |
| POST   | `/api/v1/families/[familyId]/invites`            | Create invite link  | Manager |
| GET    | `/api/v1/families/[familyId]/invites`            | List active invites | Manager |
| DELETE | `/api/v1/families/[familyId]/invites/[inviteId]` | Delete invite       | Manager |

### Child Accounts

| Method | Endpoint                                                             | Description            | Access  |
| ------ | -------------------------------------------------------------------- | ---------------------- | ------- |
| POST   | `/api/v1/families/[familyId]/children`                               | Create child profile   | Manager |
| GET    | `/api/v1/families/[familyId]/children`                               | List children          | Members |
| POST   | `/api/v1/families/[familyId]/children/[childMemberId]/upgrade-token` | Generate upgrade token | Manager |

## Business Rules

### Manager Constraints

- At least one manager must exist in each family
- Cannot demote the last manager
- Cannot remove the last manager

### Membership Constraints

- A user can belong to multiple families (e.g., shared custody)
- `user_id` + `family_id` must be unique (one membership per family)
- Users joining via invite become `participant` by default

### Child Limits

- Maximum 10 children per family
- Children cannot authenticate directly (managed by parents)
- Upgrade tokens are one-time use with 24-hour expiration
