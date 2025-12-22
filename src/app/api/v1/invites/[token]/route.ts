// src/app/api/v1/invites/[token]/route.ts

import { NextResponse } from "next/server";
import { getInviteByToken } from "@/server/services/family-service";

type Params = { params: Promise<{ token: string }> };

/**
 * GET /api/v1/invites/[token]
 * Validate an invite token (public endpoint, checks expiry and max uses)
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const now = new Date();

    const invite = await getInviteByToken(token);

    if (!invite) {
      return NextResponse.json({
        success: true,
        data: {
          valid: false,
          reason: "Invite not found",
        },
      });
    }

    // Check expiration
    if (invite.expiresAt && invite.expiresAt < now) {
      return NextResponse.json({
        success: true,
        data: {
          valid: false,
          reason: "Invite has expired",
        },
      });
    }

    // Check max uses
    if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
      return NextResponse.json({
        success: true,
        data: {
          valid: false,
          reason: "Invite has reached maximum uses",
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        familyName: invite.familyName,
        familyId: invite.familyId,
      },
    });
  } catch (error) {
    console.error("Error validating invite:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to validate invite",
        },
      },
      { status: 500 }
    );
  }
}
