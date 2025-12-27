# Reward Store Data Model

## Entity Overview

The Reward Store consists of five main entities:

1. **Rewards** - Family marketplace items that can be redeemed
2. **Redemptions** - Records of reward claims by members
3. **Star Transactions** - Ledger of all star earning/spending events
4. **Member Star Balances** - Cached balance for fast reads
5. **Member Primary Goals** - Each member's current goal reward

## Database Schema (Drizzle)

### Rewards Table

```typescript
export const rewards = pgTable("rewards", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  emoji: text("emoji").notNull(),
  starCost: integer("star_cost").notNull(),
  limitType: text("limit_type").notNull().default("none"), // 'none' | 'daily' | 'weekly' | 'monthly' | 'once'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

| Column      | Type      | Description                                |
| ----------- | --------- | ------------------------------------------ |
| id          | text      | Primary key (CUID2)                        |
| familyId    | text      | Foreign key to families                    |
| title       | text      | Display name (max 100 chars)               |
| description | text      | Optional description (max 500 chars)       |
| emoji       | text      | Emoji icon for the reward                  |
| starCost    | integer   | Stars required to redeem (1-100,000)       |
| limitType   | text      | Redemption limit period (enum)             |
| isActive    | boolean   | Whether reward is available for redemption |
| createdAt   | timestamp | Creation timestamp                         |
| updatedAt   | timestamp | Last modification timestamp                |

### Redemptions Table

```typescript
export const redemptions = pgTable("redemptions", {
  id: text("id").primaryKey(),
  rewardId: text("reward_id")
    .notNull()
    .references(() => rewards.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  starCost: integer("star_cost").notNull(), // Snapshot of cost at redemption time
  redeemedAt: timestamp("redeemed_at", { mode: "date" }).notNull().defaultNow(),
});
```

| Column     | Type      | Description                      |
| ---------- | --------- | -------------------------------- |
| id         | text      | Primary key (CUID2)              |
| rewardId   | text      | Foreign key to rewards           |
| memberId   | text      | Foreign key to familyMembers     |
| starCost   | integer   | Stars spent (snapshot at redeem) |
| redeemedAt | timestamp | When redeemed                    |

### Star Transactions Table

```typescript
export const starTransactions = pgTable("star_transactions", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  type: text("type").notNull(), // 'reward_chart' | 'chore' | 'bonus' | 'timer' | 'redemption'
  referenceId: text("reference_id"), // FK to source (taskId, choreId, rewardId, timerId)
  description: text("description").notNull(),
  awardedById: text("awarded_by_id").references(() => familyMembers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});
```

| Column      | Type      | Description                               |
| ----------- | --------- | ----------------------------------------- |
| id          | text      | Primary key (CUID2)                       |
| familyId    | text      | Foreign key to families                   |
| memberId    | text      | Foreign key to familyMembers (recipient)  |
| amount      | integer   | Positive (earned) or negative (spent)     |
| type        | text      | Transaction source type (enum)            |
| referenceId | text      | Optional FK to source entity              |
| description | text      | Human-readable description                |
| awardedById | text      | Optional FK to member who awarded (bonus) |
| createdAt   | timestamp | Transaction timestamp                     |

**Star Transaction Types:**

| Type         | Amount   | Description                       |
| ------------ | -------- | --------------------------------- |
| reward_chart | Positive | Stars from completing chart tasks |
| chore        | Positive | Stars from completing chores      |
| bonus        | Positive | Manual bonus from manager         |
| timer        | Positive | Stars from completing timers      |
| redemption   | Negative | Stars spent on reward redemption  |

### Member Star Balances Table

```typescript
export const memberStarBalances = pgTable("member_star_balances", {
  memberId: text("member_id")
    .primaryKey()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
```

| Column    | Type      | Description                      |
| --------- | --------- | -------------------------------- |
| memberId  | text      | Primary key, FK to familyMembers |
| balance   | integer   | Cached current star balance      |
| updatedAt | timestamp | Last balance update timestamp    |

> **Note:** This table caches the sum of all transactions for fast reads. Updated transactionally with each star transaction.

### Member Primary Goals Table

```typescript
export const memberPrimaryGoals = pgTable("member_primary_goals", {
  memberId: text("member_id")
    .primaryKey()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  rewardId: text("reward_id")
    .notNull()
    .references(() => rewards.id, { onDelete: "cascade" }),
  setAt: timestamp("set_at", { mode: "date" }).notNull().defaultNow(),
});
```

| Column   | Type      | Description                      |
| -------- | --------- | -------------------------------- |
| memberId | text      | Primary key, FK to familyMembers |
| rewardId | text      | Foreign key to rewards           |
| setAt    | timestamp | When the goal was set            |

---

## TypeScript Interfaces

```typescript
// Base reward entity
interface IReward {
  id: string;
  familyId: string;
  title: string;
  description: string | null;
  emoji: string;
  starCost: number;
  limitType: LimitType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Limit type enum
type LimitType = "none" | "daily" | "weekly" | "monthly" | "once";

// Reward with redemption status (for UI)
interface IRewardWithStatus extends IReward {
  canRedeem: boolean;
  reason?: "insufficient_stars" | "limit_reached";
  starsNeeded?: number;
  nextAvailable?: Date;
}

// Redemption record
interface IRedemption {
  id: string;
  rewardId: string;
  memberId: string;
  starCost: number;
  redeemedAt: Date;
  reward?: { title: string; emoji: string };
}

// Star transaction
interface IStarTransaction {
  id: string;
  familyId: string;
  memberId: string;
  amount: number;
  type: StarTransactionType;
  referenceId: string | null;
  description: string;
  awardedById: string | null;
  createdAt: Date;
}

// Transaction type enum
type StarTransactionType =
  | "reward_chart"
  | "chore"
  | "bonus"
  | "timer"
  | "redemption";

// Input types
interface CreateRewardInput {
  title: string;
  description?: string | null;
  emoji: string;
  starCost: number;
  limitType?: LimitType;
}

interface UpdateRewardInput extends Partial<CreateRewardInput> {
  isActive?: boolean;
}

interface AddStarsInput {
  memberId: string;
  amount: number;
  type: "reward_chart" | "chore" | "bonus" | "timer";
  referenceId?: string;
  description: string;
  awardedById?: string;
}

interface GrantBonusStarsInput {
  amount: number; // 1-100 per bonus
  description: string; // Reason for bonus
}
```

---

## Data Relationships

```
families
    ├── rewards[]
    │       └── redemptions[]
    │               └── familyMembers (memberId)
    │
    ├── familyMembers[]
    │       ├── memberStarBalances (1:1)
    │       ├── memberPrimaryGoals (1:1)
    │       │       └── rewards (rewardId)
    │       └── starTransactions[]
    │               └── familyMembers (awardedById, optional)
    │
    └── starTransactions[]
            └── familyMembers (memberId)
```

---

## API Endpoints

### Rewards

| Method | Endpoint                                              | Description         | Auth          |
| ------ | ----------------------------------------------------- | ------------------- | ------------- |
| GET    | `/api/v1/families/:familyId/rewards`                  | List family rewards | Member        |
| POST   | `/api/v1/families/:familyId/rewards`                  | Create reward       | Manager       |
| GET    | `/api/v1/families/:familyId/rewards/:rewardId`        | Get single reward   | Member        |
| PUT    | `/api/v1/families/:familyId/rewards/:rewardId`        | Update reward       | Manager       |
| DELETE | `/api/v1/families/:familyId/rewards/:rewardId`        | Delete reward       | Manager       |
| POST   | `/api/v1/families/:familyId/rewards/:rewardId/redeem` | Redeem reward       | Member/Device |

**GET /rewards Query Parameters:**

- `includeInactive=true` - Include inactive rewards (default: false)

**POST /redeem Request Body (optional):**

```json
{
  "memberId": "string" // For managers/devices redeeming on behalf of a child
}
```

### Stars

| Method | Endpoint                                                   | Description           | Auth    |
| ------ | ---------------------------------------------------------- | --------------------- | ------- |
| GET    | `/api/v1/families/:familyId/members/:memberId/stars`       | Get balance + history | Member  |
| POST   | `/api/v1/families/:familyId/members/:memberId/stars/bonus` | Award bonus stars     | Manager |

**GET /stars Query Parameters:**

- `includeHistory=true` - Include transaction history
- `limit=50` - Max transactions (1-100)
- `offset=0` - Pagination offset
- `type=bonus` - Filter by transaction type

**POST /bonus Request Body:**

```json
{
  "amount": 10,
  "description": "Helped with extra cleaning"
}
```

### Redemptions

| Method | Endpoint                                                   | Description            | Auth   |
| ------ | ---------------------------------------------------------- | ---------------------- | ------ |
| GET    | `/api/v1/families/:familyId/members/:memberId/redemptions` | Get redemption history | Member |

**Query Parameters:**

- `limit=50` - Max redemptions (1-100)
- `offset=0` - Pagination offset

### Primary Goal

| Method | Endpoint                                                    | Description         | Auth           |
| ------ | ----------------------------------------------------------- | ------------------- | -------------- |
| GET    | `/api/v1/families/:familyId/members/:memberId/primary-goal` | Get member's goal   | Member         |
| PUT    | `/api/v1/families/:familyId/members/:memberId/primary-goal` | Set member's goal   | Member/Manager |
| DELETE | `/api/v1/families/:familyId/members/:memberId/primary-goal` | Clear member's goal | Member/Manager |

**PUT Request Body:**

```json
{
  "rewardId": "string"
}
```

---

## Response Examples

### GET /rewards

```json
{
  "rewards": [
    {
      "id": "clx1abc123",
      "familyId": "clx0fam456",
      "title": "Movie Night Choice",
      "description": "Pick the movie for family night!",
      "emoji": "🎬",
      "starCost": 500,
      "limitType": "weekly",
      "isActive": true,
      "createdAt": "2024-12-20T10:00:00Z",
      "updatedAt": "2024-12-20T10:00:00Z"
    }
  ]
}
```

### POST /redeem

**Success:**

```json
{
  "success": true,
  "redemption": {
    "id": "clx2red789",
    "rewardId": "clx1abc123",
    "memberId": "clx0mem321",
    "starCost": 500,
    "redeemedAt": "2024-12-22T10:30:00Z"
  },
  "newBalance": 750
}
```

**Error (insufficient stars):**

```json
{
  "error": "BAD_REQUEST",
  "reason": "insufficient_stars",
  "message": "You need more stars to redeem this reward"
}
```

**Error (limit reached):**

```json
{
  "error": "BAD_REQUEST",
  "reason": "limit_reached",
  "message": "Available again 12/29/2024"
}
```

### GET /stars?includeHistory=true

```json
{
  "balance": 1250,
  "history": [
    {
      "id": "clx3txn111",
      "familyId": "clx0fam456",
      "memberId": "clx0mem321",
      "amount": 10,
      "type": "chore",
      "referenceId": "clx3chr222",
      "description": "Made bed",
      "awardedById": null,
      "createdAt": "2024-12-22T08:00:00Z"
    },
    {
      "id": "clx3txn112",
      "amount": -500,
      "type": "redemption",
      "referenceId": "clx1abc123",
      "description": "Movie Night Choice",
      "createdAt": "2024-12-22T10:30:00Z"
    }
  ]
}
```

---

## Data Sources

| Data                | Source                            | Update Trigger                  |
| ------------------- | --------------------------------- | ------------------------------- |
| Star Balance        | memberStarBalances (cached)       | Any star transaction            |
| Transaction History | starTransactions                  | Earn/spend events               |
| Redemption History  | redemptions                       | Reward redemption               |
| Weekly Delta        | Computed from recent transactions | Client-side calculation         |
| Reward Availability | Computed from balance + limits    | Balance change, period rollover |

---

## Real-Time Updates

Star balance changes are broadcast via Pusher:

**Channel:** `private-family-{familyId}`

**Event:** `stars:updated`

```json
{
  "memberId": "clx0mem321",
  "newBalance": 1250
}
```
