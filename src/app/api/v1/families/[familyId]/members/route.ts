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

type Params = { params: Promise<{ familyId: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a member of this family" },
        },
        { status: 403 }
      );
    }

    const members = await getFamilyMembers(familyId);

    return NextResponse.json({
      success: true,
      data: { members },
    });
  } catch (error) {
    console.error("Error listing members:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to list members" },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can add members",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate body has userId and role
    if (!body.userId || typeof body.userId !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "userId is required" },
        },
        { status: 400 }
      );
    }

    const role = (body.role || "participant") as FamilyMemberRole;
    if (!["manager", "participant", "caregiver"].includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "role must be 'manager', 'participant', or 'caregiver'",
          },
        },
        { status: 400 }
      );
    }

    // Check if user exists
    const userExists = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, body.userId))
      .limit(1);

    if (userExists.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "User not found" },
        },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const alreadyMember = await isUserFamilyMember(body.userId, familyId);
    if (alreadyMember) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ALREADY_MEMBER",
            message: "User is already a member of this family",
          },
        },
        { status: 400 }
      );
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
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to add member" },
      },
      { status: 500 }
    );
  }
}
