import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { getRedemptionsForMember } from "@/server/services/reward-store-service";
import { Errors } from "@/lib/errors";

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

    // Non-managers can only view their own redemptions
    if (membership[0].role !== "manager" && membership[0].id !== memberId) {
      return Errors.forbidden();
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
    return Errors.internal("Failed to fetch redemptions");
  }
}
