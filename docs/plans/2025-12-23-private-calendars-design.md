# Private Calendars Feature Design

## Overview

When a Google Calendar is marked as "private", events from that calendar are visible to all family members but with redacted content. Only the calendar owner (the Google account holder) can see full event details. Non-owners see "Hidden" as the title with no description or location.

**Security guarantee:** Sensitive event data never reaches the browser for unauthorized users - filtering happens server-side.

## Requirements Summary

| Requirement              | Decision                             |
| ------------------------ | ------------------------------------ |
| Who sees full details    | Google account owner only            |
| Placeholder text         | "Hidden"                             |
| Hidden event interaction | None (display-only)                  |
| Privacy setting location | Per-calendar toggle in sync settings |
| Visual styling           | Slightly muted (75-80% opacity)      |

## Data Model

Add `isPrivate` column to `googleCalendars` table:

```typescript
// src/server/schema.ts - googleCalendars table
isPrivate: boolean("is_private").notNull().default(false),
```

Migration:

```sql
ALTER TABLE google_calendars
ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT false;
```

No changes to the `events` table - privacy is determined by the calendar, not per-event.

## Service Layer Filtering

### Changes to `event-service.ts`

The `getEventsForFamily` function gains a `viewerUserId` parameter:

```typescript
export async function getEventsForFamily(
  familyId: string,
  query?: EventQueryInput,
  viewerUserId?: string // NEW: for privacy filtering
): Promise<EventWithParticipants[]> {
  // ... existing query logic ...

  // After fetching events, apply privacy filtering
  return result.map((event) => {
    if (shouldRedactEvent(event, viewerUserId)) {
      return {
        ...event,
        title: "Hidden",
        description: null,
        location: null,
        isHidden: true,
      };
    }
    return { ...event, isHidden: false };
  });
}
```

### Ownership Check

```typescript
function shouldRedactEvent(
  event: EventWithCalendar,
  viewerUserId?: string
): boolean {
  // Not from a private calendar - no redaction
  if (!event.calendar?.isPrivate) return false;

  // No viewer context - redact to be safe
  if (!viewerUserId) return true;

  // Check if viewer owns the Google account linked to this calendar
  // Calendar -> Account -> User
  return event.calendar.accountUserId !== viewerUserId;
}
```

### What Gets Sent to Non-Owners

| Field          | Sent | Value    |
| -------------- | ---- | -------- |
| Event ID       | Yes  | Original |
| Start/end time | Yes  | Original |
| All-day flag   | Yes  | Original |
| Calendar color | Yes  | Original |
| `isHidden`     | Yes  | `true`   |
| Title          | Yes  | "Hidden" |
| Description    | Yes  | `null`   |
| Location       | Yes  | `null`   |

## API Layer Changes

### Route: `/api/v1/families/[familyId]/events`

```typescript
// Extract userId from session and pass to service
const events = await getEventsForFamily(
  familyId,
  query,
  session.user.id // NEW
);
```

### Response Shape Addition

```typescript
interface EventResponse {
  // ... existing fields
  isHidden: boolean; // NEW: true when event is from private calendar
}
```

### Affected Endpoints

- `GET /api/v1/families/[familyId]/events` - Add `viewerUserId` parameter
- `GET /api/v1/families/[familyId]/events/[eventId]` - Same pattern
- Create/update/delete - No changes (already require ownership)

## UI Components

### Event Rendering

When `event.isHidden === true`:

```tsx
<div
  className={cn(
    "event-card",
    event.isHidden && "pointer-events-none opacity-[0.77] select-none"
  )}
>
  {event.title} {/* Will be "Hidden" */}
</div>
```

- Slightly reduced opacity (77%)
- No click/hover interactions
- No cursor pointer
- Text not selectable

### Settings UI (Calendar Sync Page)

Add "Private" toggle next to each synced calendar:

```
Calendar Name           Sync    Private
─────────────────────────────────────────
Work Calendar           [✓]     [ ]
Personal                [✓]     [✓]
Holidays                [ ]     [ ]  (disabled when sync off)
```

Toggle behavior:

- Only enabled when sync is enabled
- Tooltip: "Hide event details from other family members"

## Edge Cases

| Scenario                         | Behavior                                    |
| -------------------------------- | ------------------------------------------- |
| Owner views own private calendar | Full details shown                          |
| Non-owner views private events   | "Hidden" + muted styling                    |
| Privacy toggled after sync       | Immediately effective (read-time filtering) |
| Google sync imports new events   | Privacy determined by calendar setting      |

## Testing Strategy

### Unit Tests

- Service layer filtering with owner/non-owner combinations
- Edge cases: no viewer, no calendar, null fields

### Integration Tests

- API returns redacted data for non-owners
- API returns full data for owners
- Privacy toggle persists correctly

### E2E Tests

- Verify DOM never contains real title for hidden events
- Verify network response has "Hidden", not real title
- Visual regression for muted styling

### Security Verification

Manual check:

1. Log in as non-owner
2. Open browser DevTools → Network tab
3. Inspect API response payload
4. Confirm title is "Hidden", not actual event title

## Implementation Order

1. Database: Add `isPrivate` column + migration
2. Service: Add filtering logic to `getEventsForFamily`
3. API: Pass `viewerUserId` to service functions
4. UI: Add `isHidden` styling to event components
5. Settings: Add privacy toggle to calendar sync page
6. Tests: Unit, integration, and E2E coverage
