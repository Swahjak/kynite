# Reward Store Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement a marketplace where children spend earned stars on rewards configured by parents, with full limit support and redemption tracking.

**Architecture:** The Reward Store adds two new tables (`rewards`, `redemptions`), a new service (`reward-store-service.ts`), 9 API endpoints, and a complete `/rewards` page with Available/Redeemed tabs. It integrates with the existing star-service for balance checks and transaction logging.

**Tech Stack:** Next.js 16, Drizzle ORM, Zod validation, React Hook Form, shadcn/ui, next-intl

---

## Group 1: Database Layer

### Task 1.1: Add Rewards and Redemptions Schema

**Files:**

- Modify: `src/server/schema.ts` (after Star Transactions section ~line 290)

**Step 1: Add rewards table and redemptions table**

Add after `memberPrimaryGoalsRelations`:

```typescript
// ============================================================================
// Rewards Store
// ============================================================================

/**
 * Rewards table - Family reward marketplace items
 */
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

/**
 * Redemptions table - Records of reward claims
 */
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

**Step 2: Add relations**

Add after `memberPrimaryGoalsRelations`:

```typescript
export const rewardsRelations = relations(rewards, ({ one, many }) => ({
  family: one(families, {
    fields: [rewards.familyId],
    references: [families.id],
  }),
  redemptions: many(redemptions),
}));

export const redemptionsRelations = relations(redemptions, ({ one }) => ({
  reward: one(rewards, {
    fields: [redemptions.rewardId],
    references: [rewards.id],
  }),
  member: one(familyMembers, {
    fields: [redemptions.memberId],
    references: [familyMembers.id],
  }),
}));
```

**Step 3: Add type exports**

Add at end of file:

```typescript
export type Reward = typeof rewards.$inferSelect;
export type NewReward = typeof rewards.$inferInsert;
export type Redemption = typeof redemptions.$inferSelect;
export type NewRedemption = typeof redemptions.$inferInsert;
```

**Step 4: Update memberPrimaryGoals FK reference**

Update the `memberPrimaryGoals` table to properly reference rewards:

```typescript
export const memberPrimaryGoals = pgTable("member_primary_goals", {
  memberId: text("member_id")
    .primaryKey()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  rewardId: text("reward_id")
    .notNull()
    .references(() => rewards.id, { onDelete: "cascade" }), // Now has proper FK
  setAt: timestamp("set_at", { mode: "date" }).notNull().defaultNow(),
});
```

**Step 5: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 6: Commit**

```bash
git add src/server/schema.ts
git commit -m "feat(schema): add rewards and redemptions tables"
```

### Task 1.2: Generate and Run Migration

**Files:**

- Create: `drizzle/XXXX_add_rewards_store.sql` (generated)

**Step 1: Generate migration**

Run: `pnpm db:generate`
Expected: Migration file created in `drizzle/`

**Step 2: Review migration SQL**

Verify migration contains:

- CREATE TABLE rewards with all columns
- CREATE TABLE redemptions with all columns
- ALTER TABLE member_primary_goals to add FK to rewards

**Step 3: Run migration**

Run: `pnpm db:push`
Expected: Schema pushed successfully

**Step 4: Commit**

```bash
git add drizzle/
git commit -m "chore(db): add rewards store migration"
```

---

## Group 2: Validation Layer

### Task 2.1: Create Reward Validation Schemas

**Files:**

- Create: `src/lib/validations/reward.ts`

**Step 1: Create validation file with all schemas**

```typescript
import { z } from "zod";

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

export const limitTypeSchema = z.enum([
  "none",
  "daily",
  "weekly",
  "monthly",
  "once",
]);
export type LimitType = z.infer<typeof limitTypeSchema>;

// =============================================================================
// REWARD CRUD
// =============================================================================

export const createRewardSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title too long"),
  description: z.string().max(500).nullable().optional(),
  emoji: z.string().min(1, "Emoji is required"),
  starCost: z.number().int().min(1, "Cost must be at least 1").max(100000),
  limitType: limitTypeSchema.default("none"),
});

export type CreateRewardInput = z.infer<typeof createRewardSchema>;

export const updateRewardSchema = createRewardSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type UpdateRewardInput = z.infer<typeof updateRewardSchema>;

// =============================================================================
// REDEMPTION
// =============================================================================

// No body needed - rewardId comes from URL path

// =============================================================================
// PRIMARY GOAL
// =============================================================================

export const setPrimaryGoalSchema = z.object({
  rewardId: z.string().min(1, "Reward ID is required"),
});

export type SetPrimaryGoalInput = z.infer<typeof setPrimaryGoalSchema>;

// =============================================================================
// QUERY PARAMS
// =============================================================================

export const rewardsQuerySchema = z.object({
  includeInactive: z.boolean().optional().default(false),
});

export type RewardsQueryInput = z.infer<typeof rewardsQuerySchema>;

export const redemptionsQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

