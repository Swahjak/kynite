# Reward Store Specification

> **Design Reference Only**
>
> This document contains visual mockups and styling references. For implementation
> requirements, data models, and interaction rules, see the feature specification
> in `docs/features/reward-store/`.
>
> When implementing, apply the project's brand guidelines and established patterns
> from the codebase. Do not copy mockup code directly.

This document defines the Reward Store feature for Family Planner, enabling children to view available rewards and redeem them using earned stars.

---

## Overview

The Reward Store is a gamification feature that motivates children to complete tasks by allowing them to spend earned stars on rewards. Parents create and manage rewards through a separate interface (out of scope); this spec covers the child-facing experience.

### Core Functionality

1. **View star balance** — Current total and recent earnings
2. **Browse rewards** — See available rewards with costs and descriptions
3. **Redeem rewards** — Instantly exchange stars for rewards
4. **View activity** — Track star earnings and redemptions

---

## User Interface

### Page Layout

The Reward Store uses a two-column layout on desktop:

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: Greeting + Star Balance                                │
├─────────────────────────────────────┬───────────────────────────┤
│                                     │                           │
│  Rewards Marketplace (2/3)          │  Sidebar (1/3)            │
│  - Filter tabs                      │  - Weekly Earnings Chart  │
│  - Reward cards grid                │  - Recent Activity Feed   │
│                                     │                           │
└─────────────────────────────────────┴───────────────────────────┘
```

On mobile, the sidebar stacks below the marketplace.

### Header Section

#### Greeting

Display a personalized, time-based greeting:

| Time        | Format                          |
| ----------- | ------------------------------- |
| 5am - 12pm  | "Good Morning, [FirstName]!"    |
| 12pm - 5pm  | "Good Afternoon, [FirstName]!"  |
| 5pm - 9pm   | "Good Evening, [FirstName]!"    |
| 9pm - 5am   | "Good Night, [FirstName]!"      |

#### Star Balance Card

Prominently display the user's current star balance:

```
┌────────────────────────────────────┐
│  Total Stars                       │
│  1,250 ★                           │
│  +120 this week                    │
└────────────────────────────────────┘
```

**Specifications:**
- Background: `surface-light` / `surface-dark`
- Star count: `text-4xl font-black` (Lexend)
- Star icon: Material Symbols `star` (filled, primary color)
- Weekly delta: `text-xs font-medium text-primary-dark`
- Decorative background star icon at 10% opacity

---

## Rewards Marketplace

### Filter Tabs

Two tabs for filtering rewards:

| Tab           | Description                              |
| ------------- | ---------------------------------------- |
| **Available** | Rewards the user can currently redeem    |
| **Redeemed**  | History of previously redeemed rewards   |

**Tab styling:**
- Container: `bg-gray-100 dark:bg-surface-dark p-1 rounded-lg`
- Active tab: `bg-white dark:bg-background-dark shadow-sm font-bold`
- Inactive tab: `text-text-muted hover:text-text-main`

### Reward Cards

Display rewards in a responsive grid:
- Desktop: 2 columns
- Mobile: 1 column

#### Card Structure

```
┌─────────────────────────────────────┐
│  [Image]                    [Badge] │
│                                     │
├─────────────────────────────────────┤
│  Title                              │
│  Description (2 lines max)          │
│                                     │
│  ★ 500              [Redeem Button] │
└─────────────────────────────────────┘
```

#### Card States

**Available (Affordable)**
- Full color image
- Primary "Redeem" button
- Star cost in `text-primary`

**Available (Unaffordable)**
- Grayscale image with dark overlay
- "Locked" badge centered on image
- Disabled button showing "Need X more"
- Star cost in `text-text-muted`

**Temporarily Unavailable**
- When limit reached (e.g., "once per week")
- Grayscale image
- Badge: "Available in X days"
- Disabled button

#### Card Specifications

| Element       | Specification                                      |
| ------------- | -------------------------------------------------- |
| Container     | `bg-surface rounded-xl border border-border-default` |
| Image         | Height: 160px, `bg-cover bg-center`                |
| Title         | `text-lg font-bold` (Lexend)                       |
| Description   | `text-sm text-text-muted line-clamp-2`             |
| Star cost     | `text-lg font-bold` with filled star icon          |
| Border hover  | `hover:border-primary`                             |
| Shadow        | `shadow-sm hover:shadow-md`                        |

#### Badges

Optional badges displayed on reward images:

| Badge Type  | Style                                        | Use Case           |
| ----------- | -------------------------------------------- | ------------------ |
| Popular     | `bg-white/90 text-text-main`                 | High redemption    |
| New         | `bg-primary text-background-dark`            | Recently added     |
| Limited     | `bg-orange-500 text-white`                   | Limited quantity   |
| Locked      | `bg-black/60 text-white` with lock icon      | Unaffordable       |

---

## Redemption Flow

### Instant Redemption

When a user clicks "Redeem":

1. **Confirmation dialog** appears (optional, configurable by parents)
2. **Stars deducted** from balance immediately
3. **Success feedback** shown
4. **Activity logged** in Recent Activity

### Confirmation Dialog

```
┌─────────────────────────────────────┐
│  Redeem Reward?                     │
│                                     │
│  You're about to redeem:            │
│  "Movie Night Choice"               │
│                                     │
│  Cost: ★ 500                        │
│  Your balance: ★ 1,250              │
│  After: ★ 750                       │
│                                     │
│  [Cancel]              [Redeem Now] │
└─────────────────────────────────────┘
```

**Dialog specifications:**
- Use shadcn/ui `AlertDialog` component
- "Redeem Now" button: Primary style
- "Cancel" button: Secondary/outline style

### Success Toast

After successful redemption:

```
┌─────────────────────────────────────┐
│  ✓ Reward Redeemed!                 │
│  "Movie Night Choice" is yours.     │
└─────────────────────────────────────┘
```

- Duration: 4 seconds
- Position: Bottom-right (desktop), bottom-center (mobile)
- Use shadcn/ui `Toast` component

### Error Handling

| Scenario              | Message                                    |
| --------------------- | ------------------------------------------ |
| Insufficient stars    | "You need X more stars for this reward"    |
| Limit reached         | "You can redeem this again in X days"      |
| Reward unavailable    | "This reward is no longer available"       |
| Network error         | "Something went wrong. Please try again."  |

---

## Sidebar Components

### Weekly Star Earnings Chart

A simple bar chart showing daily earnings for the current week:

```
     ▂▅▁▇█▂▁
     M T W T F S S
