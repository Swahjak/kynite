# Star Service Design

## Overview

Extract the reward/star system into a centralized service that provides a unified star economy with full traceability. All star sources (reward chart tasks, chores, parent bonuses) feed into a single balance per child, with complete audit trail of when/where stars were earned and whether they were consumed.

## Requirements

| Aspect           | Decision                                          |
| ---------------- | ------------------------------------------------- |
| **Scope**        | Full star economy with audit trail                |
| **Sources**      | Reward chart tasks + Chores + Parent bonuses      |
| **Balance**      | Single unified balance per child                  |
| **Primary goal** | Display/motivational only, shown across app       |
| **Redemption**   | Always manual, any reward (not just primary goal) |
| **Audit trail**  | Full context (who, what, when, awarded_by)        |
| **Chart goals**  | Merge into reward store as "Goal" type items      |

## Architecture

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Reward Chart│  │   Chores    │  │   Bonuses   │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        ▼
              ┌─────────────────┐
              │  Star Service   │
              │  - addStars()   │
              │  - removeStars()│
              │  - getBalance() │
              │  - getHistory() │
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │star_transactions│
              └─────────────────┘
```

## Data Model

### star_transactions

The central ledger for all star activity.

| Column        | Type          | Description                                          |
| ------------- | ------------- | ---------------------------------------------------- |
| `id`          | text (nanoid) | Primary key                                          |
| `familyId`    | text          | FK to families                                       |
| `memberId`    | text          | FK to familyMembers (the child)                      |
| `amount`      | integer       | Positive = earned, negative = spent                  |
| `type`        | enum          | `reward_chart`, `chore`, `bonus`, `redemption`       |
| `referenceId` | text          | FK to source (taskId, choreId, rewardId, etc.)       |
| `description` | text          | Human-readable: "Brushed teeth (AM)"                 |
| `awardedById` | text          | FK to familyMembers (parent, for bonuses) — nullable |
| `createdAt`   | timestamp     | When transaction occurred                            |

### member_star_balances

Cached balance for fast reads (optional optimization).

| Column      | Type      | Description             |
| ----------- | --------- | ----------------------- |
| `memberId`  | text      | PK, FK to familyMembers |
| `balance`   | integer   | Current star count      |
| `updatedAt` | timestamp | Last recalculated       |

### member_primary_goals

Tracks each child's "working toward" goal.

| Column     | Type      | Description                |
| ---------- | --------- | -------------------------- |
| `memberId` | text      | PK, FK to familyMembers    |
| `rewardId` | text      | FK to rewards (store item) |
| `setAt`    | timestamp | When goal was pinned       |

## Service API

**Location:** `src/server/services/star-service.ts`

### Core Operations

```typescript
// Credit stars (earning)
addStars(input: {
  memberId: string
  amount: number
  type: 'reward_chart' | 'chore' | 'bonus'
  referenceId?: string
  description: string
  awardedById?: string
}): Promise<{ transaction: StarTransaction; newBalance: number }>

// Debit stars (spending)
removeStars(input: {
  memberId: string
  amount: number
  type: 'redemption'
  referenceId: string
  description: string
}): Promise<{ transaction: StarTransaction; newBalance: number }>

// Query operations
getBalance(memberId: string): Promise<number>

getHistory(memberId: string, options?: {
  limit?: number
  offset?: number
  type?: TransactionType
  startDate?: string
  endDate?: string
}): Promise<StarTransaction[]>

// Primary goal
setPrimaryGoal(memberId: string, rewardId: string): Promise<void>
getPrimaryGoal(memberId: string): Promise<Reward | null>
```

### Usage Examples

```typescript
// Reward chart task completed
await starService.addStars({
  memberId: "emma-123",
  amount: 1,
  type: "reward_chart",
  referenceId: "task-brush-am",
  description: "Brushed teeth (AM)",
});

// Parent gives bonus
await starService.addStars({
  memberId: "emma-123",
  amount: 10,
  type: "bonus",
  description: "Helped grandma without being asked",
  awardedById: "dad-456",
});

