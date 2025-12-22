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

type Params = { params: Promise<{ familyId: string; inviteId: string }> };

/**
 * DELETE /api/v1/families/[familyId]/invites/[inviteId]
 * Delete an invite (manager only)
 */
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

    const { familyId, inviteId } = await params;

    const isManager = await isUserFamilyManager(session.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can delete invites",
          },
        },
        { status: 403 }
      );
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
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Invite not found" },
        },
        { status: 404 }
      );
    }

    await deleteInvite(inviteId);

    return NextResponse.json({
      success: true,
      data: { message: "Invite deleted successfully" },
    });
  } catch (error) {
    console.error("Error deleting invite:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to delete invite" },
      },
      { status: 500 }
    );
  }
}
