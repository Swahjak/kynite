// src/app/api/v1/families/[familyId]/members/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import {
  getFamilyMembers,
  isUserFamilyMember,
  isUserFamilyManager,
  addMemberToFamily,
} from "@/server/services/family-service";
import { db } from "@/server/db";
import { users } from "@/server/schema";
import { eq } from "drizzle-orm";
import type { FamilyMemberRole } from "@/types/family";
import { Errors } from "@/lib/errors";

type Params = { params: Promise<{ familyId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    const { familyId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return Errors.notFamilyMember();
    }

    const members = await getFamilyMembers(familyId);

    return NextResponse.json({
      success: true,
      data: { members },
    });
  } catch (error) {
    console.error("Error listing members:", error);
    return Errors.internal("Failed to list members");
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    const { familyId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return Errors.managerRequired();
    }

    const body = await request.json();

    // Validate body has userId and role
    if (!body.userId || typeof body.userId !== "string") {
      return Errors.validation({ userId: "userId is required" });
    }

    const role = (body.role || "participant") as FamilyMemberRole;
    if (!["manager", "participant", "caregiver"].includes(role)) {
      return Errors.validation({
        role: "role must be 'manager', 'participant', or 'caregiver'",
      });
    }

    // Check if user exists
    const userExists = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, body.userId))
      .limit(1);

    if (userExists.length === 0) {
      return Errors.notFound("user");
    }

    // Check if user is already a member
    const alreadyMember = await isUserFamilyMember(body.userId, familyId);
    if (alreadyMember) {
      return Errors.validation({
        userId: "User is already a member of this family",
      });
    }

    const member = await addMemberToFamily(familyId, body.userId, role);

    return NextResponse.json(
      {
        success: true,
        data: { member },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error adding member:", error);
    return Errors.internal("Failed to add member");
  }
}
