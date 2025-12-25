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
import { Errors } from "@/lib/errors";

type RouteParams = {
  params: Promise<{ familyId: string; rewardId: string }>;
};

/**
 * POST /api/v1/families/[familyId]/rewards/[rewardId]/redeem
 * Redeem a reward for a member.
 *
 * - Regular members redeem for themselves
 * - Managers and devices can redeem on behalf of any child member
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return Errors.unauthorized();
    }

    const { familyId, rewardId } = await params;

    // Get caller's membership
    const callerMembership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      );

    if (callerMembership.length === 0) {
      return Errors.notFamilyMember();
    }

    const caller = callerMembership[0];
    const canRedeemForOthers =
      caller.role === "manager" || caller.role === "device";

    // Parse request body for memberId (optional)
    let targetMemberId = caller.id;

    try {
      const body = await request.json();
      if (body.memberId && typeof body.memberId === "string") {
        // Validate that caller can redeem on behalf of this member
        if (!canRedeemForOthers && body.memberId !== caller.id) {
          return Errors.forbidden("You can only redeem rewards for yourself");
        }

        // Validate that target member exists and is in the same family
        if (body.memberId !== caller.id) {
          const targetMember = await db
            .select()
            .from(familyMembers)
            .where(
              and(
                eq(familyMembers.id, body.memberId),
                eq(familyMembers.familyId, familyId)
              )
            );

          if (targetMember.length === 0) {
            return Errors.notFound("member");
          }

          targetMemberId = body.memberId;
        }
      }
    } catch {
      // No body or invalid JSON - use caller's memberId (backward compatible)
    }

    const result = await redeemReward(targetMemberId, rewardId);

    return NextResponse.json({
      success: true,
      redemption: result.redemption,
      newBalance: result.newBalance,
    });
  } catch (error) {
    if (error instanceof RedemptionError) {
      let message = "";

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
          return Errors.notFound("reward");
        case "reward_inactive":
          message = "This reward is no longer available";
          break;
      }

      return Errors.badRequest({ reason: error.reason, message });
    }

    console.error("Error redeeming reward:", error);
    return Errors.internal(error);
  }
}
