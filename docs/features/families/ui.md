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
- Member invite form (generates shareable link)
- Skip/Continue buttons

### Family Management

Settings page for managing family and members.

**Sections:**

- Family details (name, created date)
- Member list with role badges
- Invite management (create, view active, delete)
- Child account management
- Leave family option

### Member List

| Element      | Specification                                      |
| ------------ | -------------------------------------------------- |
| Avatar       | Circular, colored by `avatar_color` or custom SVG  |
| Name         | Display name or user name fallback                 |
| Role badge   | Colored pill (Manager/Participant/Caregiver/Child) |
| Star balance | Current star count (for participants/children)     |
| Actions      | Edit, Remove (managers only)                       |

### Member Edit Dialog

**Fields:**

- Display name (optional override)
- Avatar color picker (8 colors)
- Custom SVG avatar upload
- Role selector (managers only)

### Invite Management

**Create Invite Dialog:**

- Expiration selector (optional days)
- Max uses input (optional limit)
- Generate button

**Active Invites List:**

| Element | Specification                       |
| ------- | ----------------------------------- |
| URL     | Copyable invite link                |
| Uses    | `{useCount}/{maxUses}` or unlimited |
| Expires | Date/time or "Never"                |
| Actions | Copy, Delete                        |

### Child Account Management

**Add Child Dialog:**

- Child name input
- Avatar color picker
- Create button

**Child List:**

| Element      | Specification                       |
| ------------ | ----------------------------------- |
| Avatar       | Colored circle with child's color   |
| Name         | Child's display name                |
| Star balance | Current star count                  |
| Actions      | Edit, Generate Upgrade Link, Remove |

**Upgrade Token Dialog:**

- Generated link with 24-hour expiration
- Copy button
- Expiration countdown

## Interaction Modes

| Mode             | Access                           |
| ---------------- | -------------------------------- |
| **Wall Display** | View family members only         |
| **Management**   | Full CRUD on members and invites |

## Access Control

| Action                 | Manager | Participant | Caregiver | Child | Device |
| ---------------------- | ------- | ----------- | --------- | ----- | ------ |
| View members           | Yes     | Yes         | Yes       | Yes   | Yes    |
| Edit own profile       | Yes     | Yes         | Yes       | No    | No     |
| Edit other profiles    | Yes     | No          | No        | No    | No     |
| Add members            | Yes     | No          | No        | No    | No     |
| Remove members         | Yes     | No          | No        | No    | No     |
| Change roles           | Yes     | No          | No        | No    | No     |
| Create invites         | Yes     | No          | No        | No    | No     |
| Delete invites         | Yes     | No          | No        | No    | No     |
| Add children           | Yes     | No          | No        | No    | No     |
| Generate upgrade token | Yes     | No          | No        | No    | No     |
| Delete family          | Yes     | No          | No        | No    | No     |
| View star balance      | Yes     | Yes         | Yes       | Yes   | Yes    |
| Award bonus stars      | Yes     | No          | No        | No    | No     |

## Components

### FamilyMemberCard

```tsx
interface FamilyMemberCardProps {
  member: FamilyMemberWithUser;
  isEditable: boolean;
  showStarBalance?: boolean;
  onEdit?: () => void;
  onRemove?: () => void;
}
```

### AvatarColorPicker

Grid of 8 color options matching the `AvatarColor` enum:

- blue, green, red, yellow, purple, orange, pink, teal

### RoleBadge

```tsx
interface RoleBadgeProps {
  role: FamilyMemberRole;
}
```

| Role          | Color  | Label     |
| ------------- | ------ | --------- |
| `manager`     | Blue   | Manager   |
| `participant` | Green  | Member    |
| `caregiver`   | Orange | Caregiver |
| `child`       | Purple | Child     |
| `device`      | Gray   | Device    |

### InviteCard

```tsx
interface InviteCardProps {
  invite: {
    id: string;
    token: string;
    url: string;
    expiresAt: Date | null;
    maxUses: number | null;
    useCount: number;
  };
  onCopy: () => void;
  onDelete: () => void;
}
```

### ChildCard

```tsx
interface ChildCardProps {
  child: FamilyMemberWithUser;
  starBalance: number;
  onEdit?: () => void;
  onGenerateUpgradeToken?: () => void;
  onRemove?: () => void;
}
```

### StarBalanceDisplay

```tsx
interface StarBalanceDisplayProps {
  balance: number;
  size?: "sm" | "md" | "lg";
}
```

## Future Considerations

- Family photo/avatar upload
- Member activity history
- Invite QR code generation
- Pending invitations list with accept/decline
- Child activity dashboard
- Star balance history view
- Device management screen
