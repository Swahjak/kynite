# Calendar Data Model

## Database Schema

### events

Local cache of calendar events, synced from Google Calendar.

```typescript
export const events = pgTable("events", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  googleCalendarId: text("google_calendar_id").references(
    () => googleCalendars.id,
    { onDelete: "set null" }
  ),
  googleEventId: text("google_event_id"),

  // Event data
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  isAllDay: boolean("is_all_day").notNull().default(false),

  // Categorization
  color: text("color"), // Category color override

  // Sync metadata
  syncStatus: text("sync_status").notNull().default("synced"),
  localUpdatedAt: timestamp("local_updated_at").notNull().defaultNow(),
  remoteUpdatedAt: timestamp("remote_updated_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

| Column               | Type      | Description                                                  |
| -------------------- | --------- | ------------------------------------------------------------ |
| `id`                 | text      | Primary key (CUID or UUID)                                   |
| `family_id`          | text      | FK to `families.id`                                          |
| `google_calendar_id` | text      | FK to `google_calendars.id` (nullable for local-only events) |
| `google_event_id`    | text      | Google's event ID for 2-way sync                             |
| `title`              | text      | Event title                                                  |
| `description`        | text      | Event description (optional)                                 |
| `location`           | text      | Event location (optional)                                    |
| `start_time`         | timestamp | Event start time                                             |
| `end_time`           | timestamp | Event end time                                               |
| `is_all_day`         | boolean   | Whether event spans full day(s)                              |
| `color`              | text      | Category color override (see Event Colors)                   |
| `sync_status`        | text      | 'synced' \| 'pending' \| 'conflict' \| 'error'               |
| `local_updated_at`   | timestamp | When event was modified locally                              |
| `remote_updated_at`  | timestamp | Google's last modified time                                  |
| `created_at`         | timestamp | When record was created                                      |
| `updated_at`         | timestamp | Last modification time                                       |

### event_participants

Junction table linking events to family members.

```typescript
export const eventParticipants = pgTable("event_participants", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  familyMemberId: text("family_member_id")
    .notNull()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  isOwner: boolean("is_owner").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

| Column             | Type      | Description                                |
| ------------------ | --------- | ------------------------------------------ |
| `id`               | text      | Primary key                                |
| `event_id`         | text      | FK to `events.id`                          |
| `family_member_id` | text      | FK to `family_members.id`                  |
| `is_owner`         | boolean   | Whether this member created/owns the event |
| `created_at`       | timestamp | When participant was added                 |

## Enums

### TEventColor

```typescript
type TEventColor = "blue" | "green" | "red" | "yellow" | "purple" | "orange";
```

### Event Colors

Events are color-coded by category:

| Color  | Use Cases                          |
| ------ | ---------------------------------- |
| Blue   | Sports, activities, outdoor events |
| Purple | Personal, gym, self-care           |
| Orange | Lessons, learning, education       |
| Green  | Family events, meals, gatherings   |
| Red    | Date nights, special occasions     |
| Yellow | Celebrations, birthdays, parties   |

### Google Color Mapping

Google Calendar uses numeric `colorId` (1-11). Map to closest TEventColor:

| Google colorId | Google Color | TEventColor |
| -------------- | ------------ | ----------- |
| 1              | Lavender     | purple      |
| 2              | Sage         | green       |
| 3              | Grape        | purple      |
| 4              | Flamingo     | red         |
| 5              | Banana       | yellow      |
| 6              | Tangerine    | orange      |
| 7              | Peacock      | blue        |
| 8              | Graphite     | blue        |
| 9              | Blueberry    | blue        |
| 10             | Basil        | green       |
| 11             | Tomato       | red         |

**Color Precedence:** Event `color` (if set) > mapped Google `colorId` > calendar default color

### All-Day Event Storage

All-day events from Google (which return `date` instead of `dateTime`) are stored as:

- `start_time`: 00:00:00 UTC on the start date
- `end_time`: 23:59:59 UTC on the end date
- `is_all_day`: true

Example: A Google all-day event on "2024-12-25" becomes:

- start_time: 2024-12-25T00:00:00Z
- end_time: 2024-12-25T23:59:59Z

### Read-Only Events

Events from read-only Google Calendars (where `google_calendars.access_role = 'reader'`) cannot be edited in the Planner. Determine editability via JOIN to `google_calendars` table.

### SyncStatus

```typescript
type SyncStatus = "synced" | "pending" | "conflict" | "error";
```

| Value      | Description                                    |
| ---------- | ---------------------------------------------- |
| `synced`   | Event matches Google state                     |
| `pending`  | Local changes not yet pushed to Google         |
| `conflict` | Both local and remote modified since last sync |
| `error`    | Sync failed (e.g., API error, rate limit)      |

## Relationships

```
┌─────────────────┐
│    families     │
├─────────────────┤
│ id            ◄─┼───────────────────┐
└─────────────────┘                   │
                                      │
┌─────────────────┐                   │
│ google_calendars│                   │
├─────────────────┤                   │
│ id            ◄─┼───────┐           │
└─────────────────┘       │           │
                          │           │
┌─────────────────────────┼───────────┼─────┐
│        events           │           │     │
├─────────────────────────┤           │     │
│ id                    ◄─┼───┐       │     │
│ family_id (FK)        ──┼───┼───────┼─────┘
│ google_calendar_id (FK)─┼───┼───────┘
│ google_event_id         │   │
│ title                   │   │
│ start_time, end_time    │   │
│ color                   │   │
│ sync_status             │   │
└─────────────────────────┘   │
                              │
┌─────────────────┐           │
│ family_members  │           │
├─────────────────┤           │
│ id            ◄─┼───┐       │
└─────────────────┘   │       │
                      │       │
┌─────────────────────┼───────┼─────┐
│ event_participants  │       │     │
├─────────────────────┤       │     │
│ id                  │       │     │
│ event_id (FK)     ──┼───────┼─────┘
│ family_member_id (FK)───────┘
│ is_owner            │
└─────────────────────┘
```

## Indexes

```sql
-- Fast lookup of events by family
CREATE INDEX idx_events_family_id ON events(family_id);

-- Fast lookup of events by date range
CREATE INDEX idx_events_start_time ON events(start_time);

-- Fast lookup of events needing sync
CREATE INDEX idx_events_sync_status ON events(sync_status)
WHERE sync_status != 'synced';

-- Fast lookup of participants by event
CREATE INDEX idx_event_participants_event_id ON event_participants(event_id);

-- Fast lookup of events by participant
CREATE INDEX idx_event_participants_member_id ON event_participants(family_member_id);

-- Unique constraint: one participation record per event per member
CREATE UNIQUE INDEX idx_event_participants_unique
ON event_participants(event_id, family_member_id);
```

## Example Queries

### Get events for a family in date range

```sql
SELECT
  e.*,
  gc.name AS calendar_name,
  gc.color AS calendar_color
FROM events e
LEFT JOIN google_calendars gc ON e.google_calendar_id = gc.id
WHERE e.family_id = 'family_123'
AND e.start_time >= '2024-01-01'
AND e.end_time <= '2024-01-31'
ORDER BY e.start_time;
```

### Get events for a specific family member

```sql
SELECT e.*
FROM events e
JOIN event_participants ep ON e.id = ep.event_id
WHERE ep.family_member_id = 'member_456'
AND e.start_time >= NOW()
ORDER BY e.start_time;
```

### Get all participants for an event

```sql
SELECT
  fm.id,
  fm.display_name,
  fm.avatar_color,
  u.name,
  u.image,
  ep.is_owner
FROM event_participants ep
JOIN family_members fm ON ep.family_member_id = fm.id
JOIN users u ON fm.user_id = u.id
WHERE ep.event_id = 'event_789'
ORDER BY ep.is_owner DESC, fm.display_name;
```

### Get events by color category

```sql
SELECT * FROM events
WHERE family_id = 'family_123'
AND color = 'green' -- Family events
AND start_time >= NOW()
ORDER BY start_time;
```

## TypeScript Interfaces (UI Layer)

For frontend components, use these interfaces:

```typescript
interface IEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startDate: string; // ISO 8601 format
  endDate: string; // ISO 8601 format
  isAllDay: boolean;
  color: TEventColor;
  participants: IEventParticipant[];
  calendarName?: string; // From google_calendars.name
  calendarColor?: string; // From google_calendars.color
  syncStatus: SyncStatus;
}

interface IEventParticipant {
  id: string;
  familyMemberId: string;
  displayName: string;
  avatarColor: string;
  isOwner: boolean;
}
```

## Data Sources

| Data              | Source              | Storage             | Refresh Rate |
| ----------------- | ------------------- | ------------------- | ------------ |
| Events            | Google Calendar API | PostgreSQL (cached) | Every 5 min  |
| Participants      | Local assignment    | PostgreSQL          | Immediate    |
| Calendar metadata | Google Calendar API | PostgreSQL          | On link      |

## State Management

The `CalendarProvider` context manages:

- Current view (today/day/week/month)
- Selected date
- Filtered events (by TanStack Query)
- User filter selection (participant filter)
- Color filter selection
- Settings (persisted to localStorage)

The `DndProvider` context manages:

- Drag state
- Drop target
- Pending confirmation dialog
