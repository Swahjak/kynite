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
import { Errors } from "@/lib/errors";

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
      return Errors.unauthorized();
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
      return Errors.notFamilyMember();
    }

    const includeInactive =
      request.nextUrl.searchParams.get("includeInactive") === "true";
    const rewards = await getRewardsForFamily(familyId, includeInactive);

    return NextResponse.json({ rewards });
  } catch (error) {
    console.error("Error fetching rewards:", error);
    return Errors.internal(error);
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
      return Errors.unauthorized();
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
      return Errors.managerRequired();
    }

    const body = await request.json();
    const parseResult = createRewardSchema.safeParse(body);

    if (!parseResult.success) {
      return Errors.validation(parseResult.error.flatten());
    }

    const reward = await createReward(familyId, parseResult.data);

    return NextResponse.json({ reward }, { status: 201 });
  } catch (error) {
    console.error("Error creating reward:", error);
    return Errors.internal(error);
  }
}
