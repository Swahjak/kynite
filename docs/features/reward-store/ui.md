# Reward Store UI Specification

## Interaction Modes

| Mode             | Device         | User    | Purpose                         |
| ---------------- | -------------- | ------- | ------------------------------- |
| **Wall Display** | Mounted tablet | Kids    | View rewards, redeem with stars |
| **Management**   | Mobile/Desktop | Parents | Create, edit, manage rewards    |

### Wall Display Mode

**Allowed Actions:**

- View star balance
- Browse available rewards
- Redeem rewards (when affordable)
- View weekly earnings delta
- See primary goal progress

**Hidden/Disabled:**

- Create reward
- Edit reward
- Delete reward
- Award bonus stars
- Set primary goal for others
- Configure limits

**Touch Targets:** 48px minimum

### Management Mode

**Full Access:**

- All viewing capabilities
- Create new rewards
- Edit existing rewards
- Delete rewards
- Set costs and limits
- Award bonus stars
- View all family members' balances
- Set primary goals for any child
- View inactive rewards

---

## Layout

### Desktop

```
+------------------------------------------------------------------+
| Header: Member Selector + Star Balance Card                       |
+----------------------------------------------+-------------------+
| Rewards Marketplace (2/3)                    | Sidebar (1/3)     |
| - Reward cards grid (2 columns)              | - Weekly Trend    |
| - Primary goal highlighted                   | - Recent Activity |
| - Sorted by star cost                        |                   |
+----------------------------------------------+-------------------+
```

### Mobile

Single column layout:

1. Member selector (if manager)
2. Star balance card
3. Primary goal (if set)
4. Rewards grid (1 column)
5. Recent activity (collapsible)

---

## Components

### Star Balance Card

**File:** `src/components/reward-store/star-balance-card.tsx`

```typescript
interface StarBalanceCardProps {
  balance: number;
  weeklyDelta: number;
  className?: string;
}
```

**Elements:**

| Element      | Specification                                  |
| ------------ | ---------------------------------------------- |
| Label        | "Your Balance" - text-sm text-muted-foreground |
| Total        | text-4xl font-bold                             |
| Star icon    | Filled, primary color, h-8 w-8                 |
| Weekly delta | TrendingUp/Down icon + signed number           |

**Weekly Delta Display:**

- Positive: Green text, TrendingUp icon
- Negative: Red text, TrendingDown icon
- Zero: Hidden

### Reward Card

**File:** `src/components/reward-store/reward-card.tsx`

```typescript
interface RewardCardProps {
  reward: IRewardWithStatus;
  isPrimaryGoal?: boolean;
  onRedeem: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSetGoal?: () => void;
  className?: string;
}
```

**Structure:**

```
+-----------------------------------+
| [Emoji Box]              [Badges] |
+-----------------------------------+
| Title                             |
| Description (2 lines max)         |
|                                   |
| [Star Cost]  [Goal][Edit][Delete] |
|              [Redeem Button]      |
+-----------------------------------+
```

**States:**

| State         | Emoji Box   | Button                         | Star Cost     |
| ------------- | ----------- | ------------------------------ | ------------- |
| Affordable    | Gradient bg | Primary "Redeem"               | Primary color |
| Unaffordable  | Grayscale   | Disabled "Need X more"         | Muted color   |
| Limit reached | Grayscale   | Disabled "Available in X days" | Muted color   |
| Primary goal  | Gradient bg | Ring highlight on card         | Primary color |

**Badges:**

| Badge        | Condition                 | Style             |
| ------------ | ------------------------- | ----------------- |
| Primary Goal | `isPrimaryGoal === true`  | Secondary variant |
| Daily limit  | `limitType === "daily"`   | Outline + Clock   |
| Weekly limit | `limitType === "weekly"`  | Outline + Clock   |
| Monthly      | `limitType === "monthly"` | Outline + Clock   |
| One-time     | `limitType === "once"`    | Outline + Clock   |

**Manager Actions (visible only to managers):**

- Target icon: Set as primary goal
- Pencil icon: Edit reward
- Trash icon: Delete reward

### Redemption Confirm Dialog

**File:** `src/components/reward-store/dialogs/redemption-confirm-dialog.tsx`

Uses shadcn/ui `AlertDialog`:

- Shows reward emoji and title
- Shows cost and balance before/after
- "Cancel" (outline) and "Redeem Now" (primary) buttons

### Reward Dialog (Create/Edit)

**File:** `src/components/reward-store/dialogs/reward-dialog.tsx`

**Fields:**