export type RedemptionsQueryInput = z.infer<typeof redemptionsQuerySchema>;
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/validations/reward.ts
git commit -m "feat(validation): add reward store schemas"
```

---

## Group 3: Service Layer (TDD)

### Task 3.1: Write Failing Tests for Reward Store Service

**Files:**

- Create: `src/server/services/__tests__/reward-store-service.test.ts`

**Step 1: Write comprehensive test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("@/server/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

// Mock star service
vi.mock("../star-service", () => ({
  getBalance: vi.fn(),
  removeStars: vi.fn(),
}));

describe("reward-store-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getRewardsForFamily", () => {
    it("returns all active rewards for family", async () => {
      const { db } = await import("@/server/db");
      const mockRewards = [
        { id: "reward-1", title: "Movie Night", starCost: 50, isActive: true },
        { id: "reward-2", title: "Ice Cream", starCost: 20, isActive: true },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockRewards),
          }),
        }),
      } as never);

      const { getRewardsForFamily } = await import("../reward-store-service");
      const rewards = await getRewardsForFamily("family-1");

      expect(rewards).toHaveLength(2);
      expect(rewards[0].title).toBe("Movie Night");
    });
  });

  describe("createReward", () => {
    it("creates reward with all fields", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "reward-1",
              familyId: "family-1",
              title: "Movie Night",
              emoji: "🎬",
              starCost: 50,
              limitType: "weekly",
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]),
        }),
      } as never);

      const { createReward } = await import("../reward-store-service");
      const reward = await createReward("family-1", {
        title: "Movie Night",
        emoji: "🎬",
        starCost: 50,
        limitType: "weekly",
      });

      expect(reward.title).toBe("Movie Night");
      expect(reward.starCost).toBe(50);
    });
  });

  describe("canRedeem", () => {
    it("returns true when balance sufficient and no limits", async () => {
      const { db } = await import("@/server/db");
      const { getBalance } = await import("../star-service");

      vi.mocked(getBalance).mockResolvedValue(100);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([
              {
                id: "reward-1",
                starCost: 50,
                limitType: "none",
                isActive: true,
              },
            ]),
        }),
      } as never);

      const { canRedeem } = await import("../reward-store-service");
      const result = await canRedeem("member-1", "reward-1");

      expect(result.canRedeem).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("returns false with reason when balance insufficient", async () => {
      const { db } = await import("@/server/db");
      const { getBalance } = await import("../star-service");

      vi.mocked(getBalance).mockResolvedValue(30);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([
              {
                id: "reward-1",
                starCost: 50,
                limitType: "none",
                isActive: true,
              },
            ]),
        }),
      } as never);

      const { canRedeem } = await import("../reward-store-service");
      const result = await canRedeem("member-1", "reward-1");

      expect(result.canRedeem).toBe(false);
      expect(result.reason).toBe("insufficient_stars");
    });

    it("returns false when daily limit reached", async () => {
      const { db } = await import("@/server/db");
      const { getBalance } = await import("../star-service");

      vi.mocked(getBalance).mockResolvedValue(100);

      // First call: get reward
      // Second call: get redemptions in period
      let callCount = 0;
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve([
                {
                  id: "reward-1",
                  starCost: 50,
                  limitType: "daily",
                  isActive: true,
                },
              ]);
            }
            // Already redeemed today
            return {
              orderBy: vi.fn().mockResolvedValue([{ id: "redemption-1" }]),
            };
          }),
        }),
      } as never);

      const { canRedeem } = await import("../reward-store-service");
      const result = await canRedeem("member-1", "reward-1");

      expect(result.canRedeem).toBe(false);
      expect(result.reason).toBe("limit_reached");
    });
  });

  describe("redeemReward", () => {
    it("creates redemption and deducts stars", async () => {
      const { db } = await import("@/server/db");
      const { removeStars } = await import("../star-service");

      vi.mocked(removeStars).mockResolvedValue({
        transaction: { id: "txn-1" } as any,
        newBalance: 50,
      });

      vi.mocked(db.transaction).mockImplementation(async (callback) => {
        return callback({
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi
                .fn()
                .mockResolvedValue([
                  {
                    id: "reward-1",
                    title: "Movie Night",
                    starCost: 50,
                    limitType: "none",
                    isActive: true,
                  },
                ]),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi
                .fn()
                .mockResolvedValue([
                  {
                    id: "redemption-1",
                    rewardId: "reward-1",
                    memberId: "member-1",
                    starCost: 50,
                  },
                ]),
            }),
          }),
        } as never);
      });

      const { redeemReward } = await import("../reward-store-service");
      const result = await redeemReward("member-1", "reward-1");

      expect(result.redemption.id).toBe("redemption-1");
      expect(result.newBalance).toBe(50);
    });

    it("throws RedemptionError when cannot redeem", async () => {
      const { db } = await import("@/server/db");
      const { getBalance } = await import("../star-service");

      vi.mocked(getBalance).mockResolvedValue(10);
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi
            .fn()
            .mockResolvedValue([
              {
                id: "reward-1",
                starCost: 50,
                limitType: "none",
                isActive: true,
              },
            ]),
        }),
      } as never);

      const { redeemReward, RedemptionError } =
        await import("../reward-store-service");

      await expect(redeemReward("member-1", "reward-1")).rejects.toBeInstanceOf(
        RedemptionError
      );
    });
  });

  describe("setPrimaryGoal", () => {
    it("sets primary goal for member", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
        }),
      } as never);

      const { setPrimaryGoal } = await import("../reward-store-service");
      await expect(
        setPrimaryGoal("member-1", "reward-1")
      ).resolves.not.toThrow();
    });
  });

  describe("getRedemptionsForMember", () => {
    it("returns redemptions with reward details", async () => {
      const { db } = await import("@/server/db");

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  offset: vi.fn().mockResolvedValue([
                    {
                      redemptions: {
                        id: "r-1",
                        starCost: 50,
                        redeemedAt: new Date(),
                      },
                      rewards: { title: "Movie Night", emoji: "🎬" },
                    },
                  ]),
                }),
              }),
            }),
          }),
        }),
      } as never);

      const { getRedemptionsForMember } =
        await import("../reward-store-service");
      const result = await getRedemptionsForMember("member-1");

      expect(result).toHaveLength(1);
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test src/server/services/__tests__/reward-store-service.test.ts`
Expected: Tests fail with "module not found" or similar

**Step 3: Commit failing tests**

```bash
git add src/server/services/__tests__/reward-store-service.test.ts
git commit -m "test: add failing tests for reward-store-service"
```

### Task 3.2: Implement Reward Store Service

**Files:**

- Create: `src/server/services/reward-store-service.ts`

**Step 1: Implement the service**

