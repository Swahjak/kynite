# Deletion Functionality Design

## Overview

This document defines the deletion behavior for calendars, family members, and families in the Family Planner application. All deletions are permanent with type-to-confirm safety dialogs.

## Core Behaviors

### Calendar Deletion

When a calendar is deleted:

1. Stop Google push notification channel
2. Delete `googleCalendars` record
3. **Cascade delete** all `events` synced from this calendar
4. Cascade delete `googleCalendarChannels` and `eventParticipants`

### Family Member Deletion

When a family member is deleted:

1. Delete `familyMembers` record (cascades to eventParticipants, starTransactions, etc.)
2. **Delete the underlying `users` record** (cascades to sessions, accounts)

Constraint: Users can only belong to one family at a time.

### Family Deletion

When a family is deleted:

1. Collect all `userIds` from family members
2. Stop all Google push channels for all calendars
3. Delete `families` record (cascades all family-scoped data)
4. **Delete all `users` records** for family members (including owner and devices)

## Schema Changes

### Change 1: Events Cascade on Calendar Delete

```typescript
// src/server/schema/calendars.ts - events table
googleCalendarId: text("google_calendar_id").references(
  () => googleCalendars.id,
  { onDelete: "cascade" }  // Currently: "set null"
),
```

### Change 2: One Family Per User Constraint

```typescript
// src/server/schema/families.ts - familyMembers table indexes
userIdIdx: uniqueIndex("family_members_user_id_idx").on(table.userId),
```

## API Changes

### DELETE /api/v1/families/[familyId]/calendars/[calendarId]

No code changes needed - schema change handles event cascade.

### DELETE /api/v1/families/[familyId]/members/[memberId]

Updated flow:

1. Verify manager role OR self-removal
2. Prevent deleting last manager
3. Get `userId` from member record
4. Delete `familyMembers` record
5. **NEW:** Delete `users` record

### DELETE /api/v1/families/[familyId]

Updated flow:

1. Verify manager role
2. **NEW:** Collect all `userIds` from `familyMembers`
3. **NEW:** Stop all Google push channels for all calendars
4. Delete `families` record (cascades)
5. **NEW:** Delete all `users` records

## Confirmation UI

### Type-to-Confirm Dialog Component

Reusable dialog requiring users to type the exact name to confirm deletion.

```tsx
<DeleteConfirmationDialog
  title="Delete Calendar"
  description="This will permanently delete..."
  confirmText="Calendar Name"
  onConfirm={handleDelete}
/>
```

### Confirmation Messages

**Calendar deletion:**

> This will permanently delete **{calendarName}** and all **{eventCount} events** synced from it. Type the calendar name to confirm.

**Family member deletion:**

> This will permanently delete **{memberName}** and their account. They will no longer be able to log in. Type their name to confirm.

**Family deletion:**

> This will permanently delete the **{familyName}** family, all data, and all member accounts ({memberCount} members). No one will be able to log in. Type the family name to confirm.

### UI Locations

- Calendar delete: Settings → Calendars → Calendar card → Delete button
- Member delete: Settings → Family → Member card → Remove button
- Family delete: Settings → Family → Danger Zone section

## Edge Cases

### Active Sessions

When deleting a user, sessions cascade-delete. User is logged out on next request.

### Self-Deletion

When a user deletes themselves:

1. API completes successfully
2. Frontend receives success, redirects to login
3. Next auth check fails, shows login screen

### Google Channel Cleanup Failure

If `stopWatchChannel()` fails:

- Log error but continue deletion
- Channel expires naturally (max 7 days)
- Google webhook calls return 404 (harmless)

### Partial Failure

Use database transaction for atomicity:

- Collect user IDs
- Delete family/member
- Delete users
- Rollback on any failure

## Out of Scope

- Soft deletes / recovery period
- Audit logging of deletions
- Email notifications before deletion
- Export data before deletion
