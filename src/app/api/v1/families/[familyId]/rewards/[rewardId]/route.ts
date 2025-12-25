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
import { Errors } from "@/lib/errors";

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
      return Errors.unauthorized();
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
      return Errors.notFamilyMember();
    }

    const reward = await getRewardById(rewardId);

    if (!reward) {
      return Errors.notFound("reward");
    }

    return NextResponse.json({ reward });
  } catch (error) {
    console.error("Error fetching reward:", error);
    return Errors.internal(error);
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
      return Errors.unauthorized();
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
      return Errors.managerRequired();
    }

    const body = await request.json();
    const parseResult = updateRewardSchema.safeParse(body);

    if (!parseResult.success) {
      return Errors.validation(parseResult.error.flatten());
    }

    const reward = await updateReward(rewardId, parseResult.data);

    return NextResponse.json({ reward });
  } catch (error) {
    console.error("Error updating reward:", error);
    return Errors.internal(error);
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
      return Errors.unauthorized();
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
      return Errors.managerRequired();
    }

    await deleteReward(rewardId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reward:", error);
    return Errors.internal(error);
  }
}