```typescript
import { db } from "@/server/db";
import {
  rewards,
  redemptions,
  memberPrimaryGoals,
  familyMembers,
} from "@/server/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { getBalance, removeStars } from "./star-service";
import type {
  CreateRewardInput,
  UpdateRewardInput,
  LimitType,
} from "@/lib/validations/reward";
import type { Reward, Redemption } from "@/server/schema";

// =============================================================================
// ERRORS
// =============================================================================

export class RedemptionError extends Error {
  constructor(
    public reason:
      | "insufficient_stars"
      | "limit_reached"
      | "reward_not_found"
      | "reward_inactive",
    public details?: { starsNeeded?: number; nextAvailable?: Date }
  ) {
    super(`Cannot redeem: ${reason}`);
    this.name = "RedemptionError";
  }
}

// =============================================================================
// REWARD CRUD
// =============================================================================

export async function getRewardsForFamily(
  familyId: string,
  includeInactive = false
): Promise<Reward[]> {
  const conditions = [eq(rewards.familyId, familyId)];

  if (!includeInactive) {
    conditions.push(eq(rewards.isActive, true));
  }

  return await db
    .select()
    .from(rewards)
    .where(and(...conditions))
    .orderBy(rewards.starCost);
}

export async function getRewardById(rewardId: string): Promise<Reward | null> {
  const results = await db
    .select()
    .from(rewards)
    .where(eq(rewards.id, rewardId));

  return results[0] ?? null;
}

export async function createReward(
  familyId: string,
  input: CreateRewardInput
): Promise<Reward> {
  const [reward] = await db
    .insert(rewards)
    .values({
      id: createId(),
      familyId,
      title: input.title,
      description: input.description ?? null,
      emoji: input.emoji,
      starCost: input.starCost,
      limitType: input.limitType ?? "none",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return reward;
}

export async function updateReward(
  rewardId: string,
  input: UpdateRewardInput
): Promise<Reward> {
  const [reward] = await db
    .update(rewards)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(rewards.id, rewardId))
    .returning();

  return reward;
}

export async function deleteReward(rewardId: string): Promise<void> {
  await db.delete(rewards).where(eq(rewards.id, rewardId));
}

// =============================================================================
// LIMIT CHECKING
// =============================================================================

function getPeriodStart(limitType: LimitType): Date {
  const now = new Date();

  switch (limitType) {
    case "daily":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "weekly": {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      return new Date(now.getFullYear(), now.getMonth(), diff);
    }
    case "monthly":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "once":
      return new Date(0); // Beginning of time
    default:
      return new Date(0);
  }
}

function getNextPeriodStart(limitType: LimitType): Date {
  const now = new Date();

  switch (limitType) {
    case "daily":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    case "weekly": {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? 1 : 8); // Next Monday
      return new Date(now.getFullYear(), now.getMonth(), diff);
    }
    case "monthly":
      return new Date(now.getFullYear(), now.getMonth() + 1, 1);
    case "once":
      return new Date(9999, 11, 31); // Never
    default:
      return new Date();
  }
}

async function getRedemptionsInPeriod(
  memberId: string,
  rewardId: string,
  periodStart: Date
): Promise<Redemption[]> {
  return await db
    .select()
    .from(redemptions)
    .where(
      and(
        eq(redemptions.memberId, memberId),
        eq(redemptions.rewardId, rewardId),
        gte(redemptions.redeemedAt, periodStart)
      )
    )
    .orderBy(desc(redemptions.redeemedAt));
}

// =============================================================================
// REDEMPTION
// =============================================================================

export async function canRedeem(
  memberId: string,
  rewardId: string
): Promise<{ canRedeem: boolean; reason?: string; nextAvailable?: Date }> {
  const reward = await getRewardById(rewardId);

  if (!reward) {
    return { canRedeem: false, reason: "reward_not_found" };
  }

  if (!reward.isActive) {
    return { canRedeem: false, reason: "reward_inactive" };
  }

  const balance = await getBalance(memberId);

  if (balance < reward.starCost) {
    return { canRedeem: false, reason: "insufficient_stars" };
  }

  if (reward.limitType !== "none") {
    const periodStart = getPeriodStart(reward.limitType as LimitType);
    const existingRedemptions = await getRedemptionsInPeriod(
      memberId,
      rewardId,
      periodStart
    );

    if (existingRedemptions.length > 0) {
      return {
        canRedeem: false,
        reason: "limit_reached",
        nextAvailable: getNextPeriodStart(reward.limitType as LimitType),
      };
    }
  }

  return { canRedeem: true };
}

export async function redeemReward(
  memberId: string,
  rewardId: string
): Promise<{ redemption: Redemption; newBalance: number }> {
  const {
    canRedeem: allowed,
    reason,
    nextAvailable,
  } = await canRedeem(memberId, rewardId);

  if (!allowed) {
    throw new RedemptionError(reason as any, { nextAvailable });
  }

  const reward = await getRewardById(rewardId);
  if (!reward) {
    throw new RedemptionError("reward_not_found");
  }

  // Deduct stars via star-service
  const { newBalance } = await removeStars({
    memberId,
    amount: reward.starCost,
    type: "redemption",
    referenceId: rewardId,
    description: reward.title,
  });

  // Record redemption
  const [redemption] = await db
    .insert(redemptions)
    .values({
      id: createId(),
      rewardId,
      memberId,
      starCost: reward.starCost,
      redeemedAt: new Date(),
    })
    .returning();

  return { redemption, newBalance };
}

export async function getRedemptionsForMember(
  memberId: string,
  options?: { limit?: number; offset?: number }
): Promise<
  Array<{ redemption: Redemption; reward: { title: string; emoji: string } }>
> {
  const results = await db
    .select({
      redemptions: redemptions,
      rewards: { title: rewards.title, emoji: rewards.emoji },
    })
    .from(redemptions)
    .innerJoin(rewards, eq(redemptions.rewardId, rewards.id))
    .where(eq(redemptions.memberId, memberId))
    .orderBy(desc(redemptions.redeemedAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);

  return results.map((r) => ({
    redemption: r.redemptions,
    reward: r.rewards,
  }));
}

// =============================================================================
// PRIMARY GOAL
// =============================================================================

export async function setPrimaryGoal(
  memberId: string,
  rewardId: string
): Promise<void> {
  await db
    .insert(memberPrimaryGoals)
    .values({
      memberId,
      rewardId,
      setAt: new Date(),
    })
    .onConflictDoUpdate({
      target: memberPrimaryGoals.memberId,
      set: {
        rewardId,
        setAt: new Date(),
      },
    });
}

export async function clearPrimaryGoal(memberId: string): Promise<void> {
  await db
    .delete(memberPrimaryGoals)
    .where(eq(memberPrimaryGoals.memberId, memberId));
}

export async function getPrimaryGoal(memberId: string): Promise<Reward | null> {
  const results = await db
    .select({
      reward: rewards,
    })
    .from(memberPrimaryGoals)
    .innerJoin(rewards, eq(memberPrimaryGoals.rewardId, rewards.id))
    .where(eq(memberPrimaryGoals.memberId, memberId));

  return results[0]?.reward ?? null;
}
```

**Step 2: Run tests to verify they pass**

Run: `pnpm test src/server/services/__tests__/reward-store-service.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/server/services/reward-store-service.ts
git commit -m "feat(service): implement reward-store-service with TDD"
```

---

## Group 4: API Routes

### Task 4.1: Implement Rewards CRUD Endpoints

**Files:**

- Create: `src/app/api/v1/families/[familyId]/rewards/route.ts`
- Create: `src/app/api/v1/families/[familyId]/rewards/[rewardId]/route.ts`

**Step 1: Create list/create endpoint**

`src/app/api/v1/families/[familyId]/rewards/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import {
  getRewardsForFamily,
  createReward,
} from "@/server/services/reward-store-service";
import { createRewardSchema } from "@/lib/validations/reward";

type RouteParams = {
  params: Promise<{ familyId: string }>;
};

/**
 * GET /api/v1/families/[familyId]/rewards
 * List all rewards for family
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { familyId } = await params;

    // Verify membership
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      );

    if (membership.length === 0) {
      return NextResponse.json(
        { error: "Not a family member" },
        { status: 403 }
      );
    }

    const includeInactive =
      request.nextUrl.searchParams.get("includeInactive") === "true";
    const rewards = await getRewardsForFamily(familyId, includeInactive);

    return NextResponse.json({ rewards });
  } catch (error) {
    console.error("Error fetching rewards:", error);
    return NextResponse.json(
      { error: "Failed to fetch rewards" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/families/[familyId]/rewards
 * Create a new reward (managers only)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { familyId } = await params;

    // Verify caller is manager
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      );

    if (membership.length === 0 || membership[0].role !== "manager") {
      return NextResponse.json(
        { error: "Only managers can create rewards" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parseResult = createRewardSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const reward = await createReward(familyId, parseResult.data);

    return NextResponse.json({ reward }, { status: 201 });
  } catch (error) {
    console.error("Error creating reward:", error);
    return NextResponse.json(
      { error: "Failed to create reward" },
      { status: 500 }
    );
  }
}
```

**Step 2: Create single reward endpoint**

`src/app/api/v1/families/[familyId]/rewards/[rewardId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import {
  getRewardById,
  updateReward,
  deleteReward,
} from "@/server/services/reward-store-service";
import { updateRewardSchema } from "@/lib/validations/reward";

type RouteParams = {
  params: Promise<{ familyId: string; rewardId: string }>;
};

/**
 * GET /api/v1/families/[familyId]/rewards/[rewardId]
 * Get single reward
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { familyId, rewardId } = await params;

    // Verify membership
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      );

    if (membership.length === 0) {
      return NextResponse.json(
        { error: "Not a family member" },
        { status: 403 }
      );
    }

    const reward = await getRewardById(rewardId);

    if (!reward) {
      return NextResponse.json({ error: "Reward not found" }, { status: 404 });
    }

    return NextResponse.json({ reward });
  } catch (error) {
    console.error("Error fetching reward:", error);
    return NextResponse.json(
      { error: "Failed to fetch reward" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/families/[familyId]/rewards/[rewardId]
 * Update reward (managers only)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { familyId, rewardId } = await params;

    // Verify caller is manager
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      );

    if (membership.length === 0 || membership[0].role !== "manager") {
      return NextResponse.json(
        { error: "Only managers can update rewards" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parseResult = updateRewardSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const reward = await updateReward(rewardId, parseResult.data);

    return NextResponse.json({ reward });
  } catch (error) {
    console.error("Error updating reward:", error);
    return NextResponse.json(
      { error: "Failed to update reward" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/families/[familyId]/rewards/[rewardId]
 * Delete reward (managers only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { familyId, rewardId } = await params;

    // Verify caller is manager
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      );

    if (membership.length === 0 || membership[0].role !== "manager") {
      return NextResponse.json(
        { error: "Only managers can delete rewards" },
        { status: 403 }
      );
    }

    await deleteReward(rewardId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reward:", error);
    return NextResponse.json(
      { error: "Failed to delete reward" },
      { status: 500 }
    );
  }
}
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/rewards/
git commit -m "feat(api): add rewards CRUD endpoints"
```

