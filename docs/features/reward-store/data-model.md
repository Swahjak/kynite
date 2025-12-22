# Reward Store Data Model

## Reward Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `familyId` | UUID | Family this reward belongs to |
| `title` | string | Display name (max 50 chars) |
| `description` | string | Details (max 200 chars) |
| `starCost` | integer | Stars required to redeem |
| `imageUrl` | string | Reward image URL (optional) |
| `isActive` | boolean | Whether reward is available |
| `limitType` | enum | `none`, `daily`, `weekly`, `monthly`, `once` |
| `limitCount` | integer | Max redemptions per period |
| `badge` | string | Optional badge text |
| `createdAt` | timestamp | Creation date |
| `updatedAt` | timestamp | Last modification |

## Redemption Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `rewardId` | UUID | Reference to reward |
| `userId` | UUID | User who redeemed |
| `starCost` | integer | Stars spent (snapshot) |
| `redeemedAt` | timestamp | When redeemed |

## Star Transaction Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `userId` | UUID | User account |
| `amount` | integer | Positive (earned) or negative (spent) |
| `type` | enum | `chore`, `bonus`, `redemption` |
| `referenceId` | UUID | Related chore/redemption ID |
| `description` | string | Activity description |
| `createdAt` | timestamp | Transaction time |

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
      "description": "Pick the movie for family night!",
      "starCost": 500,
      "imageUrl": "https://...",
      "badge": "Popular",
      "canRedeem": true,
      "nextAvailableAt": null
    }
  ]
}
```

### POST /api/rewards/:id/redeem

Redeem a reward. Deducts stars immediately.

**Success Response:**
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

**Error Response:**
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

### GET /api/users/:id/redemptions

Fetch user's redemption history.
