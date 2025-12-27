# Google Sync Data Model

## Database Schema

### google_calendars

Tracks which Google Calendars are linked to a family.

```typescript
export const googleCalendars = pgTable("google_calendars", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  googleCalendarId: text("google_calendar_id").notNull(),
  name: text("name").notNull(),
  color: text("color"),
  accessRole: text("access_role").notNull().default("reader"), // 'owner' | 'writer' | 'reader'
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  isPrivate: boolean("is_private").notNull().default(false),
  lastSyncedAt: timestamp("last_synced_at", { mode: "date" }),
  syncCursor: text("sync_cursor"), // Google's sync token for incremental updates
  paginationToken: text("pagination_token"), // Stored pageToken for resuming interrupted syncs
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

| Column               | Type      | Description                                                    |
| -------------------- | --------- | -------------------------------------------------------------- |
| `id`                 | text      | Primary key (CUID)                                             |
| `family_id`          | text      | FK to `families.id`                                            |
| `account_id`         | text      | FK to `accounts.id` (Better-Auth OAuth)                        |
| `google_calendar_id` | text      | Google Calendar ID (e.g., "primary", email, or calendar ID)    |
| `name`               | text      | Display name from Google                                       |
| `color`              | text      | Google's calendar color hex code                               |
| `access_role`        | text      | Calendar permission level: 'owner', 'writer', or 'reader'      |
| `sync_enabled`       | boolean   | Whether to sync this calendar                                  |
| `is_private`         | boolean   | If true, event details are hidden in family calendar view      |
| `last_synced_at`     | timestamp | Last successful sync time                                      |
| `sync_cursor`        | text      | Google's sync token for incremental updates                    |
| `pagination_token`   | text      | Stored pageToken for resuming interrupted syncs (cron timeout) |
| `created_at`         | timestamp | When calendar was linked                                       |
| `updated_at`         | timestamp | Last modification time                                         |

### google_calendar_channels

Tracks active push notification webhook subscriptions for real-time sync.

```typescript
export const googleCalendarChannels = pgTable("google_calendar_channels", {
  id: text("id").primaryKey(), // Our UUID, sent to Google as channel id
  googleCalendarId: text("google_calendar_id")
    .notNull()
    .references(() => googleCalendars.id, { onDelete: "cascade" }),
  resourceId: text("resource_id").notNull(), // Google's resource identifier (from watch response)
  token: text("token").notNull(), // Verification token (X-Goog-Channel-Token)
  expiration: timestamp("expiration", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

| Column               | Type      | Description                                        |
| -------------------- | --------- | -------------------------------------------------- |
| `id`                 | text      | Primary key (CUID), sent to Google as channel ID   |
| `google_calendar_id` | text      | FK to `google_calendars.id`                        |
| `resource_id`        | text      | Google's resource identifier from watch response   |
| `token`              | text      | Secure verification token (base64url, 32 bytes)    |
| `expiration`         | timestamp | When the channel expires (max ~7 days from Google) |
| `created_at`         | timestamp | When the channel was created                       |

### accounts (Sync Error Tracking)

The Better-Auth `accounts` table includes sync error tracking fields:

```typescript
// Additional fields on accounts table for sync error tracking
lastSyncError: text("last_sync_error"),
lastSyncErrorAt: timestamp("last_sync_error_at", { mode: "date" }),
```

| Column               | Type      | Description                                |
| -------------------- | --------- | ------------------------------------------ |
| `last_sync_error`    | text      | Last sync error message (null if no error) |
| `last_sync_error_at` | timestamp | When the last sync error occurred          |

## Relationships

```
┌─────────────────┐
│     users       │  (Better-Auth)
├─────────────────┤
│ id            ◄─┼─────────┐
│ name            │         │
│ email           │         │
└─────────────────┘         │
                            │
┌─────────────────────────┐ │
│    accounts             │ │  (Better-Auth OAuth)
├─────────────────────────┤ │
│ id                    ◄─┼─┼───┐
│ user_id (FK)          ──┼─┘   │
│ provider_id             │     │  (= 'google')
│ access_token            │     │
│ refresh_token           │     │
│ last_sync_error         │     │  (Sync error tracking)
│ last_sync_error_at      │     │
└─────────────────────────┘     │
                                │
┌─────────────────┐             │
│    families     │             │
├─────────────────┤             │
│ id            ◄─┼─────────────┼───┐
│ name            │             │   │
└─────────────────┘             │   │
                                │   │
┌───────────────────────────────┼───┼─────┐
│  google_calendars             │   │     │
├───────────────────────────────┤   │     │
│ id                          ◄─┼─┐ │     │
│ family_id (FK)              ──┼─┼─┼─────┘
│ account_id (FK)             ──┼─┼─┘
│ google_calendar_id            │ │
│ name, color, access_role      │ │
│ sync_enabled, is_private      │ │
│ last_synced_at, sync_cursor   │ │
│ pagination_token              │ │
└───────────────────────────────┘ │
         │                        │
         │                        │
         ▼                        │
┌────────────────────────────┐    │
│  google_calendar_channels  │    │
├────────────────────────────┤    │
│ id                         │    │
│ google_calendar_id (FK)  ──┼────┘
│ resource_id                │
│ token                      │
│ expiration                 │
└────────────────────────────┘

         │ (google_calendars referenced by events.google_calendar_id)
         ▼
┌─────────────────────┐
│       events        │
├─────────────────────┤
│ google_calendar_id  │ (FK, nullable)
│ google_event_id     │
│ sync_status         │
│ local_updated_at    │
│ remote_updated_at   │
└─────────────────────┘
```

## Sync Metadata on Events

Events table includes fields for Google sync tracking (defined in Calendar feature):

| Column               | Type      | Description                         |
| -------------------- | --------- | ----------------------------------- |
| `google_calendar_id` | text      | FK to `google_calendars.id`         |
| `google_event_id`    | text      | Google's event ID for 2-way sync    |
| `sync_status`        | text      | 'synced' \| 'pending' \| 'conflict' |
| `local_updated_at`   | timestamp | When event was modified locally     |
| `remote_updated_at`  | timestamp | Google's last modified time         |

## Enums

### SyncStatus

```typescript
type SyncStatus = "synced" | "pending" | "conflict" | "error";
```

| Value      | Description                               |
| ---------- | ----------------------------------------- |
| `synced`   | Event matches Google state                |
| `pending`  | Local changes not yet pushed              |
| `conflict` | Both local and remote modified            |
| `error`    | Sync failed (e.g., API error, rate limit) |

## Indexes

```sql
-- Fast lookup of calendars by family
CREATE INDEX idx_google_calendars_family_id ON google_calendars(family_id);

-- Fast lookup of calendars by account
CREATE INDEX idx_google_calendars_account_id ON google_calendars(account_id);

-- Unique constraint: one calendar per account per family
CREATE UNIQUE INDEX idx_google_calendars_unique
ON google_calendars(family_id, account_id, google_calendar_id);
```

## Example Queries

### Get all synced calendars for a family

```sql
SELECT
  gc.id,
  gc.name,
  gc.color,
  gc.last_synced_at,
  a.provider_account_id AS google_account_email
FROM google_calendars gc
JOIN accounts a ON gc.account_id = a.id
WHERE gc.family_id = 'family_123'
AND gc.sync_enabled = true
ORDER BY gc.name;
```

### Get calendars needing sync (older than 5 minutes)

```sql
SELECT * FROM google_calendars
WHERE sync_enabled = true
AND (
  last_synced_at IS NULL
  OR last_synced_at < NOW() - INTERVAL '5 minutes'
);
```

### Get events pending sync to Google

```sql
SELECT e.*, gc.google_calendar_id
FROM events e
JOIN google_calendars gc ON e.google_calendar_id = gc.id
WHERE e.sync_status = 'pending';
```

## Google API Integration

### Calendar List Endpoint

```
GET https://www.googleapis.com/calendar/v3/users/me/calendarList
```

Returns all calendars accessible by the authenticated user. Store selected ones in `google_calendars`.

### Events Sync Endpoint

```
GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events
  ?syncToken={syncCursor}
```

Use `sync_cursor` for incremental updates. Google returns only changed events since last sync.

### Event Push Endpoint

```
POST/PUT/DELETE https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events/{eventId}
```

Push local changes to Google. Update `sync_status` to 'synced' on success.

## Sync Configuration

### Sync Date Range

Initial sync pulls events within a bounded date range:

```typescript
const SYNC_RANGE = {
  pastMonths: 3, // 3 months of history
  futureMonths: 12, // 1 year ahead
};
```

Subsequent syncs use incremental `syncToken` to fetch only changed events.
