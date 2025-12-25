// src/app/api/v1/families/[familyId]/children/[childMemberId]/upgrade-token/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { isUserFamilyManager } from "@/server/services/family-service";
import { createUpgradeToken } from "@/server/services/child-service";
import { Errors } from "@/lib/errors";

type Params = {
  params: Promise<{ familyId: string; childMemberId: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    const { familyId, childMemberId } = await params;

    // Only managers can create upgrade tokens
    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return Errors.managerRequired();
    }

    // Get the child member
    const childMember = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.id, childMemberId),
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.role, "child")
        )
      )
      .limit(1);

    if (childMember.length === 0) {
      return Errors.notFound("child member");
    }

    const upgradeToken = await createUpgradeToken(
      childMember[0].userId,
      session.user.id
    );

    return NextResponse.json(
      {
        success: true,
        data: {
          token: upgradeToken.token,
          expiresAt: upgradeToken.expiresAt,
          linkUrl: `/link-account?token=${upgradeToken.token}`,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating upgrade token:", error);
    return Errors.internal("Failed to create upgrade token");
  }
}
