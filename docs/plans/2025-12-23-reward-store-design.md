# Reward Store Design

## Overview

The Reward Store is a marketplace where children spend earned stars on rewards configured by parents. It integrates with the star-service for balance management and transaction logging.

## Decisions

| Aspect         | Decision                                               |
| -------------- | ------------------------------------------------------ |
| Levels         | Skip for now (add later)                               |
| Wishlist       | Skip (primary goal serves this purpose)                |
| Page structure | Separate `/rewards` page (reward-chart stays separate) |
| Images         | Predefined icons/emojis (like reward chart tasks)      |
| Limits         | Full support (none, daily, weekly, monthly, once)      |
| Tabs           | Available + Redeemed (no Wishlist tab)                 |

## Data Model

### rewards table

| Column        | Type      | Description                                  |
| ------------- | --------- | -------------------------------------------- |
| `id`          | text      | Primary key (nanoid)                         |
| `familyId`    | text      | FK to families                               |
| `title`       | text      | Display name (max 100)                       |
| `description` | text      | Details (max 500, nullable)                  |
| `emoji`       | text      | Emoji for display                            |
| `starCost`    | integer   | Stars required to redeem                     |
| `limitType`   | enum      | `none`, `daily`, `weekly`, `monthly`, `once` |
| `isActive`    | boolean   | Whether reward is available                  |
| `createdAt`   | timestamp | Creation date                                |
| `updatedAt`   | timestamp | Last modification                            |

### redemptions table

| Column       | Type      | Description            |
| ------------ | --------- | ---------------------- |
| `id`         | text      | Primary key            |
| `rewardId`   | text      | FK to rewards          |
| `memberId`   | text      | FK to familyMembers    |
| `starCost`   | integer   | Stars spent (snapshot) |
| `redeemedAt` | timestamp | When redeemed          |

### Existing tables (from star-service)

- `star_transactions` - Transaction ledger (already has `redemption` type)
- `member_star_balances` - Cached balances
- `member_primary_goals` - Primary goal per child (FK to rewards)

## Service Layer

### reward-store-service.ts

```typescript
// Reward CRUD
getRewardsForFamily(familyId: string): Promise<Reward[]>
getRewardById(rewardId: string): Promise<Reward | null>
createReward(familyId: string, input: CreateRewardInput): Promise<Reward>
updateReward(rewardId: string, input: UpdateRewardInput): Promise<Reward>
deleteReward(rewardId: string): Promise<void>

// Redemption
redeemReward(memberId: string, rewardId: string): Promise<{ redemption: Redemption; newBalance: number }>
canRedeem(memberId: string, rewardId: string): Promise<{ canRedeem: boolean; reason?: string; nextAvailable?: Date }>
getRedemptionsForMember(memberId: string, options?: { limit?: number }): Promise<Redemption[]>

// Primary Goal (uses member_primary_goals table)
setPrimaryGoal(memberId: string, rewardId: string): Promise<void>
clearPrimaryGoal(memberId: string): Promise<void>
getPrimaryGoal(memberId: string): Promise<Reward | null>
```

### Limit Checking Logic

```typescript
async canRedeem(memberId: string, rewardId: string) {
  const reward = await getRewardById(rewardId)
  const balance = await starService.getBalance(memberId)

  // Check balance
  if (balance < reward.starCost) {
    return { canRedeem: false, reason: 'insufficient_stars' }
  }

  // Check limits
  if (reward.limitType !== 'none') {
    const periodStart = getPeriodStart(reward.limitType) // daily/weekly/monthly/once
    const redemptions = await getRedemptionsInPeriod(memberId, rewardId, periodStart)
    if (redemptions.length > 0) {
      return {
        canRedeem: false,
        reason: 'limit_reached',
        nextAvailable: getNextPeriodStart(reward.limitType)
      }
    }
  }

  return { canRedeem: true }
}

async redeemReward(memberId: string, rewardId: string) {
  const { canRedeem, reason } = await this.canRedeem(memberId, rewardId)
  if (!canRedeem) {
    throw new RedemptionError(reason)
  }

  const reward = await getRewardById(rewardId)

  // Deduct stars via star-service (creates transaction)
  const { newBalance } = await starService.removeStars({
    memberId,
    amount: reward.starCost,
    type: 'redemption',
    referenceId: rewardId,
    description: reward.title
  })

  // Record redemption
  const redemption = await createRedemption(memberId, rewardId, reward.starCost)

  return { redemption, newBalance }
}
```

