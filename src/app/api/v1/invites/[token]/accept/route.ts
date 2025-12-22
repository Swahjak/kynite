// src/app/api/v1/invites/[token]/accept/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { families } from "@/server/schema";
import { eq } from "drizzle-orm";
import { acceptInvite } from "@/server/services/family-service";

type Params = { params: Promise<{ token: string }> };

/**
 * POST /api/v1/invites/[token]/accept
 * Accept an invite and join the family (authenticated users only)
 */
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

    const { token } = await params;

    try {
      const result = await acceptInvite(token, session.user.id);

      // Get full family details
      const family = await db
        .select()
        .from(families)
        .where(eq(families.id, result.familyId))
        .limit(1);

      return NextResponse.json(
        {
          success: true,
          data: {
            family: family[0],
            membership: result.member,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      // Handle specific errors from acceptInvite
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("Invite not found")) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "INVALID_INVITE", message: "Invite not found" },
          },
          { status: 400 }
        );
      }

      if (errorMessage.includes("has expired")) {
        return NextResponse.json(
          {
            success: false,
            error: { code: "EXPIRED_INVITE", message: "Invite has expired" },
          },
          { status: 400 }
        );
      }

      if (errorMessage.includes("maximum uses")) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "MAX_USES_REACHED",
              message: "Invite has reached maximum uses",
            },
          },
          { status: 400 }
        );
      }

      if (errorMessage.includes("already a member")) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "ALREADY_MEMBER",
              message: "You are already a member of this family",
            },
          },
          { status: 400 }
        );
      }

      // Unknown error, rethrow to be caught by outer catch
      throw error;
    }
  } catch (error) {
    console.error("Error accepting invite:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to accept invite" },
      },
      { status: 500 }
    );
  }
}