```

**Specifications:**
- Container: `bg-surface rounded-xl p-6 border`
- Bar height: Proportional to daily earnings (max 128px)
- Bar color: `bg-primary`
- Background track: `bg-primary/20`
- Current day: Highlighted label in `text-primary font-bold`
- Day labels: `text-xs text-text-muted`

### Recent Activity Feed

Shows the last 4-5 activities (earnings and redemptions):

```
┌─────────────────────────────────────┐
│  Recent Activity          View All  │
├─────────────────────────────────────┤
│  ✓ Cleaned Room      2h ago    +20  │
│  ✓ Homework Done     Yesterday +50  │
│  🛍 Redeemed: Snack  Yesterday -100 │
│  ✓ Walked Dog        2 days    +15  │
└─────────────────────────────────────┘
```

#### Activity Item Types

**Star Earned:**
- Icon: Check mark in green circle (`bg-green-100 text-green-600`)
- Delta: `+XX` in `text-primary-dark`

**Reward Redeemed:**
- Icon: Shopping bag in red circle (`bg-red-100 text-red-500`)
- Delta: `-XX` in `text-red-500`

**Bonus Stars (from parent):**
- Icon: Gift in purple circle (`bg-purple-100 text-purple-600`)
- Delta: `+XX` in `text-primary-dark`
- Label: "Bonus: [reason]"

#### Activity Item Specifications

| Element     | Specification                                    |
| ----------- | ------------------------------------------------ |
| Container   | `bg-surface p-3 rounded-lg border`               |
| Icon circle | `p-2 rounded-full` with category colors          |
| Title       | `text-sm font-medium`                            |
| Timestamp   | `text-xs text-text-muted`                        |
| Delta       | `text-sm font-bold` (green for +, red for -)     |

---

## Reward Data Model

### Reward Entity

| Field             | Type      | Description                              |
| ----------------- | --------- | ---------------------------------------- |
| `id`              | UUID      | Unique identifier                        |
| `familyId`        | UUID      | Family this reward belongs to            |
| `title`           | string    | Display name (max 50 chars)              |
| `description`     | string    | Details (max 200 chars)                  |
| `starCost`        | integer   | Stars required to redeem                 |
| `imageUrl`        | string    | Reward image URL (optional)              |
| `isActive`        | boolean   | Whether reward is currently available    |
| `limitType`       | enum      | `none`, `daily`, `weekly`, `monthly`, `once` |
| `limitCount`      | integer   | Max redemptions per period (default: 1)  |
| `badge`           | string    | Optional badge text                      |
| `createdAt`       | timestamp | Creation date                            |
| `updatedAt`       | timestamp | Last modification                        |

### Redemption Entity

| Field         | Type      | Description                              |
| ------------- | --------- | ---------------------------------------- |
| `id`          | UUID      | Unique identifier                        |
| `rewardId`    | UUID      | Reference to reward                      |
| `userId`      | UUID      | User who redeemed                        |
| `starCost`    | integer   | Stars spent (snapshot)                   |
| `redeemedAt`  | timestamp | When redeemed                            |

### Star Transaction Entity

| Field         | Type      | Description                              |
| ------------- | --------- | ---------------------------------------- |
| `id`          | UUID      | Unique identifier                        |
| `userId`      | UUID      | User account                             |
| `amount`      | integer   | Positive (earned) or negative (spent)    |
| `type`        | enum      | `chore`, `bonus`, `redemption`           |
| `referenceId` | UUID      | Related chore/redemption ID (nullable)   |
| `description` | string    | Activity description                     |
| `createdAt`   | timestamp | Transaction time                         |

---

## API Endpoints

### GET /api/rewards

Fetch available rewards for the current user's family.

**Response:**
```json
{
  "rewards": [
    {
      "id": "uuid",
      "title": "Movie Night Choice",
      "description": "Pick the movie for family night and choose the snacks!",
      "starCost": 500,
      "imageUrl": "https://...",
      "badge": "Popular",
      "limitType": "weekly",
      "limitCount": 1,
      "canRedeem": true,
      "nextAvailableAt": null
    }
  ]
}
```

### POST /api/rewards/:id/redeem

Redeem a reward.

**Response (success):**
```json
{
  "success": true,
  "newBalance": 750,
  "redemption": {
    "id": "uuid",
    "rewardTitle": "Movie Night Choice",
    "starCost": 500,
    "redeemedAt": "2024-12-22T10:30:00Z"
  }
}
```

**Response (error):**
```json
{
  "success": false,
  "error": "INSUFFICIENT_STARS",
  "message": "You need 250 more stars",
  "required": 500,
  "balance": 250
}
```

### GET /api/users/:id/stars

Fetch user's star balance and recent activity.

**Response:**
```json
{
  "balance": 1250,
  "weeklyEarnings": 120,
  "dailyEarnings": [15, 30, 10, 25, 40, 0, 0],
  "recentActivity": [
    {
      "id": "uuid",
      "type": "chore",
      "description": "Cleaned Room",
      "amount": 20,
      "createdAt": "2024-12-22T08:00:00Z"
    }
  ]
}
```

### GET /api/users/:id/redemptions

Fetch user's redemption history.

**Response:**
```json
{
  "redemptions": [
    {
      "id": "uuid",
      "rewardTitle": "Ice Cream Trip",
      "rewardImageUrl": "https://...",
      "starCost": 350,
      "redeemedAt": "2024-12-20T15:30:00Z"
    }
  ]
}
```

---

## Styling Reference

### Brand Colors

| Token           | Light        | Dark         |
| --------------- | ------------ | ------------ |
| `primary`       | `#13ec92`    | `#13ec92`    |
| `primary-dark`  | `#0d9e61`    | `#13ec92`    |
| `background`    | `#f6f8f7`    | `#10221a`    |
| `surface`       | `#ffffff`    | `#1c2e26`    |
| `text-main`     | `#111815`    | `#ffffff`    |
| `text-muted`    | `#618979`    | `#8baea0`    |
| `border`        | `#dbe6e1`    | `#2a3831`    |

