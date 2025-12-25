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
import { Errors } from "@/lib/errors";

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
      return Errors.unauthorized();
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
      return Errors.notFamilyMember();
    }

    const goal = await getPrimaryGoal(memberId);

    return NextResponse.json({ goal });
  } catch (error) {
    console.error("Error fetching primary goal:", error);
    return Errors.internal("Failed to fetch primary goal");
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
      return Errors.unauthorized();
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
      return Errors.notFamilyMember();
    }

    // Can only set own goal (or manager can set for anyone)
    if (membership[0].role !== "manager" && membership[0].id !== memberId) {
      return Errors.forbidden();
    }

    const body = await request.json();
    const parseResult = setPrimaryGoalSchema.safeParse(body);

    if (!parseResult.success) {
      return Errors.validation(parseResult.error.flatten());
    }

    await setPrimaryGoal(memberId, parseResult.data.rewardId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting primary goal:", error);
    return Errors.internal("Failed to set primary goal");
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
      return Errors.unauthorized();
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
      return Errors.notFamilyMember();
    }

    // Can only clear own goal (or manager can clear for anyone)
    if (membership[0].role !== "manager" && membership[0].id !== memberId) {
      return Errors.forbidden();
    }

    await clearPrimaryGoal(memberId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing primary goal:", error);
    return Errors.internal("Failed to clear primary goal");
  }
}
