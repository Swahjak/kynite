// src/app/api/v1/families/[familyId]/members/[memberId]/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { updateMemberSchema } from "@/lib/validations/family";
import {
  isUserFamilyManager,
  updateMember,
  removeMember,
} from "@/server/services/family-service";
import type { FamilyMemberRole } from "@/types/family";

type Params = { params: Promise<{ familyId: string; memberId: string }> };

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

    const { familyId, memberId } = await params;

    // Get the target member
    const targetMember = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.id, memberId),
          eq(familyMembers.familyId, familyId)
        )
      )
      .limit(1);

    if (targetMember.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Member not found" },
        },
        { status: 404 }
      );
    }

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    const isSelf = targetMember[0].userId === session.user.id;

    // Only managers can edit others, anyone can edit themselves (except role)
    if (!isManager && !isSelf) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Cannot edit this member" },
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateMemberSchema.safeParse(body);

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

    // Non-managers cannot change roles
    if (parsed.data.role && !isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can change roles",
          },
        },
        { status: 403 }
      );
    }

    // Check last manager constraint
    if (
      parsed.data.role &&
      parsed.data.role !== "manager" &&
      targetMember[0].role === "manager"
    ) {
      const managerCount = await db
        .select({ id: familyMembers.id })
        .from(familyMembers)
        .where(
          and(
            eq(familyMembers.familyId, familyId),
            eq(familyMembers.role, "manager")
          )
        );

      if (managerCount.length <= 1) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "LAST_MANAGER",
              message: "Cannot demote the last manager",
            },
          },
          { status: 400 }
        );
      }
    }

    const updated = await updateMember(memberId, {
      displayName: parsed.data.displayName,
      avatarColor: parsed.data.avatarColor,
      role: parsed.data.role as FamilyMemberRole | undefined,
    });

    return NextResponse.json({
      success: true,
      data: { member: updated },
    });
  } catch (error) {
    console.error("Error updating member:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to update member" },
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

    const { familyId, memberId } = await params;

    // Get the target member
    const targetMember = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.id, memberId),
          eq(familyMembers.familyId, familyId)
        )
      )
      .limit(1);

    if (targetMember.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Member not found" },
        },
        { status: 404 }
      );
    }

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    const isSelf = targetMember[0].userId === session.user.id;

    // Only managers can remove others, anyone can leave (remove themselves)
    if (!isManager && !isSelf) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Cannot remove this member" },
        },
        { status: 403 }
      );
    }

    // Check last manager constraint
    if (targetMember[0].role === "manager") {
      const managerCount = await db
        .select({ id: familyMembers.id })
        .from(familyMembers)
        .where(
          and(
            eq(familyMembers.familyId, familyId),
            eq(familyMembers.role, "manager")
          )
        );

      if (managerCount.length <= 1) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "LAST_MANAGER",
              message:
                "Cannot remove the last manager. Assign another manager first.",
            },
          },
          { status: 400 }
        );
      }
    }

    await removeMember(memberId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to remove member" },
      },
      { status: 500 }
    );
  }
}
