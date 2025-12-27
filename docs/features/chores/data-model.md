# Chores Data Model

## Chore Entity

```typescript
interface IChore {
  id: string;
  familyId: string; // Reference to owning family
  title: string;
  description: string | null;
  assignedToId: string | null; // Reference to familyMembers.id
  dueDate: string | null; // YYYY-MM-DD format
  dueTime: string | null; // HH:mm format
  recurrence: ChoreRecurrence;
  isUrgent: boolean; // Manual urgency flag
  status: ChoreStatus;
  starReward: number; // Stars earned on completion
  completedAt: Date | null;
  completedById: string | null; // Reference to familyMembers.id
  createdAt: Date;
  updatedAt: Date;
}

interface IChoreWithAssignee extends IChore {
  assignedTo: FamilyMemberWithUser | null;
  completedBy: FamilyMemberWithUser | null;
}

type ChoreRecurrence =
  | "once"
  | "daily"
  | "weekly"
  | "weekdays"
  | "weekends"
  | "monthly";

type ChoreStatus = "pending" | "completed" | "skipped";

interface FamilyMemberWithUser {
  id: string;
  familyId: string;
  userId: string;
  role: FamilyMemberRole;
  displayName: string | null;
  avatarColor: string | null;
  avatarSvg: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
}

type FamilyMemberRole =
  | "manager"
  | "participant"
  | "caregiver"
  | "device"
  | "child";
```

## Computed Properties

```typescript
type UrgencyStatus = "none" | "due-soon" | "urgent" | "overdue";

function getUrgencyStatus(chore: IChore): UrgencyStatus {
  if (chore.status !== "pending") return "none";
  if (chore.isUrgent) return "urgent";
  if (!chore.dueDate) return "none";

  const now = new Date();
  const due = combineDateAndTime(chore.dueDate, chore.dueTime);

  if (due < now) return "overdue";
  if (due < addHours(now, 4)) return "due-soon";

  return "none";
}
```

## Database Schema (Drizzle)

```typescript
export const chores = pgTable("chores", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  assignedToId: text("assigned_to_id").references(() => familyMembers.id, {
    onDelete: "set null",
  }),
  dueDate: date("due_date", { mode: "string" }),
  dueTime: text("due_time"), // HH:mm format
  recurrence: text("recurrence").notNull().default("once"), // once | daily | weekly | weekdays | weekends | monthly
  isUrgent: boolean("is_urgent").notNull().default(false),
  status: text("status").notNull().default("pending"), // pending | completed | skipped
  starReward: integer("star_reward").notNull().default(10),
  completedAt: timestamp("completed_at", { mode: "date" }),
  completedById: text("completed_by_id").references(() => familyMembers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

### Column Descriptions

| Column          | Type      | Nullable | Default   | Description                                      |
| --------------- | --------- | -------- | --------- | ------------------------------------------------ |
| id              | text      | No       | -         | Primary key (CUID2)                              |
| family_id       | text      | No       | -         | FK to families.id (cascade delete)               |
| title           | text      | No       | -         | Chore title                                      |
| description     | text      | Yes      | null      | Optional description                             |
| assigned_to_id  | text      | Yes      | null      | FK to family_members.id (set null on delete)     |
| due_date        | date      | Yes      | null      | Due date in YYYY-MM-DD format                    |
| due_time        | text      | Yes      | null      | Due time in HH:mm format                         |
| recurrence      | text      | No       | 'once'    | Recurrence pattern                               |
| is_urgent       | boolean   | No       | false     | Manual urgency flag                              |
| status          | text      | No       | 'pending' | Chore status                                     |
| star_reward     | integer   | No       | 10        | Stars awarded on completion                      |
| completed_at    | timestamp | Yes      | null      | Completion timestamp                             |
| completed_by_id | text      | Yes      | null      | FK to family_members.id (who marked it complete) |
| created_at      | timestamp | No       | now()     | Creation timestamp                               |
| updated_at      | timestamp | No       | now()     | Last update timestamp                            |

> **Note:** Assignment references (`assigned_to_id`, `completed_by_id`) point to `family_members(id)`, not `users(id)`. This allows assigning chores to family members (including child accounts and devices) rather than user accounts directly. See [Families Data Model](../families/data-model.md) for the family membership structure.

## API Endpoints

| Endpoint                                              | Method | Description                              |
| ----------------------------------------------------- | ------ | ---------------------------------------- |
| `/api/v1/families/:familyId/chores`                   | GET    | List chores with optional filters        |
| `/api/v1/families/:familyId/chores`                   | POST   | Create a new chore (manager only)        |
| `/api/v1/families/:familyId/chores/:choreId`          | GET    | Get a single chore by ID                 |
| `/api/v1/families/:familyId/chores/:choreId`          | PATCH  | Update a chore (manager only)            |
| `/api/v1/families/:familyId/chores/:choreId`          | DELETE | Delete a chore (manager only)            |
| `/api/v1/families/:familyId/chores/:choreId/complete` | POST   | Mark chore as complete                   |
| `/api/v1/families/:familyId/chores/:choreId/complete` | DELETE | Undo chore completion                    |
| `/api/v1/families/:familyId/chores/progress`          | GET    | Get daily progress (optional date param) |

### Query Parameters (GET /chores)

| Parameter     | Type     | Description                                      |
| ------------- | -------- | ------------------------------------------------ |
| status        | string   | Filter by status: pending, completed, skipped    |
| isUrgent      | boolean  | Filter by urgency flag                           |
| startDate     | string   | Filter chores due on or after date (YYYY-MM-DD)  |
| endDate       | string   | Filter chores due on or before date (YYYY-MM-DD) |
| assignedToIds | string[] | Filter by assigned family member IDs             |

### Authorization

- **GET endpoints**: Require authenticated family member
- **POST/PATCH/DELETE chores**: Require manager role
- **POST/DELETE complete**: Require authenticated family member (any role can complete)

## Data Sources

| Data     | Source     | Refresh Rate               |
| -------- | ---------- | -------------------------- |
| Chores   | PostgreSQL | On mount, after completion |
| Users    | PostgreSQL | On mount                   |
| Streak   | PostgreSQL | After completion           |
| Progress | Computed   | Real-time                  |

## Star Rewards

| Chore Type            | Stars |
| --------------------- | ----- |
| Daily routine         | 10    |
| Weekly task           | 25    |
| Urgent/time-sensitive | 15    |
| Special/bonus         | 50    |

_Note: Star values are configured in the administration interface. Stars can be redeemed in the [Reward Store](../reward-store/data-model.md)._
