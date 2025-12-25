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
import { Errors } from "@/lib/errors";

type Params = { params: Promise<{ familyId: string; memberId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
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
      return Errors.notFound("member");
    }

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    const isSelf = targetMember[0].userId === session.user.id;

    // Only managers can edit others, anyone can edit themselves (except role)
    if (!isManager && !isSelf) {
      return Errors.forbidden();
    }

    const body = await request.json();
    const parsed = updateMemberSchema.safeParse(body);

    if (!parsed.success) {
      return Errors.validation(parsed.error.flatten());
    }

    // Sanitize SVG if provided
    let sanitizedSvg: string | null | undefined = parsed.data.avatarSvg;
    if (parsed.data.avatarSvg) {
      // Dynamic import to avoid ESM compatibility issues during build
      const { isValidSvg, sanitizeSvg } = await import("@/lib/svg-sanitizer");

      if (!isValidSvg(parsed.data.avatarSvg)) {
        return Errors.validation({
          avatarSvg: "Invalid SVG format",
        });
      }
      sanitizedSvg = sanitizeSvg(parsed.data.avatarSvg);
    }

    // Non-managers cannot change roles
    if (parsed.data.role && !isManager) {
      return Errors.managerRequired();
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
        return Errors.validation({
          role: "Cannot demote the last manager",
        });
      }
    }

    const updated = await updateMember(memberId, {
      displayName: parsed.data.displayName,
      avatarColor: parsed.data.avatarColor,
      avatarSvg: sanitizedSvg,
      role: parsed.data.role as FamilyMemberRole | undefined,
    });

    return NextResponse.json({
      success: true,
      data: { member: updated },
    });
  } catch (error) {
    console.error("Error updating member:", error);
    return Errors.internal("Failed to update member");
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
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
      return Errors.notFound("member");
    }

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    const isSelf = targetMember[0].userId === session.user.id;

    // Only managers can remove others, anyone can leave (remove themselves)
    if (!isManager && !isSelf) {
      return Errors.forbidden();
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
        return Errors.validation({
          member:
            "Cannot remove the last manager. Assign another manager first.",
        });
      }
    }

    await removeMember(memberId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing member:", error);
    return Errors.internal("Failed to remove member");
  }
}
