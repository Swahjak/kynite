import { db } from "@/server/db";
import {
  starTransactions,
  memberStarBalances,
  familyMembers,
} from "@/server/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import type {
  AddStarsInput,
  StarHistoryQueryInput,
} from "@/lib/validations/star";
import type { StarTransaction } from "@/server/schema";

// =============================================================================
// BALANCE OPERATIONS
// =============================================================================

/**
 * Get the current star balance for a member
 */
export async function getBalance(memberId: string): Promise<number> {
  const results = await db
    .select()
    .from(memberStarBalances)
    .where(eq(memberStarBalances.memberId, memberId));

  return results[0]?.balance ?? 0;
}

// =============================================================================
// TRANSACTION OPERATIONS
// =============================================================================

/**
 * Add stars to a member's balance (earning)
 */
export async function addStars(
  input: AddStarsInput
): Promise<{ transaction: StarTransaction; newBalance: number }> {
  if (input.amount <= 0) {
    throw new Error("Amount must be positive");
  }

  // Get family ID for the member
  const members = await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.id, input.memberId));

  if (members.length === 0) {
    throw new Error("Member not found");
  }

  const familyId = members[0].familyId;

  return await db.transaction(async (tx) => {
    // Create transaction record
    const [transaction] = await tx
      .insert(starTransactions)
      .values({
        id: createId(),
        familyId,
        memberId: input.memberId,
        amount: input.amount,
        type: input.type,
        referenceId: input.referenceId ?? null,
        description: input.description,
        awardedById: input.awardedById ?? null,
        createdAt: new Date(),
      })
      .returning();

    // Get current balance
    const balanceRecords = await tx
      .select()
      .from(memberStarBalances)
      .where(eq(memberStarBalances.memberId, input.memberId));

    const currentBalance = balanceRecords[0]?.balance ?? 0;
    const newBalance = currentBalance + input.amount;

    // Upsert balance
    if (balanceRecords.length === 0) {
      await tx.insert(memberStarBalances).values({
        memberId: input.memberId,
        balance: newBalance,
        updatedAt: new Date(),
      });
    } else {
      await tx
        .update(memberStarBalances)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(memberStarBalances.memberId, input.memberId));
    }

    return { transaction, newBalance };
  });
}

// =============================================================================
// ERRORS
// =============================================================================

export class InsufficientStarsError extends Error {
  constructor(
    public balance: number,
    public required: number
  ) {
    super(`Insufficient stars: have ${balance}, need ${required}`);
    this.name = "InsufficientStarsError";
  }
}

// =============================================================================
// REMOVE STARS
// =============================================================================

/**
 * Remove stars from a member's balance (spending)
 */
export async function removeStars(input: {
  memberId: string;
  amount: number;
  type: "redemption";
  referenceId: string;
  description: string;
}): Promise<{ transaction: StarTransaction; newBalance: number }> {
  if (input.amount <= 0) {
    throw new Error("Amount must be positive");
  }

  // Get family ID for the member
  const members = await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.id, input.memberId));

  if (members.length === 0) {
    throw new Error("Member not found");
  }

  const familyId = members[0].familyId;

  return await db.transaction(async (tx) => {
    // Get current balance
    const balanceRecords = await tx
      .select()
      .from(memberStarBalances)
      .where(eq(memberStarBalances.memberId, input.memberId));

    const currentBalance = balanceRecords[0]?.balance ?? 0;

    if (currentBalance < input.amount) {
      throw new InsufficientStarsError(currentBalance, input.amount);
    }

    const newBalance = currentBalance - input.amount;

    // Create transaction record (negative amount)
    const [transaction] = await tx
      .insert(starTransactions)
      .values({
        id: createId(),
        familyId,
        memberId: input.memberId,
        amount: -input.amount,
        type: input.type,
        referenceId: input.referenceId,
        description: input.description,
        awardedById: null,
        createdAt: new Date(),
      })
      .returning();

    // Update balance
    await tx
      .update(memberStarBalances)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(memberStarBalances.memberId, input.memberId));

    return { transaction, newBalance };
  });
}

// =============================================================================
// HISTORY OPERATIONS
// =============================================================================

/**
 * Get transaction history for a member
 */
export async function getHistory(
  memberId: string,
  options?: StarHistoryQueryInput
): Promise<StarTransaction[]> {
  const conditions = [eq(starTransactions.memberId, memberId)];

  if (options?.type) {
    conditions.push(eq(starTransactions.type, options.type));
  }

  if (options?.startDate) {
    conditions.push(
      gte(starTransactions.createdAt, new Date(options.startDate))
    );
  }

  if (options?.endDate) {
    const endOfDay = new Date(options.endDate);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(starTransactions.createdAt, endOfDay));
  }

  return await db
    .select()
    .from(starTransactions)
    .where(and(...conditions))
    .orderBy(desc(starTransactions.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);
}
