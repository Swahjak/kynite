# Google Sync UI Specification

## Screens

### Account Linking

Add Google accounts to the family.

**Access:** Managers only (Management mode)

**Flow:**

1. Click "Add Google Account"
2. OAuth consent screen (Google)
3. Return to app with account linked
4. Select calendars to sync

**Components:**

- Linked accounts list
- "Add Account" button
- Account actions (refresh, unlink)

### Calendar Selection

Choose which calendars to sync from each account.

**Access:** Managers only

**Components:**

- Account header (email, avatar)
- Calendar checkboxes with color swatches
- "Sync All" / "Sync None" toggles
- Last synced timestamp per calendar

### Sync Status Indicator

Global indicator showing sync health.

**Locations:**

- Calendar header (small icon)
- Settings panel (detailed)

**States:**
| State | Icon | Description |
|-------|------|-------------|
| Synced | Check | All calendars up to date |
| Syncing | Spinner | Sync in progress |
| Pending | Clock | Local changes waiting |
| Error | Warning | Sync failed |
| Offline | Cloud-off | No connection |

## Interaction Modes

| Mode             | Access                            |
| ---------------- | --------------------------------- |
| **Wall Display** | View sync status only (read-only) |
| **Management**   | Full account/calendar management  |

## Components

### LinkedAccountCard

```tsx
interface LinkedAccountCardProps {
  account: {
    id: string;
    email: string;
    image?: string;
    calendars: GoogleCalendar[];
    syncError?: string | null; // Error message if sync failed
    syncErrorAt?: Date | null; // When the error occurred
  };
  onRefresh: () => void;
  onUnlink: () => void;
}
```

| Element        | Specification                           |
| -------------- | --------------------------------------- |
| Avatar         | Google profile picture or email initial |
| Email          | Account identifier                      |
| Calendar count | "3 calendars synced"                    |
| Last sync      | Relative time ("2 min ago")             |
| Error badge    | Warning icon if `syncError` is set      |
| Actions        | Refresh, Unlink buttons                 |

### Sync Error Indicator

Displays when an account has a sync error:

```tsx
interface SyncErrorIndicatorProps {
  error: string;
  errorAt: Date;
}
```

| Element | Specification                                |
| ------- | -------------------------------------------- |
| Icon    | Warning triangle (amber/red)                 |
| Tooltip | Full error message                           |
| Time    | "Failed 5 min ago"                           |
| Action  | "Try Again" button to trigger manual refresh |

### CalendarToggle

```tsx
interface CalendarToggleProps {
  calendar: GoogleCalendar;
  enabled: boolean;
  isPrivate: boolean;
  onChange: (enabled: boolean) => void;
  onPrivacyChange: (isPrivate: boolean) => void;
}
```

| Element        | Specification                             |
| -------------- | ----------------------------------------- |
| Color swatch   | 16x16 circle with Google color            |
| Name           | Calendar display name                     |
| Sync toggle    | Switch component for enabling sync        |
| Privacy toggle | Lock icon button for private mode         |
| Access role    | Badge showing 'owner', 'writer', 'reader' |

### SyncStatusBadge

```tsx
interface SyncStatusBadgeProps {
  // Database states: 'synced', 'pending', 'conflict', 'error'
  // Runtime states: 'syncing' (during active sync), 'offline' (no connection)
  status: "synced" | "syncing" | "pending" | "conflict" | "error" | "offline";
  lastSyncedAt?: Date;
  errorMessage?: string;
}
```

## Settings Panel

Located in Calendar Settings, "Google Sync" tab.

**Sections:**

1. **Linked Accounts**
   - List of LinkedAccountCard components
   - "Add Google Account" button

2. **Sync Settings**
   - Sync frequency selector (1/5/15/30 min)
   - Manual "Sync Now" button
   - Last sync timestamp

3. **Troubleshooting**
   - Sync log (recent operations)
   - "Re-authenticate" for expired tokens
   - "Clear & Resync" for conflicts

## Error States

### Token Expired

```
Your Google account needs to be reconnected.
[Reconnect Account]
```

### Calendar Not Found

```
Calendar "Work" was deleted or unshared on Google.
[Remove from Planner] [Dismiss]
```

### Sync Conflict (Auto-Resolved)

Conflicts are resolved automatically using Last Write Wins strategy.

User sees a toast notification:

- "Event updated from Google" (remote was newer)
- "Your changes synced to Google" (local was newer)

### Read-Only Calendar Indicator

Calendars with `accessRole: 'reader'` show:

- Lock icon on calendar toggle
- Tooltip: "This calendar is read-only"
- Events from read-only calendars cannot be edited in Planner

### Initial Sync Progress

When linking a new calendar:

- Modal with progress bar
- "Syncing 3 months of history..."
- Event count as it imports
- "Done! X events imported" confirmation

## Future Considerations

- Push notification for sync failures
- Selective sync (date range)
- Sync history/audit log
- Multiple family support per account
