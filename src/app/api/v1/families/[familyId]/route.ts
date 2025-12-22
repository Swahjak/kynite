// src/app/api/v1/families/[familyId]/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { families, familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { updateFamilySchema } from "@/lib/validations/family";
import {
  getFamilyMembers,
  isUserFamilyMember,
  isUserFamilyManager,
} from "@/server/services/family-service";

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

    const family = await db
      .select()
      .from(families)
      .where(eq(families.id, familyId))
      .limit(1);

    if (family.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Family not found" },
        },
        { status: 404 }
      );
    }

    const members = await getFamilyMembers(familyId);
    const currentMember = members.find((m) => m.userId === session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        family: family[0],
        members,
        currentUserRole: currentMember?.role,
      },
    });
  } catch (error) {
    console.error("Error getting family:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to get family" },
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
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
            message: "Only managers can update the family",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateFamilySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0].message,
          },
        },
        { status: 400 }
      );
    }

    await db
      .update(families)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(eq(families.id, familyId));

    const family = await db
      .select()
      .from(families)
      .where(eq(families.id, familyId))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: { family: family[0] },
    });
  } catch (error) {
    console.error("Error updating family:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to update family" },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
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
            message: "Only managers can delete the family",
          },
        },
        { status: 403 }
      );
    }

    // Delete family (cascade will delete members and invites)
    await db.delete(families).where(eq(families.id, familyId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting family:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to delete family" },
      },
      { status: 500 }
    );
  }
}
