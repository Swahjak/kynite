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

| Mode | Access |
|------|--------|
| **Wall Display** | View sync status only (read-only) |
| **Management** | Full account/calendar management |

## Components

### LinkedAccountCard

```tsx
interface LinkedAccountCardProps {
  account: {
    id: string;
    email: string;
    image?: string;
    calendars: GoogleCalendar[];
  };
  onRefresh: () => void;
  onUnlink: () => void;
}
```

| Element | Specification |
|---------|---------------|
| Avatar | Google profile picture or email initial |
| Email | Account identifier |
| Calendar count | "3 calendars synced" |
| Last sync | Relative time ("2 min ago") |
| Actions | Refresh, Unlink buttons |

### CalendarToggle

```tsx
interface CalendarToggleProps {
  calendar: GoogleCalendar;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}
```

| Element | Specification |
|---------|---------------|
| Color swatch | 16x16 circle with Google color |
| Name | Calendar display name |
| Toggle | Switch component |

### SyncStatusBadge

```tsx
interface SyncStatusBadgeProps {
  status: 'synced' | 'syncing' | 'pending' | 'error' | 'offline';
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

### Sync Conflict

```
Event "Team Meeting" was modified both locally and on Google.
[Keep Local] [Keep Google] [View Diff]
```

## Future Considerations

- Push notification for sync failures
- Selective sync (date range)
- Sync history/audit log
- Multiple family support per account
