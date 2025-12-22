# Families UI Specification

## Screens

### Family Setup (Onboarding)

First-time users are guided through family creation.

**Flow:**
1. Create family name
2. Invite members (optional, can skip)
3. Complete setup

**Components:**
- Family name input
- Member invite form (email)
- Skip/Continue buttons

### Family Management

Settings page for managing family and members.

**Sections:**
- Family details (name, created date)
- Member list with role badges
- Invite new member button
- Leave family option

### Member List

| Element | Specification |
|---------|---------------|
| Avatar | Circular, colored by `avatar_color` |
| Name | Display name or user name fallback |
| Role badge | Colored pill (Manager/Participant/Caregiver) |
| Actions | Edit, Remove (managers only) |

### Member Edit Dialog

**Fields:**
- Display name (optional override)
- Avatar color picker
- Role selector (managers only)

## Interaction Modes

| Mode | Access |
|------|--------|
| **Wall Display** | View family members only |
| **Management** | Full CRUD on members |

## Access Control

| Action | Manager | Participant | Caregiver |
|--------|---------|-------------|-----------|
| View members | Yes | Yes | Yes |
| Edit own profile | Yes | Yes | Yes |
| Edit other profiles | Yes | No | No |
| Add members | Yes | No | No |
| Remove members | Yes | No | No |
| Change roles | Yes | No | No |
| Delete family | Yes | No | No |

## Components

### FamilyMemberCard

```tsx
interface FamilyMemberCardProps {
  member: FamilyMember;
  isEditable: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
}
```

### AvatarColorPicker

Grid of 8 color options matching the `AvatarColor` enum.

### RoleBadge

```tsx
interface RoleBadgeProps {
  role: FamilyMemberRole;
}
```

| Role | Color | Label |
|------|-------|-------|
| `manager` | Blue | Manager |
| `participant` | Green | Member |
| `caregiver` | Orange | Caregiver |

## Future Considerations

- Family photo/avatar upload
- Member activity history
- Invite link with expiration
- Pending invitations list
