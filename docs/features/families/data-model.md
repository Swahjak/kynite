# Families Data Model

## Database Schema

### families

Groups users into household units.

```typescript
export const families = pgTable("families", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

| Column       | Type      | Description                      |
| ------------ | --------- | -------------------------------- |
| `id`         | text      | Primary key (CUID or UUID)       |
| `name`       | text      | Family name (e.g., "The Smiths") |
| `created_at` | timestamp | When family was created          |
| `updated_at` | timestamp | Last modification time           |

### family_members

Junction table linking users to families with roles.

```typescript
export const familyMembers = pgTable("family_members", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'manager' | 'participant' | 'caregiver'
  displayName: text("display_name"),
  avatarColor: text("avatar_color"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

| Column         | Type      | Description                         |
| -------------- | --------- | ----------------------------------- |
| `id`           | text      | Primary key                         |
| `family_id`    | text      | FK to `families.id`                 |
| `user_id`      | text      | FK to `users.id` (Better-Auth)      |
| `role`         | text      | Member role (see below)             |
| `display_name` | text      | Optional kid-friendly name override |
| `avatar_color` | text      | Color for calendar identification   |
| `created_at`   | timestamp | When member joined                  |

## Enums

### FamilyMemberRole

```typescript
type FamilyMemberRole = "manager" | "participant" | "caregiver";
```

| Value         | Description       | Calendar  | Events        | Settings    |
| ------------- | ----------------- | --------- | ------------- | ----------- |
| `manager`     | Full admin access | Full CRUD | Full CRUD     | Full access |
| `participant` | Tracked member    | View only | Mark complete | View only   |
| `caregiver`   | View-only access  | View only | View only     | None        |

### AvatarColor

```typescript
type AvatarColor =
  | "blue"
  | "green"
  | "red"
  | "yellow"
  | "purple"
  | "orange"
  | "pink"
  | "teal";
```

Used for visual identification in calendar views.

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
┌─────────────────┐         │
│    families     │         │
├─────────────────┤         │
│ id            ◄─┼───┐     │
│ name            │   │     │
└─────────────────┘   │     │
                      │     │
┌─────────────────────┼─────┼─────┐
│   family_members    │     │     │
├─────────────────────┤     │     │
│ id                  │     │     │
│ family_id (FK)    ──┼─────┘     │
│ user_id (FK)      ──┼───────────┘
│ role                │
│ display_name        │
│ avatar_color        │
└─────────────────────┘
```

## Constraints

- A user can belong to multiple families (e.g., shared custody)
- A family must have at least one `manager`
- `user_id` + `family_id` should be unique (one membership per family)

## Example Queries

### Get all members of a family

```sql
SELECT
  fm.id,
  fm.role,
  fm.display_name,
  fm.avatar_color,
  u.name,
  u.email,
  u.image
FROM family_members fm
JOIN users u ON fm.user_id = u.id
WHERE fm.family_id = 'family_123'
ORDER BY
  CASE fm.role
    WHEN 'manager' THEN 1
    WHEN 'participant' THEN 2
    WHEN 'caregiver' THEN 3
  END;
```

### Get all families for a user

```sql
SELECT
  f.id,
  f.name,
  fm.role
FROM families f
JOIN family_members fm ON f.id = fm.family_id
WHERE fm.user_id = 'user_456';
```

### Check if user is manager of family

```sql
SELECT EXISTS (
  SELECT 1 FROM family_members
  WHERE family_id = 'family_123'
  AND user_id = 'user_456'
  AND role = 'manager'
);
```
