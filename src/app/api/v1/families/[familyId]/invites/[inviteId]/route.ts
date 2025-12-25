// src/app/api/v1/families/[familyId]/invites/[inviteId]/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyInvites } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import {
  isUserFamilyManager,
  deleteInvite,
} from "@/server/services/family-service";
import { getNonDeviceSession } from "@/lib/api-auth";
import { Errors } from "@/lib/errors";

type Params = { params: Promise<{ familyId: string; inviteId: string }> };

/**
 * DELETE /api/v1/families/[familyId]/invites/[inviteId]
 * Delete an invite (manager only)
 */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { session, errorResponse } = await getNonDeviceSession();
    if (errorResponse) return errorResponse;

    const { familyId, inviteId } = await params;

    const isManager = await isUserFamilyManager(session!.user.id, familyId);
    if (!isManager) {
      return Errors.managerRequired();
    }

    // Verify invite belongs to this family before deleting
    const invite = await db
      .select({ id: familyInvites.id })
      .from(familyInvites)
      .where(
        and(
          eq(familyInvites.id, inviteId),
          eq(familyInvites.familyId, familyId)
        )
      )
      .limit(1);

    if (invite.length === 0) {
      return Errors.notFound("invite");
    }

    await deleteInvite(inviteId);

    return NextResponse.json({
      success: true,
      data: { message: "Invite deleted successfully" },
    });
  } catch (error) {
    console.error("Error deleting invite:", error);
    return Errors.internal(error);
  }
}
