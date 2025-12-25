// src/app/api/v1/invites/[token]/accept/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { families } from "@/server/schema";
import { eq } from "drizzle-orm";
import { acceptInvite } from "@/server/services/family-service";
import { Errors } from "@/lib/errors";

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
      return Errors.unauthorized();
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

      if (
        errorMessage.includes("Invite not found") ||
        errorMessage.includes("has expired") ||
        errorMessage.includes("maximum uses") ||
        errorMessage.includes("already a member")
      ) {
        return Errors.badRequest(errorMessage);
      }

      // Unknown error, rethrow to be caught by outer catch
      throw error;
    }
  } catch (error) {
    console.error("Error accepting invite:", error);
    return Errors.internal(error);
  }
}
