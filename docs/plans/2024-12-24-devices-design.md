# Devices Feature Design

Wall-mounted tablets that provide anonymous, credential-less access to family data with restricted permissions.

## Overview

Devices are special access points to the family planner that:

- Don't represent a family member (anonymous)
- Login without user credentials (pairing code)
- Have restricted permissions (no create/edit/delete)
- Run the same UI with mutation controls hidden

## Key Decisions

| Decision         | Choice                                                 |
| ---------------- | ------------------------------------------------------ |
| Purpose          | Multi-purpose: view, interact, no management           |
| Pairing method   | 6-digit code (5 min expiry)                            |
| Authentication   | Device users (phantom users) with better-auth sessions |
| Permissions      | Full interaction, no create/edit/delete                |
| User attribution | Trust-based, flows from task assignment                |
| UI approach      | Same app, hide mutation controls based on session      |
| Platform         | Browser kiosk or PWA                                   |
| Session expiry   | 90 days of inactivity                                  |
| Revocation       | Delete everything (user, familyMember, sessions)       |
| Management UI    | Full: list, rename, view activity, revoke              |

## Data Model

### Schema Changes

**users table** - add type field:

```typescript
type: text("type").notNull().default("human"), // 'human' | 'device'
```

**New table: device_pairing_codes**

```typescript
export const devicePairingCodes = pgTable("device_pairing_codes", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

**familyMembers table** - devices use existing table:

- `role: 'device'`
- `displayName`: device name (e.g., "Kitchen Tablet")

## Pairing Flow

### Manager generates code

1. Settings → Devices → "Add Device"
2. Enter device name ("Kitchen Tablet")
3. `POST /api/devices/pair/generate`
4. Returns 6-digit code, valid for 5 minutes
5. UI shows: "Enter this code on your device: 847291"

### Device completes pairing

1. Device visits `/device/pair`
2. User enters 6-digit code
3. `POST /api/devices/pair/complete { code: "847291" }`
4. Server validates code exists, not expired, not used
5. Server creates:
   - User with `type: 'device'`, name from pairing, email `device-{id}@internal`
   - FamilyMember with `role: 'device'`, `displayName` = device name
   - Session via better-auth (90-day expiry)
6. Mark pairing code as used
7. Return session cookie
8. Redirect to dashboard

## Session Context

### Extended customSession plugin

```typescript
customSession(async ({ user, session }) => {
  const membership = await db
    .select({
      familyId: familyMembers.familyId,
      role: familyMembers.role,
      displayName: familyMembers.displayName
    })
    .from(familyMembers)
    .where(eq(familyMembers.userId, user.id))
    .limit(1);

  return {
    user,
    session: {
      ...session,
      familyId: membership[0]?.familyId ?? null,
      memberRole: membership[0]?.role ?? null,
      isDevice: user.type === 'device',
      deviceName: user.type === 'device' ? membership[0]?.displayName : null,
    },
  };
}),
```

## Permission Model

| Action                           | Manager | Participant | Device |
| -------------------------------- | ------- | ----------- | ------ |
| View calendar/chores/timers      | Yes     | Yes         | Yes    |
| Mark chore complete              | Yes     | Yes         | Yes    |
| Start/pause/stop timer           | Yes     | Yes         | Yes    |
| Complete reward chart task       | Yes     | Yes         | Yes    |
| Claim reward (pick member first) | Yes     | Yes         | Yes    |
| Create/edit/delete anything      | Yes     | Yes         | No     |
| Manage family settings           | Yes     | No          | No     |
| Manage devices                   | Yes     | No          | No     |

### Enforcement

- **UI**: Check `session.isDevice` → hide create/edit/delete buttons
- **API**: Check `session.isDevice` → return 403 on mutation endpoints

## Device Management UI

**Location:** Settings → Devices (managers only)

### Device list shows:

- Device name (editable)
- Paired date
- Last active (from session's updatedAt)
- Status indicator (active if used recently)

### Actions:

- **Add Device** → Modal with name input → generates pairing code
- **Rename** → Inline edit or modal
- **Remove** → Confirmation dialog → deletes user + familyMember + sessions

### Disconnected device screen

When session is invalid (revoked or expired):

- Message: "This device has been disconnected"
- Explanation: "Your session has expired or been revoked."
- Action: "Enter Pairing Code" button → navigate to pairing flow

## Device UI Behavior

### Same app, restricted mode

- Device loads same Next.js app at same URLs
- Middleware detects `session.isDevice` and sets context
- Components check context and hide mutation controls

### Hidden on devices:

- All "Create", "Edit", "Delete" buttons
- Settings/management sections
- Family member management
- Calendar sync settings

### Visible and interactive:

- Dashboard with today's view
- Calendar (view + navigate, no event creation)
- Chores (view + mark complete)
- Timers (view + start/pause/stop/confirm)
- Reward charts (view + mark tasks complete)
- Rewards store (pick member → claim reward)

### Implementation pattern

```typescript
// Hook usage
const { isDevice } = useSession();

// Conditional rendering
{!isDevice && <Button onClick={openCreateModal}>Add Chore</Button>}

// Or wrapper component
<IfNotDevice>
  <Button onClick={openCreateModal}>Add Chore</Button>
</IfNotDevice>
```

## API Endpoints

### Pairing

- `POST /api/devices/pair/generate` - Manager generates code (requires manager session)
- `POST /api/devices/pair/complete` - Device submits code, receives session

### Management

- `GET /api/devices` - List family devices (managers only)
- `PATCH /api/devices/:id` - Rename device (managers only)
- `DELETE /api/devices/:id` - Remove device (managers only)

## Security Considerations

- Pairing codes expire after 5 minutes
- Pairing codes are single-use
- Device sessions expire after 90 days of inactivity
- Sessions refresh on activity (stays alive while in use)
- Revocation deletes all session data immediately
- API endpoints enforce device restrictions server-side (not just UI)