| Field       | Type         | Validation                         |
| ----------- | ------------ | ---------------------------------- |
| Emoji       | Emoji picker | Required                           |
| Title       | Text input   | Required, max 100 chars            |
| Description | Textarea     | Optional, max 500 chars            |
| Star Cost   | Number input | Required, 1-100,000                |
| Limit Type  | Select       | none, daily, weekly, monthly, once |
| Active      | Switch       | Edit mode only                     |

### Select Member for Rewards

**File:** `src/components/reward-store/select-member-for-rewards.tsx`

Member selector for managers to view/manage different children's reward stores.

```typescript
interface ChildInfo {
  id: string;
  name: string;
  avatarColor: string | null;
  avatarSvg?: string | null;
  avatarUrl?: string | null;
  balance: number;
}
```

### Reward Store Context

**File:** `src/components/reward-store/contexts/reward-store-context.tsx`

Provides state management for the reward store:

```typescript
interface RewardStoreContextValue {
  familyId: string;
  memberId: string;
  data: RewardStoreData;
  isLoading: boolean;
  error: Error | null;
  isManager: boolean;
  allChildren?: ChildInfo[];
  // Actions
  createReward: (input: CreateRewardInput) => Promise<IReward>;
  updateReward: (id: string, input: UpdateRewardInput) => Promise<IReward>;
  deleteReward: (id: string) => Promise<void>;
  redeemReward: (rewardId: string) => Promise<{ newBalance: number }>;
  setPrimaryGoal: (rewardId: string) => Promise<void>;
  clearPrimaryGoal: () => Promise<void>;
  refreshData: () => Promise<void>;
}
```

---

## Redemption Flow

1. User taps "Redeem" button on affordable reward
2. Confirmation dialog appears (shows balance before/after)
3. User confirms redemption
4. API call to POST `/rewards/:id/redeem`
5. On success:
   - Stars deducted immediately
   - Balance card updates via React Query
   - Success toast shown
   - Pusher broadcasts balance update
6. On error:
   - Error toast with reason
   - Balance unchanged

### Error Messages

| Error              | User Message                         |
| ------------------ | ------------------------------------ |
| insufficient_stars | "You need more stars to redeem this" |
| limit_reached      | "Available again [date]"             |
| reward_not_found   | "This reward is no longer available" |
| reward_inactive    | "This reward is no longer available" |

---

## Accessibility

### Screen Reader Announcements

- Star balance: "Your balance: 1,250 stars, plus 120 this week"
- Reward cards: "[emoji] [title], [cost] stars, [Redeem/Need X more/Available in X]"
- Primary goal: "Primary goal: [title], [cost] stars needed, you have [balance]"

### Keyboard Navigation

- Tab through rewards grid
- Enter to open redemption dialog
- Escape to close dialogs
- Arrow keys in emoji picker

### Focus States

- Focus visible: 2px primary ring with offset
- Cards: Ring on focus
- Buttons: Standard shadcn focus states

---

## Dark Mode

| Element                | Light                     | Dark                          |
| ---------------------- | ------------------------- | ----------------------------- |
| Balance card bg        | primary/10 gradient       | primary/10 gradient           |
| Emoji box (affordable) | amber-100 to orange-100   | amber-900/30 to orange-900/30 |
| Emoji box (locked)     | muted bg + grayscale      | muted bg + grayscale          |
| Star cost              | primary (affordable)      | primary (affordable)          |
| Star cost              | muted-foreground (locked) | muted-foreground (locked)     |
| Card border            | border                    | border                        |
| Primary goal ring      | primary ring-2            | primary ring-2                |

---

## Animations

### Redemption Success

1. Button shows loading spinner during API call
2. On success, brief scale animation on balance card
3. Confetti effect (if enabled globally)
4. Toast slides in from top

### Balance Update

- Number counter animation from old to new value
- Weekly delta updates with fade transition

### Card States

- Hover: Subtle shadow increase
- Active/Focus: Ring appears
- Disabled: Opacity reduction (0.6)

---

## Responsive Breakpoints

| Breakpoint | Layout                          |
| ---------- | ------------------------------- |
| < 640px    | Single column, stacked sections |
| 640-1024px | Single column, wider cards      |
| > 1024px   | Two-column grid with sidebar    |

---

## i18n Keys

Translation keys in `messages/{locale}.json` under `rewardStore`:

```json
{
  "rewardStore": {
    "yourBalance": "Your Balance",
    "starsThisWeek": "this week",
    "redeem": "Redeem",
    "needMore": "Need {count} more",
    "availableIn": "Available in {time}",
    "primaryGoal": "Goal",
    "limitDaily": "Daily",
    "limitWeekly": "Weekly",
    "limitMonthly": "Monthly",
    "limitOnce": "One-time"
  }
}
```
