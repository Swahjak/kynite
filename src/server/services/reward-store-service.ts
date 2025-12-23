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