### Task 4.2: Implement Redemption Endpoint

**Files:**

- Create: `src/app/api/v1/families/[familyId]/rewards/[rewardId]/redeem/route.ts`

**Step 1: Create redeem endpoint**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import {
  redeemReward,
  RedemptionError,
} from "@/server/services/reward-store-service";

type RouteParams = {
  params: Promise<{ familyId: string; rewardId: string }>;
};

/**
 * POST /api/v1/families/[familyId]/rewards/[rewardId]/redeem
 * Redeem a reward (any family member can redeem for themselves)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { familyId, rewardId } = await params;

    // Get caller's membership
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      );

    if (membership.length === 0) {
      return NextResponse.json(
        { error: "Not a family member" },
        { status: 403 }
      );
    }

    const memberId = membership[0].id;

    const result = await redeemReward(memberId, rewardId);

    return NextResponse.json({
      success: true,
      redemption: result.redemption,
      newBalance: result.newBalance,
    });
  } catch (error) {
    if (error instanceof RedemptionError) {
      let message = "";
      let status = 400;

      switch (error.reason) {
        case "insufficient_stars":
          message = "You need more stars to redeem this reward";
          break;
        case "limit_reached":
          message = error.details?.nextAvailable
            ? `Available again ${error.details.nextAvailable.toLocaleDateString()}`
            : "Limit reached for this period";
          break;
        case "reward_not_found":
          message = "Reward not found";
          status = 404;
          break;
        case "reward_inactive":
          message = "This reward is no longer available";
          break;
      }

      return NextResponse.json(
        { error: message, reason: error.reason },
        { status }
      );
    }

    console.error("Error redeeming reward:", error);
    return NextResponse.json(
      { error: "Failed to redeem reward" },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/rewards/\[rewardId\]/redeem/
git commit -m "feat(api): add reward redemption endpoint"
```

### Task 4.3: Implement Member Redemptions and Primary Goal Endpoints

**Files:**

- Create: `src/app/api/v1/families/[familyId]/members/[memberId]/redemptions/route.ts`
- Create: `src/app/api/v1/families/[familyId]/members/[memberId]/primary-goal/route.ts`

**Step 1: Create redemptions history endpoint**

`src/app/api/v1/families/[familyId]/members/[memberId]/redemptions/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { getRedemptionsForMember } from "@/server/services/reward-store-service";

type RouteParams = {
  params: Promise<{ familyId: string; memberId: string }>;
};

/**
 * GET /api/v1/families/[familyId]/members/[memberId]/redemptions
 * Get redemption history for a member
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { familyId, memberId } = await params;

    // Verify caller is family member
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      );

    if (membership.length === 0) {
      return NextResponse.json(
        { error: "Not a family member" },
        { status: 403 }
      );
    }

    // Non-managers can only view their own redemptions
    if (membership[0].role !== "manager" && membership[0].id !== memberId) {
      return NextResponse.json(
        { error: "Can only view own redemptions" },
        { status: 403 }
      );
    }

    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
    const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");

    const redemptions = await getRedemptionsForMember(memberId, {
      limit,
      offset,
    });

    return NextResponse.json({ redemptions });
  } catch (error) {
    console.error("Error fetching redemptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch redemptions" },
      { status: 500 }
    );
  }
}
```

**Step 2: Create primary goal endpoints**

`src/app/api/v1/families/[familyId]/members/[memberId]/primary-goal/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import {
  getPrimaryGoal,
  setPrimaryGoal,
  clearPrimaryGoal,
} from "@/server/services/reward-store-service";
import { setPrimaryGoalSchema } from "@/lib/validations/reward";

type RouteParams = {
  params: Promise<{ familyId: string; memberId: string }>;
};

/**
 * GET /api/v1/families/[familyId]/members/[memberId]/primary-goal
 * Get member's primary goal
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { familyId, memberId } = await params;

    // Verify caller is family member
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      );

    if (membership.length === 0) {
      return NextResponse.json(
        { error: "Not a family member" },
        { status: 403 }
      );
    }

    const goal = await getPrimaryGoal(memberId);

    return NextResponse.json({ goal });
  } catch (error) {
    console.error("Error fetching primary goal:", error);
    return NextResponse.json(
      { error: "Failed to fetch primary goal" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/v1/families/[familyId]/members/[memberId]/primary-goal
 * Set member's primary goal
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { familyId, memberId } = await params;

    // Verify caller is family member
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      );

    if (membership.length === 0) {
      return NextResponse.json(
        { error: "Not a family member" },
        { status: 403 }
      );
    }

    // Can only set own goal (or manager can set for anyone)
    if (membership[0].role !== "manager" && membership[0].id !== memberId) {
      return NextResponse.json(
        { error: "Can only set own primary goal" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parseResult = setPrimaryGoalSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    await setPrimaryGoal(memberId, parseResult.data.rewardId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting primary goal:", error);
    return NextResponse.json(
      { error: "Failed to set primary goal" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/families/[familyId]/members/[memberId]/primary-goal
 * Clear member's primary goal
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { familyId, memberId } = await params;

    // Verify caller is family member
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      );

    if (membership.length === 0) {
      return NextResponse.json(
        { error: "Not a family member" },
        { status: 403 }
      );
    }

    // Can only clear own goal (or manager can clear for anyone)
    if (membership[0].role !== "manager" && membership[0].id !== memberId) {
      return NextResponse.json(
        { error: "Can only clear own primary goal" },
        { status: 403 }
      );
    }

    await clearPrimaryGoal(memberId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing primary goal:", error);
    return NextResponse.json(
      { error: "Failed to clear primary goal" },
      { status: 500 }
    );
  }
}
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add src/app/api/v1/families/\[familyId\]/members/\[memberId\]/redemptions/
git add src/app/api/v1/families/\[familyId\]/members/\[memberId\]/primary-goal/
git commit -m "feat(api): add redemption history and primary goal endpoints"
```

---

## Group 5: Translations

### Task 5.1: Add Reward Store Translations

**Files:**

- Modify: `messages/en.json`
- Modify: `messages/nl.json`

**Step 1: Add English translations**

Add to `messages/en.json`:

```json
{
  "rewardStore": {
    "title": "Reward Store",
    "available": "Available",
    "redeemed": "Redeemed",
    "yourBalance": "Your Balance",
    "starsThisWeek": "stars this week",
    "redeem": "Redeem",
    "needMore": "Need {count} more",
    "availableIn": "Available in {time}",
    "confirmRedeem": "Confirm Redemption",
    "confirmRedeemDescription": "Spend {cost} stars to get {reward}?",
    "balanceAfter": "Balance after: {balance} stars",
    "cancel": "Cancel",
    "redeemNow": "Redeem Now",
    "redeemed": "Redeemed!",
    "redeemedSuccess": "You redeemed {reward}",
    "noRewards": "No rewards available",
    "noRewardsDescription": "Ask a parent to add some rewards!",
    "noRedemptions": "No redemptions yet",
    "noRedemptionsDescription": "Spend your stars on rewards!",
    "createReward": "Create Reward",
    "editReward": "Edit Reward",
    "rewardTitle": "Reward Title",
    "rewardTitlePlaceholder": "e.g., Movie Night",
    "description": "Description",
    "descriptionPlaceholder": "What is this reward?",
    "emoji": "Emoji",
    "starCost": "Star Cost",
    "limitType": "Limit",
    "limitNone": "No limit",
    "limitDaily": "Once per day",
    "limitWeekly": "Once per week",
    "limitMonthly": "Once per month",
    "limitOnce": "One time only",
    "save": "Save",
    "add": "Add",
    "delete": "Delete",
    "confirmDelete": "Delete Reward?",
    "confirmDeleteDescription": "This cannot be undone.",
    "primaryGoal": "Primary Goal",
    "setPrimaryGoal": "Set as Goal",
    "clearPrimaryGoal": "Clear Goal",
    "weeklyEarnings": "Weekly Earnings",
    "recentActivity": "Recent Activity",
    "earned": "Earned",
    "spent": "Spent"
  }
}
```

**Step 2: Add Dutch translations**

Add to `messages/nl.json`:

```json
{
  "rewardStore": {
    "title": "Beloningswinkel",
    "available": "Beschikbaar",
    "redeemed": "Verzilverd",
    "yourBalance": "Jouw Saldo",
    "starsThisWeek": "sterren deze week",
    "redeem": "Verzilveren",
    "needMore": "Nog {count} nodig",
    "availableIn": "Beschikbaar over {time}",
    "confirmRedeem": "Bevestig Verzilvering",
    "confirmRedeemDescription": "{cost} sterren uitgeven voor {reward}?",
    "balanceAfter": "Saldo daarna: {balance} sterren",
    "cancel": "Annuleren",
    "redeemNow": "Nu Verzilveren",
    "redeemed": "Verzilverd!",
    "redeemedSuccess": "Je hebt {reward} verzilverd",
    "noRewards": "Geen beloningen beschikbaar",
    "noRewardsDescription": "Vraag een ouder om beloningen toe te voegen!",
    "noRedemptions": "Nog geen verzilveringen",
    "noRedemptionsDescription": "Geef je sterren uit aan beloningen!",
    "createReward": "Beloning Maken",
    "editReward": "Beloning Bewerken",
    "rewardTitle": "Beloningstitel",
    "rewardTitlePlaceholder": "bijv. Filmavond",
    "description": "Beschrijving",
    "descriptionPlaceholder": "Wat is deze beloning?",
    "emoji": "Emoji",
    "starCost": "Sterrenkost",
    "limitType": "Limiet",
    "limitNone": "Geen limiet",
    "limitDaily": "Eén keer per dag",
    "limitWeekly": "Eén keer per week",
    "limitMonthly": "Eén keer per maand",
    "limitOnce": "Eenmalig",
    "save": "Opslaan",
    "add": "Toevoegen",
    "delete": "Verwijderen",
    "confirmDelete": "Beloning Verwijderen?",
    "confirmDeleteDescription": "Dit kan niet ongedaan worden gemaakt.",
    "primaryGoal": "Primair Doel",
    "setPrimaryGoal": "Als Doel Instellen",
    "clearPrimaryGoal": "Doel Wissen",
    "weeklyEarnings": "Weekelijkse Verdiensten",
    "recentActivity": "Recente Activiteit",
    "earned": "Verdiend",
    "spent": "Uitgegeven"
  }
}
```

**Step 3: Commit**

```bash
git add messages/
git commit -m "feat(i18n): add reward store translations"
```

---

## Group 6: UI Components

### Task 6.1: Create Reward Store Interfaces and Constants

**Files:**

- Create: `src/components/reward-store/interfaces.ts`
- Create: `src/components/reward-store/constants.ts`

**Step 1: Create interfaces**

`src/components/reward-store/interfaces.ts`:

```typescript
import type { LimitType } from "@/lib/validations/reward";

export interface IReward {
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

export interface IRedemption {
  id: string;
  rewardId: string;
  memberId: string;
  starCost: number;
  redeemedAt: Date;
  reward?: {
    title: string;
    emoji: string;
  };
}

export interface IRewardWithStatus extends IReward {
  canRedeem: boolean;
  reason?: "insufficient_stars" | "limit_reached";
  starsNeeded?: number;
  nextAvailable?: Date;
}

export interface IStarTransaction {
  id: string;
  amount: number;
  type: "reward_chart" | "chore" | "bonus" | "redemption";
  description: string;
  createdAt: Date;
}

export type CreateRewardInput = {
  title: string;
  description?: string | null;
  emoji: string;
  starCost: number;
  limitType?: LimitType;
};

export type UpdateRewardInput = Partial<CreateRewardInput> & {
  isActive?: boolean;
};
```

**Step 2: Create constants**

`src/components/reward-store/constants.ts`:

```typescript
export const REWARD_EMOJIS = [
  "🎮",
  "🎬",
  "🍕",
  "🍦",
  "🎁",
  "🏊",
  "🎢",
  "🛹",
  "📱",
  "🎨",
  "⚽",
  "🎪",
  "🧸",
  "🎵",
  "📚",
  "🌟",
] as const;

export const LIMIT_OPTIONS = [
  { value: "none", labelKey: "limitNone" },
  { value: "daily", labelKey: "limitDaily" },
  { value: "weekly", labelKey: "limitWeekly" },
  { value: "monthly", labelKey: "limitMonthly" },
  { value: "once", labelKey: "limitOnce" },
] as const;
```

**Step 3: Commit**

```bash
git add src/components/reward-store/
git commit -m "feat(ui): add reward store interfaces and constants"
```

### Task 6.2: Create Reward Store Context

**Files:**

- Create: `src/components/reward-store/contexts/reward-store-context.tsx`

**Step 1: Create context**

```typescript
"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type {
  IReward,
  IRewardWithStatus,
  IRedemption,
  IStarTransaction,
  CreateRewardInput,
  UpdateRewardInput,
} from "../interfaces";

interface RewardStoreData {
  rewards: IRewardWithStatus[];
  redemptions: IRedemption[];
  balance: number;
  weeklyDelta: number;
  recentTransactions: IStarTransaction[];
  primaryGoal: IReward | null;
}

interface RewardStoreContextValue {
  familyId: string;
  memberId: string;
  data: RewardStoreData;
  isLoading: boolean;
  error: Error | null;
  // Actions
  createReward: (input: CreateRewardInput) => Promise<IReward>;
  updateReward: (id: string, input: UpdateRewardInput) => Promise<IReward>;
  deleteReward: (id: string) => Promise<void>;
  redeemReward: (rewardId: string) => Promise<{ newBalance: number }>;
  setPrimaryGoal: (rewardId: string) => Promise<void>;
  clearPrimaryGoal: () => Promise<void>;
  refreshData: () => Promise<void>;
}

const RewardStoreContext = createContext<RewardStoreContextValue | null>(null);

interface RewardStoreProviderProps {
  children: ReactNode;
  familyId: string;
  memberId: string;
  initialData: RewardStoreData;
}

export function RewardStoreProvider({
  children,
  familyId,
  memberId,
  initialData,
}: RewardStoreProviderProps) {
  const [data, setData] = useState<RewardStoreData>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch rewards with status
      const [rewardsRes, balanceRes, historyRes, goalRes] = await Promise.all([
        fetch(`/api/v1/families/${familyId}/rewards`),
        fetch(`/api/v1/families/${familyId}/members/${memberId}/stars`),
        fetch(`/api/v1/families/${familyId}/members/${memberId}/stars/history?limit=10`),
        fetch(`/api/v1/families/${familyId}/members/${memberId}/primary-goal`),
      ]);

      const [rewardsData, balanceData, historyData, goalData] = await Promise.all([
        rewardsRes.json(),
        balanceRes.json(),
        historyRes.json(),
        goalRes.json(),
      ]);

      // Calculate which rewards can be redeemed
      const rewardsWithStatus: IRewardWithStatus[] = await Promise.all(
        rewardsData.rewards.map(async (reward: IReward) => {
          // Check redemption status
          const canAfford = balanceData.balance >= reward.starCost;
          return {
            ...reward,
            canRedeem: canAfford, // Simplified - full check happens server-side
            reason: canAfford ? undefined : "insufficient_stars",
            starsNeeded: canAfford ? undefined : reward.starCost - balanceData.balance,
          };
        })
      );

      // Calculate weekly delta
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weeklyDelta = (historyData.transactions || [])
        .filter((t: IStarTransaction) => new Date(t.createdAt) >= weekAgo)
        .reduce((sum: number, t: IStarTransaction) => sum + t.amount, 0);

      setData({
        rewards: rewardsWithStatus,
        redemptions: [], // Fetch separately if on redeemed tab
        balance: balanceData.balance,
        weeklyDelta,
        recentTransactions: historyData.transactions || [],
        primaryGoal: goalData.goal,
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load data"));
    } finally {
      setIsLoading(false);
    }
  }, [familyId, memberId]);

  const createReward = useCallback(
    async (input: CreateRewardInput) => {
      const res = await fetch(`/api/v1/families/${familyId}/rewards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create reward");
      }

      const { reward } = await res.json();
      await refreshData();
      return reward;
    },
    [familyId, refreshData]
  );

  const updateReward = useCallback(
    async (id: string, input: UpdateRewardInput) => {
      const res = await fetch(`/api/v1/families/${familyId}/rewards/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update reward");
      }

      const { reward } = await res.json();
      await refreshData();
      return reward;
    },
    [familyId, refreshData]
  );

  const deleteReward = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/v1/families/${familyId}/rewards/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete reward");
      }

      await refreshData();
    },
    [familyId, refreshData]
  );

  const redeemReward = useCallback(
    async (rewardId: string) => {
      const res = await fetch(
        `/api/v1/families/${familyId}/rewards/${rewardId}/redeem`,
        { method: "POST" }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to redeem reward");
      }

      const result = await res.json();
      await refreshData();
      return { newBalance: result.newBalance };
    },
    [familyId, refreshData]
  );

  const setPrimaryGoalFn = useCallback(
    async (rewardId: string) => {
      const res = await fetch(
        `/api/v1/families/${familyId}/members/${memberId}/primary-goal`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rewardId }),
        }
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to set primary goal");
      }

      await refreshData();
    },
    [familyId, memberId, refreshData]
  );

  const clearPrimaryGoal = useCallback(async () => {
    const res = await fetch(
      `/api/v1/families/${familyId}/members/${memberId}/primary-goal`,
      { method: "DELETE" }
    );

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to clear primary goal");
    }

    await refreshData();
  }, [familyId, memberId, refreshData]);

  return (
    <RewardStoreContext.Provider
      value={{
        familyId,
        memberId,
        data,
        isLoading,
        error,
        createReward,
        updateReward,
        deleteReward,
        redeemReward,
        setPrimaryGoal: setPrimaryGoalFn,
        clearPrimaryGoal,
        refreshData,
      }}
    >
      {children}
    </RewardStoreContext.Provider>
  );
}

export function useRewardStore() {
  const context = useContext(RewardStoreContext);
  if (!context) {
    throw new Error("useRewardStore must be used within RewardStoreProvider");
  }
  return context;
}
```

**Step 2: Commit**

```bash
git add src/components/reward-store/contexts/
git commit -m "feat(ui): add reward store context"
```

### Task 6.3: Create Core UI Components

**Files:**

- Create: `src/components/reward-store/star-balance-card.tsx`
- Create: `src/components/reward-store/reward-card.tsx`
- Create: `src/components/reward-store/dialogs/redemption-confirm-dialog.tsx`
- Create: `src/components/reward-store/dialogs/reward-dialog.tsx`

**Step 1: Create StarBalanceCard**

`src/components/reward-store/star-balance-card.tsx`:

```typescript
"use client";

import { Star, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface StarBalanceCardProps {
  balance: number;
  weeklyDelta: number;
  className?: string;
}

export function StarBalanceCard({
  balance,
  weeklyDelta,
  className,
}: StarBalanceCardProps) {
  const t = useTranslations("rewardStore");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 p-6",
        className
      )}
    >
      <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />

      <div className="relative">
        <p className="text-sm font-medium text-muted-foreground">
          {t("yourBalance")}
        </p>

        <div className="mt-2 flex items-baseline gap-2">
          <Star className="h-8 w-8 fill-primary text-primary" />
          <span className="text-4xl font-bold text-foreground">{balance}</span>
        </div>

        {weeklyDelta !== 0 && (
          <div className="mt-3 flex items-center gap-1 text-sm">
            {weeklyDelta > 0 ? (
              <>
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-green-600">+{weeklyDelta}</span>
              </>
            ) : (
              <>
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-red-600">{weeklyDelta}</span>
              </>
            )}
            <span className="text-muted-foreground">{t("starsThisWeek")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create RewardCard**

`src/components/reward-store/reward-card.tsx`:

```typescript
"use client";

import { Star, Clock, Target, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { useTranslations } from "next-intl";
import type { IRewardWithStatus } from "./interfaces";
import { formatDistanceToNow } from "date-fns";

interface RewardCardProps {
  reward: IRewardWithStatus;
  isPrimaryGoal?: boolean;
  onRedeem: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSetGoal?: () => void;
  className?: string;
}

export function RewardCard({
  reward,
  isPrimaryGoal,
  onRedeem,
  onEdit,
  onDelete,
  onSetGoal,
  className,
}: RewardCardProps) {
  const t = useTranslations("rewardStore");
  const { mode } = useInteractionMode();
  const isManageMode = mode === "manage";

  const getButtonContent = () => {
    if (reward.canRedeem) {
      return t("redeem");
    }
    if (reward.reason === "insufficient_stars" && reward.starsNeeded) {
      return t("needMore", { count: reward.starsNeeded });
    }
    if (reward.reason === "limit_reached" && reward.nextAvailable) {
      return t("availableIn", {
        time: formatDistanceToNow(new Date(reward.nextAvailable)),
      });
    }
    return t("redeem");
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition-all",
        !reward.canRedeem && "opacity-60",
        isPrimaryGoal && "ring-2 ring-primary ring-offset-2",
        className
      )}
    >
      {/* Header with emoji and badges */}
      <div className="flex items-start justify-between">
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-xl text-3xl",
            reward.canRedeem
              ? "bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30"
              : "bg-muted grayscale"
          )}
        >
          {reward.emoji}
        </div>

        <div className="flex gap-1">
          {isPrimaryGoal && (
            <Badge variant="secondary" className="gap-1">
              <Target className="h-3 w-3" />
              {t("primaryGoal")}
            </Badge>
          )}
          {reward.limitType !== "none" && (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              {t(`limit${reward.limitType.charAt(0).toUpperCase()}${reward.limitType.slice(1)}`)}
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mt-4">
        <h3 className="text-lg font-semibold">{reward.title}</h3>
        {reward.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {reward.description}
          </p>
        )}
      </div>

      {/* Footer with cost and actions */}
      <div className="mt-4 flex items-center justify-between">
        <div
          className={cn(
            "flex items-center gap-1 text-lg font-bold",
            reward.canRedeem ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Star
            className={cn(
              "h-5 w-5",
              reward.canRedeem && "fill-primary text-primary"
            )}
          />
          {reward.starCost}
        </div>

        <div className="flex gap-2">
          {isManageMode && (
            <>
              {onSetGoal && !isPrimaryGoal && (
                <Button variant="ghost" size="sm" onClick={onSetGoal}>
                  <Target className="h-4 w-4" />
                </Button>
              )}
              {onEdit && (
                <Button variant="ghost" size="sm" onClick={onEdit}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button variant="ghost" size="sm" onClick={onDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
          <Button
            onClick={onRedeem}
            disabled={!reward.canRedeem}
            size="sm"
          >
            {getButtonContent()}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Create RedemptionConfirmDialog**

`src/components/reward-store/dialogs/redemption-confirm-dialog.tsx`:

```typescript
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import type { IReward } from "../interfaces";

interface RedemptionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reward: IReward;
  currentBalance: number;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function RedemptionConfirmDialog({
  open,
  onOpenChange,
  reward,
  currentBalance,
  onConfirm,
  isLoading,
}: RedemptionConfirmDialogProps) {
  const t = useTranslations("rewardStore");
  const balanceAfter = currentBalance - reward.starCost;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-4xl dark:from-amber-900/30 dark:to-orange-900/30">
            {reward.emoji}
          </div>
          <AlertDialogTitle className="text-center">
            {t("confirmRedeem")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {t("confirmRedeemDescription", {
              cost: reward.starCost,
              reward: reward.title,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-4 flex items-center justify-center gap-2 rounded-lg bg-muted p-3">
          <Star className="h-5 w-5 fill-primary text-primary" />
          <span className="font-medium">
            {t("balanceAfter", { balance: balanceAfter })}
          </span>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading}>
            {isLoading ? "..." : t("redeemNow")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
```

**Step 4: Create RewardDialog**

`src/components/reward-store/dialogs/reward-dialog.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { createRewardSchema, type CreateRewardInput } from "@/lib/validations/reward";
import { REWARD_EMOJIS, LIMIT_OPTIONS } from "../constants";
import type { IReward } from "../interfaces";

interface RewardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reward?: IReward;
  onSubmit: (values: CreateRewardInput) => Promise<void>;
}

export function RewardDialog({
  open,
  onOpenChange,
  reward,
  onSubmit,
}: RewardDialogProps) {
  const t = useTranslations("rewardStore");
  const isEditing = !!reward;

  const form = useForm<CreateRewardInput>({
    resolver: zodResolver(createRewardSchema),
    defaultValues: {
      title: "",
      emoji: "🎮",
      starCost: 50,
      description: "",
      limitType: "none",
    },
  });

  useEffect(() => {
    if (open) {
      if (reward) {
        form.reset({
          title: reward.title,
          emoji: reward.emoji,
          starCost: reward.starCost,
          description: reward.description || "",
          limitType: reward.limitType,
        });
      } else {
        form.reset({
          title: "",
          emoji: "🎮",
          starCost: 50,
          description: "",
          limitType: "none",
        });
      }
    }
  }, [open, reward, form]);

  async function handleFormSubmit(values: CreateRewardInput) {
    await onSubmit(values);
    form.reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? t("editReward") : t("createReward")}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleFormSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("rewardTitle")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t("rewardTitlePlaceholder")}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emoji"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("emoji")}</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-8 gap-2">
                      {REWARD_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => field.onChange(emoji)}
                          className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-lg border-2 text-xl transition-colors",
                            field.value === emoji
                              ? "border-primary bg-primary/10"
                              : "border-muted hover:border-muted-foreground/50"
                          )}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="starCost"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("starCost")} ({field.value} ⭐)
                  </FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Slider
                        min={1}
                        max={500}
                        step={5}
                        value={[field.value]}
                        onValueChange={(values) => field.onChange(values[0])}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>1</span>
                        <span>500</span>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="limitType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("limitType")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {LIMIT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {t(option.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("description")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t("descriptionPlaceholder")}
                      className="min-h-20"
                      {...field}
                      value={field.value || ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? "..."
                  : isEditing
                    ? t("save")
                    : t("add")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 5: Commit**

```bash
git add src/components/reward-store/
git commit -m "feat(ui): add reward store core components"
```

### Task 6.4: Create Reward Store Page Component

**Files:**

- Create: `src/components/reward-store/reward-store-page.tsx`
- Create: `src/components/reward-store/index.ts`

**Step 1: Create main page component**

`src/components/reward-store/reward-store-page.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, ShoppingBag, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInteractionMode } from "@/contexts/interaction-mode-context";
import { toast } from "sonner";
import { useRewardStore } from "./contexts/reward-store-context";
import { StarBalanceCard } from "./star-balance-card";
import { RewardCard } from "./reward-card";
import { RewardDialog } from "./dialogs/reward-dialog";
import { RedemptionConfirmDialog } from "./dialogs/redemption-confirm-dialog";
import type { IReward, IRewardWithStatus, CreateRewardInput } from "./interfaces";

export function RewardStorePage() {
  const t = useTranslations("rewardStore");
  const { mode } = useInteractionMode();
  const isManageMode = mode === "manage";

  const {
    data,
    isLoading,
    createReward,
    updateReward,
    deleteReward,
    redeemReward,
    setPrimaryGoal,
  } = useRewardStore();

  const [rewardDialogOpen, setRewardDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<IReward | undefined>();
  const [redeemDialogOpen, setRedeemDialogOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<IRewardWithStatus | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const handleCreateReward = async (input: CreateRewardInput) => {
    try {
      await createReward(input);
      toast.success("Reward created!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create reward");
      throw error;
    }
  };

  const handleUpdateReward = async (input: CreateRewardInput) => {
    if (!editingReward) return;
    try {
      await updateReward(editingReward.id, input);
      toast.success("Reward updated!");
      setEditingReward(undefined);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update reward");
      throw error;
    }
  };

  const handleDeleteReward = async (reward: IReward) => {
    try {
      await deleteReward(reward.id);
      toast.success("Reward deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete reward");
    }
  };

  const handleRedeem = async () => {
    if (!selectedReward) return;
    setIsRedeeming(true);
    try {
      await redeemReward(selectedReward.id);
      toast.success(t("redeemedSuccess", { reward: selectedReward.title }));
      setRedeemDialogOpen(false);
      setSelectedReward(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to redeem");
    } finally {
      setIsRedeeming(false);
    }
  };

  const handleSetPrimaryGoal = async (reward: IReward) => {
    try {
      await setPrimaryGoal(reward.id);
      toast.success("Primary goal set!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to set goal");
    }
  };

  const openRedeemDialog = (reward: IRewardWithStatus) => {
    setSelectedReward(reward);
    setRedeemDialogOpen(true);
  };

  const openEditDialog = (reward: IReward) => {
    setEditingReward(reward);
    setRewardDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header with balance */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
        </div>
        <StarBalanceCard
          balance={data.balance}
          weeklyDelta={data.weeklyDelta}
          className="md:w-64"
        />
      </div>

      {/* Main content with tabs */}
      <Tabs defaultValue="available" className="w-full">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="available" className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              {t("available")}
            </TabsTrigger>
            <TabsTrigger value="redeemed" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              {t("redeemed")}
            </TabsTrigger>
          </TabsList>

          {isManageMode && (
            <Button
              onClick={() => {
                setEditingReward(undefined);
                setRewardDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("createReward")}
            </Button>
          )}
        </div>

        <TabsContent value="available" className="mt-6">
          {data.rewards.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center">
              <ShoppingBag className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">{t("noRewards")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("noRewardsDescription")}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.rewards.map((reward) => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  isPrimaryGoal={data.primaryGoal?.id === reward.id}
                  onRedeem={() => openRedeemDialog(reward)}
                  onEdit={isManageMode ? () => openEditDialog(reward) : undefined}
                  onDelete={isManageMode ? () => handleDeleteReward(reward) : undefined}
                  onSetGoal={
                    isManageMode && data.primaryGoal?.id !== reward.id
                      ? () => handleSetPrimaryGoal(reward)
                      : undefined
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="redeemed" className="mt-6">
          {data.redemptions.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center">
              <CheckCircle className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">{t("noRedemptions")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("noRedemptionsDescription")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.redemptions.map((redemption) => (
                <div
                  key={redemption.id}
                  className="flex items-center gap-4 rounded-lg border bg-card p-4"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-2xl">
                    {redemption.reward?.emoji}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{redemption.reward?.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(redemption.redeemedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">
                    -{redemption.starCost} ⭐
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <RewardDialog
        open={rewardDialogOpen}
        onOpenChange={setRewardDialogOpen}
        reward={editingReward}
        onSubmit={editingReward ? handleUpdateReward : handleCreateReward}
      />

      {selectedReward && (
        <RedemptionConfirmDialog
          open={redeemDialogOpen}
          onOpenChange={setRedeemDialogOpen}
          reward={selectedReward}
          currentBalance={data.balance}
          onConfirm={handleRedeem}
          isLoading={isRedeeming}
        />
      )}
    </div>
  );
}
```

**Step 2: Create index.ts**

`src/components/reward-store/index.ts`:

```typescript
export { RewardStorePage } from "./reward-store-page";
export {
  RewardStoreProvider,
  useRewardStore,
} from "./contexts/reward-store-context";
export * from "./interfaces";
export * from "./constants";
```

**Step 3: Commit**

```bash
git add src/components/reward-store/
git commit -m "feat(ui): add reward store page component"
```

---

## Group 7: Page Route

### Task 7.1: Create Rewards Page Route

**Files:**

- Create: `src/app/[locale]/(app)/rewards/page.tsx`

**Step 1: Create page route**

```typescript
import { setRequestLocale } from "next-intl/server";
import {
  RewardStorePage,
  RewardStoreProvider,
} from "@/components/reward-store";
import { getRewardsForFamily, getPrimaryGoal } from "@/server/services/reward-store-service";
import { getBalance, getHistory } from "@/server/services/star-service";
import { getFamilyMemberByUserId } from "@/server/services/family-service";
import { getSession } from "@/lib/get-session";
import type { Locale } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function RewardsRoute({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  // Session and family are guaranteed by (app) layout
  const session = await getSession();
  const familyId = session!.session.familyId!;

  // Get member
  const member = await getFamilyMemberByUserId(session!.user.id, familyId);
  if (!member) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-lg font-medium text-slate-600">Member not found</p>
      </div>
    );
  }

  // Fetch all data in parallel
  const [rewards, balance, transactions, primaryGoal] = await Promise.all([
    getRewardsForFamily(familyId),
    getBalance(member.id),
    getHistory(member.id, { limit: 10 }),
    getPrimaryGoal(member.id),
  ]);

  // Calculate weekly delta
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklyDelta = transactions
    .filter((t) => t.createdAt >= weekAgo)
    .reduce((sum, t) => sum + t.amount, 0);

  // Map rewards to include redemption status
  const rewardsWithStatus = rewards.map((reward) => ({
    ...reward,
    canRedeem: balance >= reward.starCost,
    reason: balance >= reward.starCost ? undefined : ("insufficient_stars" as const),
    starsNeeded: balance >= reward.starCost ? undefined : reward.starCost - balance,
  }));

  const initialData = {
    rewards: rewardsWithStatus,
    redemptions: [], // Loaded on demand when switching tabs
    balance,
    weeklyDelta,
    recentTransactions: transactions,
    primaryGoal,
  };

  return (
    <RewardStoreProvider
      familyId={familyId}
      memberId={member.id}
      initialData={initialData}
    >
      <RewardStorePage />
    </RewardStoreProvider>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Add navigation link**

Update `src/components/layout/navigation-menu.tsx` to include rewards link.

**Step 4: Commit**

```bash
git add src/app/\[locale\]/\(app\)/rewards/
git commit -m "feat: add rewards page route"
```

---

## Group 8: Final Verification

### Task 8.1: Run All Tests

**Step 1: Run unit tests**

Run: `pnpm test:run`
Expected: All tests pass

**Step 2: Run TypeScript check**

Run: `pnpm tsc --noEmit`
Expected: No errors

**Step 3: Run linter**

Run: `pnpm lint`
Expected: No errors (or only existing warnings)

**Step 4: Run build**

Run: `pnpm build`
Expected: Build succeeds

**Step 5: Manual verification**

1. Start dev server: `pnpm dev`
2. Navigate to `/rewards`
3. Verify:
   - Star balance displays correctly
   - Available rewards show
   - Can create reward (manager mode)
   - Can redeem reward
   - Redemption confirmation works
   - Primary goal can be set

**Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete reward store implementation"
```

---

## Summary

**Total Tasks:** 15 tasks in 8 groups

**Files Created:**

- `src/lib/validations/reward.ts`
- `src/server/services/reward-store-service.ts`
- `src/server/services/__tests__/reward-store-service.test.ts`
- `src/app/api/v1/families/[familyId]/rewards/route.ts`
- `src/app/api/v1/families/[familyId]/rewards/[rewardId]/route.ts`
- `src/app/api/v1/families/[familyId]/rewards/[rewardId]/redeem/route.ts`
- `src/app/api/v1/families/[familyId]/members/[memberId]/redemptions/route.ts`
- `src/app/api/v1/families/[familyId]/members/[memberId]/primary-goal/route.ts`
- `src/components/reward-store/` (all components)
- `src/app/[locale]/(app)/rewards/page.tsx`

**Files Modified:**

- `src/server/schema.ts`
- `messages/en.json`
- `messages/nl.json`
- `drizzle/` (migration)

**Integration Points:**

- Uses `star-service` for balance and transactions
- Uses existing `familyMembers` for authorization
- Uses existing `InteractionModeContext` for manage/wall modes