## API Routes

| Method | Route                                                         | Description                   |
| ------ | ------------------------------------------------------------- | ----------------------------- |
| GET    | `/api/v1/families/[familyId]/rewards`                         | List rewards                  |
| POST   | `/api/v1/families/[familyId]/rewards`                         | Create reward (managers only) |
| GET    | `/api/v1/families/[familyId]/rewards/[rewardId]`              | Get single reward             |
| PUT    | `/api/v1/families/[familyId]/rewards/[rewardId]`              | Update reward (managers only) |
| DELETE | `/api/v1/families/[familyId]/rewards/[rewardId]`              | Delete reward (managers only) |
| POST   | `/api/v1/families/[familyId]/rewards/[rewardId]/redeem`       | Redeem reward                 |
| GET    | `/api/v1/families/[familyId]/members/[memberId]/redemptions`  | Redemption history            |
| PUT    | `/api/v1/families/[familyId]/members/[memberId]/primary-goal` | Set primary goal              |
| DELETE | `/api/v1/families/[familyId]/members/[memberId]/primary-goal` | Clear primary goal            |

## UI Components

### Page: `/rewards`

**Layout (Desktop):**

```
+------------------------------------------------------------------+
| Header: Greeting + Star Balance Card                              |
+----------------------------------------------+-------------------+
| Rewards Marketplace (2/3)                    | Sidebar (1/3)     |
| - Filter tabs (Available | Redeemed)         | - Weekly Chart    |
| - Reward cards grid (2 columns)              | - Recent Activity |
+----------------------------------------------+-------------------+
```

**Layout (Mobile):** Single column, sidebar sections below marketplace.

### Components

**StarBalanceCard:**

- Shows current balance from `starService.getBalance()`
- Shows weekly delta (calculated from recent transactions)
- Primary color star icon

**RewardCard:**

```
+-----------------------------------+
| [Emoji]                   [Badge] |
+-----------------------------------+
| Title                             |
| Description (2 lines max)         |
|                                   |
| ★ 500            [Redeem Button]  |
+-----------------------------------+
```

**Card States:**
| State | Emoji | Button | Star Cost |
|-------|-------|--------|-----------|
| Affordable | Normal | Primary "Redeem" | Primary color |
| Unaffordable | Grayscale | Disabled "Need X more" | Muted |
| Limit reached | Grayscale | Disabled "Available in X" | Muted |

**RedemptionConfirmDialog (AlertDialog):**

- Shows reward title and emoji
- Shows cost and balance before/after
- "Cancel" and "Redeem Now" buttons

**WeeklyEarningsChart:**

- Bar chart showing daily star earnings
- Data from `starService.getHistory()` aggregated by day

**RecentActivityFeed:**

- List of recent transactions from `starService.getHistory()`
- Shows +/- amounts with icons (check for earned, shopping_bag for spent)

### Interaction Modes

**Wall Display (kids):**

- View rewards, redeem, view history
- No create/edit/delete

**Management (parents):**

- Full CRUD on rewards
- Award bonus stars
- View all family members

## Validation Schemas

```typescript
// Create/Update reward
const rewardSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  emoji: z.string().min(1),
  starCost: z.number().int().min(1).max(100000),
  limitType: z.enum(["none", "daily", "weekly", "monthly", "once"]),
});

// Redemption (just rewardId in URL, no body needed)
```

## Integration with Star Service

The reward store integrates with the star-service we built:

1. **Balance checks:** `starService.getBalance(memberId)`
2. **Redemption:** `starService.removeStars({ type: 'redemption', ... })`
3. **History:** `starService.getHistory(memberId)` for activity feed
4. **Primary goal:** Uses `member_primary_goals` table (already created)

## Error Handling

| Error              | HTTP Status | Message                            |
| ------------------ | ----------- | ---------------------------------- |
| Insufficient stars | 400         | "You need X more stars"            |
| Limit reached      | 400         | "Available again in X days"        |
| Reward not found   | 404         | "Reward not found"                 |
| Not authorized     | 403         | "Only managers can create rewards" |

## Future Enhancements (Not in Scope)

- Level system with badges
- Wishlist functionality
- Image uploads for rewards
- Reward categories/tags
- Family-wide goals
