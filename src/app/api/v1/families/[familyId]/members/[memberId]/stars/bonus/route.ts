import { NextRequest, NextResponse } from "next/server";
import { addStars } from "@/server/services/star-service";
import { grantBonusStarsSchema } from "@/lib/validations/star";
import { auth } from "@/server/auth";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { Errors } from "@/lib/errors";

type RouteParams = {
  params: Promise<{ familyId: string; memberId: string }>;
};

/**
 * POST /api/v1/families/[familyId]/members/[memberId]/stars/bonus
 * Award bonus stars to a family member (managers only)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) {
      return Errors.unauthorized();
    }

    const { familyId, memberId } = await params;

    // Verify caller is a manager in this family
    const callerMembership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      );

    if (
      callerMembership.length === 0 ||
      callerMembership[0].role !== "manager"
    ) {
      return Errors.managerRequired();
    }

    const body = await request.json();
    const parseResult = grantBonusStarsSchema.safeParse(body);

    if (!parseResult.success) {
      return Errors.validation(parseResult.error.flatten());
    }

    const result = await addStars({
      memberId,
      amount: parseResult.data.amount,
      type: "bonus",
      description: parseResult.data.description,
      awardedById: callerMembership[0].id,
    });

    return NextResponse.json({
      success: true,
      transaction: result.transaction,
      newBalance: result.newBalance,
    });
  } catch (error) {
    console.error("Error awarding bonus stars:", error);
    return Errors.internal("Failed to award bonus stars");
  }
}
