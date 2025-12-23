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
