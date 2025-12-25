# Child Members Without Google Accounts

## Overview

Allow parents/managers to add children as family members without requiring a Google account. Children interact with the app through the wall hub device only, with an optional upgrade path to a full account later.

## Data Model

### User Types

Extend `users.type` to include:

- `human` - Regular users with Google accounts (existing)
- `device` - Wall hub devices (existing)
- `child` - Placeholder users for children without accounts (new)

### Family Member Roles

Extend `familyMembers.role` to include:

- `manager` - Full admin access (existing)
- `participant` - Regular family member (existing)
- `caregiver` - External helper (existing)
- `device` - Wall hub (existing)
- `child` - Child without their own account (new)

### Example Records

```
users: {
  id: "child_abc123",
  name: "Emma",
  email: "child_abc123@placeholder.internal",  // synthetic, never used
  emailVerified: false,
  type: "child",
  image: null
}

familyMembers: {
  id: "member_xyz",
  familyId: "family_123",
  userId: "child_abc123",
  role: "child",
  displayName: "Emma",
  avatarColor: "#FF6B6B"
}
```

### New Table: Child Upgrade Tokens

```typescript
export const childUpgradeTokens = pgTable("child_upgrade_tokens", {
  id: text("id").primaryKey(),
  childUserId: text("child_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

## Child Creation Flow

### API Endpoint

`POST /api/families/[familyId]/children`

### Request

```json
{
  "name": "Emma",
  "avatarColor": "#FF6B6B"
}
```

### Authorization

Only `manager` role can create children.

### Backend Logic

1. Generate unique ID (e.g., `child_${nanoid()}`)
2. Create placeholder user record:
   - `type: "child"`
   - `email: "${id}@placeholder.internal"`
3. Create family member record:
   - `role: "child"`
   - `displayName` = name
   - `avatarColor` = chosen color
4. Optionally auto-create a reward chart for the child

### Validation

- Name required, 1-50 characters
- Avatar color must be valid hex
- Max children per family: 10 (configurable)

### UI Location

Family settings > Members > "Add Child" button (distinct from invite flow).

## Account Linking (Upgrade Path)

When a child is ready for their own account:

### Flow

1. Parent initiates "Link Account" from family settings for a specific child
2. System generates a one-time upgrade token (stored, expires in 24h)
3. Parent shares a link with the child: `/link-account?token=xyz`
4. Child opens link, signs in with Google (or creates account)
5. System validates token, then upgrades:
   - Updates `users` record: `type: "child"` -> `"human"`, real email, etc.
   - Updates `familyMembers.role`: `"child"` -> `"participant"`
   - All existing data (stars, chores, reward charts) stays linked via unchanged `familyMember.id`

### Edge Case

If the Google account email is already in use by another user, reject the upgrade with a clear error.

## Permissions

### What Children Can Do (via device)

| Action                             | Allowed |
| ---------------------------------- | ------- |
| View family calendar               | Yes     |
| View their assigned chores         | Yes     |
| Mark their chores complete         | Yes     |
| Start/stop timers assigned to them | Yes     |
| View their star balance            | Yes     |
| View rewards store                 | Yes     |
| Request reward redemption          | Yes     |
| Set their primary goal             | Yes     |
| View their reward chart            | Yes     |

### What Children Cannot Do

| Action                   | Reason                    |
| ------------------------ | ------------------------- |
| Add/edit calendar events | No Google Calendar linked |
| Manage family settings   | Manager only              |
| Invite members           | Manager only              |
| Create/edit chores       | Manager/parent only       |
| Create/edit rewards      | Manager only              |
| Approve redemptions      | Manager only              |
| Link calendars           | Requires Google OAuth     |

### Implementation Note

The existing device session already has a `familyId`. The device UI shows all children in that family. When a child taps "Mark done" on a chore, the API receives the `familyMemberId` of that child (selected on device), authorized by the device session.

No changes to device auth flow needed - children are just another member type the device displays.

## Files to Modify

- `src/server/schema.ts` - Add `childUpgradeTokens` table, update type comments
- `src/app/api/families/[familyId]/children/route.ts` - New endpoint for creating children
- `src/app/api/link-account/route.ts` - New endpoint for account upgrades
- Family settings UI - Add "Add Child" and "Link Account" buttons
