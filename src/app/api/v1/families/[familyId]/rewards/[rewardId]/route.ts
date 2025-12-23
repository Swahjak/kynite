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