// Child redeems reward
await starService.removeStars({
  memberId: "emma-123",
  amount: 50,
  type: "redemption",
  referenceId: "reward-movie-night",
  description: "Movie Night Choice",
});
```

## Integration Points

### Reward Chart Integration

**File:** `src/server/services/reward-chart-service.ts`

When a task is completed, call star service instead of updating goal directly:

```typescript
async completeTask(taskId: string, date: string) {
  // ... existing completion logic ...

  await starService.addStars({
    memberId: chart.memberId,
    amount: task.starValue,
    type: 'reward_chart',
    referenceId: taskId,
    description: task.title
  })
}
```

### Chore Integration

**File:** `src/server/services/chore-service.ts`

When a chore is marked complete:

```typescript
async completeChore(choreId: string, memberId: string) {
  // ... existing completion logic ...

  await starService.addStars({
    memberId,
    amount: chore.starReward,
    type: 'chore',
    referenceId: choreId,
    description: chore.title
  })
}
```

### Reward Store Integration

**File:** `src/server/services/reward-store-service.ts`

```typescript
async redeemReward(memberId: string, rewardId: string) {
  const balance = await starService.getBalance(memberId)
  if (balance < reward.starCost) {
    throw new InsufficientStarsError(balance, reward.starCost)
  }

  await starService.removeStars({
    memberId,
    amount: reward.starCost,
    type: 'redemption',
    referenceId: rewardId,
    description: reward.title
  })

  await this.createRedemption(memberId, rewardId)
}
```

### Bonus Stars API

**Route:** `POST /api/v1/families/[familyId]/members/[memberId]/bonus`

Parents can award ad-hoc stars with a reason.

## Migration Strategy

### Step 1: Create new tables

- `star_transactions`
- `member_star_balances`
- `member_primary_goals`

### Step 2: Migrate existing chart goals to rewards

```sql
INSERT INTO rewards (id, familyId, title, description, starCost, type, ...)
SELECT id, familyId, title, description, starTarget, 'goal', ...
FROM reward_chart_goals WHERE status = 'active'
```

### Step 3: Backfill star transactions from completions

```sql
INSERT INTO star_transactions (memberId, amount, type, referenceId, description, createdAt)
SELECT
  chart.memberId,
  task.starValue,
  'reward_chart',
  completion.taskId,
  task.title,
  completion.completedAt
FROM reward_chart_completions completion
JOIN reward_chart_tasks task ON ...
JOIN reward_charts chart ON ...
WHERE completion.status = 'completed'
```

### Step 4: Deprecate old columns

- Remove `starsCurrent` from `reward_chart_goals`
- Drop or soft-deprecate `reward_chart_goals` table

## UI Changes

| Location                   | Change                                                  |
| -------------------------- | ------------------------------------------------------- |
| **Reward Chart Header**    | Show balance from star service instead of goal progress |
| **Goal Progress Ring**     | Calculate from `balance / primaryGoal.starCost`         |
| **Next Reward Card**       | Becomes "Primary Goal Card" — links to store            |
| **New: Star History**      | Activity feed showing recent transactions               |
| **New: Reward Store Page** | Browse & redeem rewards                                 |

## Error Handling

### Concurrency & Consistency

Use database transactions for all star operations:

```typescript
async removeStars(input) {
  return await db.transaction(async (tx) => {
    const balance = await this.getBalance(input.memberId, tx)
    if (balance < input.amount) {
      throw new InsufficientStarsError(balance, input.amount)
    }
    // Insert transaction & update cached balance atomically
  })
}
```

### Undo Operations

| Action                  | Undo Behavior                                 |
| ----------------------- | --------------------------------------------- |
| Task completion undone  | Create negative `reward_chart` transaction    |
| Chore unmarked complete | Create negative `chore` transaction           |
| Redemption              | No undo (parent can give bonus to compensate) |

Ledger is append-only — no deleting history.

### Edge Cases

| Case                            | Handling                                                     |
| ------------------------------- | ------------------------------------------------------------ |
| Negative balance                | Prevent via validation — `removeStars` fails if insufficient |
| No primary goal set             | Show "Pick a goal!" prompt, balance still visible            |
| Goal achieved (balance >= cost) | Show celebration, but don't auto-redeem                      |
| Deleted reward still in history | Store `description` snapshot, not just `referenceId`         |
| Member removed from family      | Keep transactions for audit, mark member inactive            |
