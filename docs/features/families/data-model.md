# Families Data Model

## Database Schema

### families

Groups users into household units.

```typescript
export const families = pgTable("families", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

| Column       | Type      | Description                      |
| ------------ | --------- | -------------------------------- |
| `id`         | text      | Primary key (UUID)               |
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
  role: text("role").notNull(), // 'manager' | 'participant' | 'caregiver' | 'device' | 'child'
  displayName: text("display_name"),
  avatarColor: text("avatar_color"),
  avatarSvg: text("avatar_svg"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

| Column         | Type      | Description                         |
| -------------- | --------- | ----------------------------------- |
| `id`           | text      | Primary key (UUID)                  |
| `family_id`    | text      | FK to `families.id`                 |
| `user_id`      | text      | FK to `users.id` (Better-Auth)      |
| `role`         | text      | Member role (see FamilyMemberRole)  |
| `display_name` | text      | Optional kid-friendly name override |
| `avatar_color` | text      | Color for calendar identification   |
| `avatar_svg`   | text      | Custom SVG avatar (sanitized)       |
| `created_at`   | timestamp | When member joined                  |

### family_invites

Shareable invitation links for joining families.

```typescript
export const familyInvites = pgTable("family_invites", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

| Column          | Type      | Description                            |
| --------------- | --------- | -------------------------------------- |
| `id`            | text      | Primary key (UUID)                     |
| `family_id`     | text      | FK to `families.id`                    |
| `token`         | text      | Unique invite token (for URL)          |
| `created_by_id` | text      | FK to `users.id` (manager who created) |
| `expires_at`    | timestamp | Optional expiration date               |
| `max_uses`      | integer   | Optional maximum usage limit           |
| `use_count`     | integer   | Number of times invite has been used   |
| `created_at`    | timestamp | When invite was created                |

### device_pairing_codes

Short-lived codes for pairing wall displays and tablets.

```typescript
export const devicePairingCodes = pgTable("device_pairing_codes", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  deviceName: text("device_name").notNull(),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

| Column          | Type      | Description                            |
| --------------- | --------- | -------------------------------------- |
| `id`            | text      | Primary key (UUID)                     |
| `family_id`     | text      | FK to `families.id`                    |
| `code`          | text      | Unique pairing code                    |
| `device_name`   | text      | Name for the device                    |
| `created_by_id` | text      | FK to `users.id` (manager who created) |
| `expires_at`    | timestamp | When code expires                      |
| `used_at`       | timestamp | When code was used (null if unused)    |
| `attempts`      | integer   | Number of pairing attempts             |
| `created_at`    | timestamp | When code was created                  |

### child_upgrade_tokens

One-time tokens for linking child profiles to real accounts.

```typescript
export const childUpgradeTokens = pgTable(
  "child_upgrade_tokens",
  {
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
  },
  (table) => [
    index("child_upgrade_tokens_child_user_id_idx").on(table.childUserId),
  ]
);
```

| Column          | Type      | Description                            |
| --------------- | --------- | -------------------------------------- |
| `id`            | text      | Primary key (UUID)                     |
| `child_user_id` | text      | FK to `users.id` (the child account)   |
| `token`         | text      | Unique upgrade token                   |
| `created_by_id` | text      | FK to `users.id` (manager who created) |
| `expires_at`    | timestamp | When token expires (24 hours)          |
| `used_at`       | timestamp | When token was used (null if unused)   |
| `created_at`    | timestamp | When token was created                 |

### member_star_balances

Cached star balance for fast reads.

```typescript
export const memberStarBalances = pgTable("member_star_balances", {
  memberId: text("member_id")
    .primaryKey()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

| Column       | Type      | Description                   |
| ------------ | --------- | ----------------------------- |
| `member_id`  | text      | PK, FK to `family_members.id` |
| `balance`    | integer   | Current star balance          |
| `updated_at` | timestamp | Last balance update           |

## Enums

### FamilyMemberRole

```typescript
type FamilyMemberRole =
  | "manager"
  | "participant"
  | "caregiver"
  | "device"
  | "child";
```

| Value         | Description           | Calendar  | Events        | Settings    | Can Earn Stars |
| ------------- | --------------------- | --------- | ------------- | ----------- | -------------- |
| `manager`     | Full admin access     | Full CRUD | Full CRUD     | Full access | No             |
| `participant` | Adult family member   | View only | Mark complete | View only   | Yes            |
| `caregiver`   | View-only access      | View only | View only     | None        | No             |
| `device`      | Wall display/tablet   | View only | View only     | None        | No             |
| `child`       | Managed child profile | View only | Mark complete | None        | Yes            |

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
+-------------------+
|      users        |  (Better-Auth)
+-------------------+
| id              <-+-------------+---------------+
| name              |             |               |
| email             |             |               |
| type              |             |               |  ('human' | 'device' | 'child')
+-------------------+             |               |
                                  |               |
+-------------------+             |               |
|     families      |             |               |
+-------------------+             |               |
| id              <-+---+         |               |
| name              |   |         |               |
+-------------------+   |         |               |
                        |         |               |
+-------------------+---+---------+               |
|  family_members   |                             |
+-------------------+                             |
| id                |                             |
| family_id (FK)  --+                             |
| user_id (FK)    --+-----------------------------+
| role              |
| display_name      |
| avatar_color      |
| avatar_svg        |
+-------------------+
         |
         | (referenced by)
         v
+-------------------+
|member_star_balances|
+-------------------+
| member_id (PK,FK) |
| balance           |
+-------------------+

+-------------------+
|  family_invites   |
+-------------------+
| id                |
| family_id (FK)  --+-> families.id
| token             |
| created_by_id   --+-> users.id
| expires_at        |
| max_uses          |
| use_count         |
+-------------------+

+-------------------+
|device_pairing_codes|
+-------------------+
| id                |
| family_id (FK)  --+-> families.id
| code              |
| device_name       |
| created_by_id   --+-> users.id
| expires_at        |
| used_at           |
| attempts          |
+-------------------+

+-------------------+
|child_upgrade_tokens|
+-------------------+
| id                |
| child_user_id   --+-> users.id
| token             |
| created_by_id   --+-> users.id
| expires_at        |
| used_at           |
+-------------------+
```

## Constraints

- A user can belong to multiple families (e.g., shared custody)
- A family must have at least one `manager`
- `user_id` + `family_id` should be unique (one membership per family)
- Invite tokens must be unique
- Device pairing codes must be unique
- Child upgrade tokens must be unique
- Maximum 10 children per family (enforced at application level)

## Example Queries

### Get all human members of a family (excludes devices)

```sql
SELECT
  fm.id,
  fm.role,
  fm.display_name,
  fm.avatar_color,
  fm.avatar_svg,
  u.name,
  u.email,
  u.image
FROM family_members fm
JOIN users u ON fm.user_id = u.id
WHERE fm.family_id = 'family_123'
  AND fm.role != 'device'
ORDER BY
  CASE fm.role
    WHEN 'manager' THEN 1
    WHEN 'participant' THEN 2
    WHEN 'child' THEN 3
    WHEN 'caregiver' THEN 4
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

### Get active invites for a family

```sql
SELECT *
FROM family_invites
WHERE family_id = 'family_123'
  AND (expires_at IS NULL OR expires_at > NOW())
  AND (max_uses IS NULL OR use_count < max_uses)
ORDER BY created_at;
```

### Get children in a family

```sql
SELECT
  fm.*,
  u.name,
  u.email
FROM family_members fm
JOIN users u ON fm.user_id = u.id
WHERE fm.family_id = 'family_123'
  AND fm.role = 'child';
```

### Get valid upgrade token

```sql
SELECT *
FROM child_upgrade_tokens
WHERE token = 'token_abc'
  AND expires_at > NOW()
  AND used_at IS NULL;
```

### Get member star balance

```sql
SELECT balance
FROM member_star_balances
WHERE member_id = 'member_123';
```

## Type Exports

```typescript
export type Family = typeof families.$inferSelect;
export type NewFamily = typeof families.$inferInsert;
export type FamilyMember = typeof familyMembers.$inferSelect;
export type NewFamilyMember = typeof familyMembers.$inferInsert;
export type FamilyInvite = typeof familyInvites.$inferSelect;
export type NewFamilyInvite = typeof familyInvites.$inferInsert;
export type DevicePairingCode = typeof devicePairingCodes.$inferSelect;
export type NewDevicePairingCode = typeof devicePairingCodes.$inferInsert;
export type ChildUpgradeToken = typeof childUpgradeTokens.$inferSelect;
export type NewChildUpgradeToken = typeof childUpgradeTokens.$inferInsert;
export type MemberStarBalance = typeof memberStarBalances.$inferSelect;
export type NewMemberStarBalance = typeof memberStarBalances.$inferInsert;
```