### Typography

- **Headings**: Lexend, Bold/Black weight
- **Body text**: Noto Sans, Regular weight
- **Numbers** (star counts): Lexend, Bold, tabular-nums

### Icons

Material Symbols Outlined:
- `star` (filled) — Star currency
- `storefront` (filled) — Marketplace header
- `check` — Completed activity
- `shopping_bag` — Redemption activity
- `lock` — Locked/unaffordable reward
- `redeem` — Redeem button icon (optional)

### Animation

- Card hover: `transition: all 200ms ease`
- Button press: `active:scale-95`
- Progress bar fill: `transition: width 1000ms ease-out`
- Respect `prefers-reduced-motion`

---

## Accessibility

### Keyboard Navigation

- All interactive elements focusable via Tab
- Enter/Space to activate buttons
- Escape to close dialogs

### Screen Reader Support

- Star balance announced with context: "1,250 stars, 120 earned this week"
- Reward cards include full details: "Movie Night Choice, 500 stars, Redeem button"
- Locked rewards announce: "Locked, need 250 more stars"

### Focus States

```css
:focus-visible {
  outline: 2px solid #13ec92;
  outline-offset: 2px;
}
```

### Color Contrast

- All text meets WCAG 2.1 AA (4.5:1 ratio)
- Don't rely on color alone — use icons and text labels

---

## Mobile Considerations

### Layout Changes

- Single column layout
- Sidebar components stack below marketplace
- Full-width reward cards
- Bottom sheet for confirmation dialog

### Touch Targets

- Minimum 44x44px for all interactive elements
- Adequate spacing between cards (16px gap)

### Performance

- Lazy load reward images
- Virtualize long lists (redemption history)
- Skeleton loading states

---

## Design Assets

| File                        | Description                    |
| --------------------------- | ------------------------------ |
| `reward-store-design-1.png` | Desktop mockup                 |
| `reward-store-code-1.html`  | Reference HTML implementation  |

---

*Last updated: December 2024*
