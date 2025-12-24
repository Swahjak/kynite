// src/app/api/v1/families/[familyId]/invites/route.ts

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { familyInvites } from "@/server/schema";
import { eq, and, or, gt, isNull } from "drizzle-orm";
import { createInviteSchema } from "@/lib/validations/family";
import {
  isUserFamilyManager,
  createInvite,
} from "@/server/services/family-service";
import { getInviteUrl } from "@/lib/invite-token";
import { getNonDeviceSession } from "@/lib/api-auth";

type Params = { params: Promise<{ familyId: string }> };

/**
 * POST /api/v1/families/[familyId]/invites
 * Create a new invite for the family (manager only)
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { session, errorResponse } = await getNonDeviceSession();
    if (errorResponse) return errorResponse;

    const { familyId } = await params;

    const isManager = await isUserFamilyManager(session!.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can create invites",
          },
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = createInviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid invite data",
            details: parsed.error.format(),
          },
        },
        { status: 400 }
      );
    }

    const invite = await createInvite(familyId, session!.user.id, {
      expiresInDays: parsed.data.expiresInDays,
      maxUses: parsed.data.maxUses,
    });

    const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    const url = getInviteUrl(invite.token, baseUrl);

    return NextResponse.json(
      {
        success: true,
        data: {
          invite: {
            id: invite.id,
            token: invite.token,
            expiresAt: invite.expiresAt,
            maxUses: invite.maxUses,
            useCount: invite.useCount,
          },
          url,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating invite:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create invite" },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/families/[familyId]/invites
 * List active invites for the family (manager only)
 */
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

    const isManager = await isUserFamilyManager(session!.user.id, familyId);
    if (!isManager) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Only managers can view invites",
          },
        },
        { status: 403 }
      );
    }

    const now = new Date();

    // Get active invites (not expired and not maxed out)
    const invites = await db
      .select({
        id: familyInvites.id,
        token: familyInvites.token,
        createdById: familyInvites.createdById,
        expiresAt: familyInvites.expiresAt,
        maxUses: familyInvites.maxUses,
        useCount: familyInvites.useCount,
        createdAt: familyInvites.createdAt,
      })
      .from(familyInvites)
      .where(
        and(
          eq(familyInvites.familyId, familyId),
          // Not expired: either no expiry or expiry is in the future
          or(isNull(familyInvites.expiresAt), gt(familyInvites.expiresAt, now))
        )
      )
      .orderBy(familyInvites.createdAt);

    // Filter out invites that have reached max uses
    const activeInvites = invites.filter(
      (invite) => invite.maxUses === null || invite.useCount < invite.maxUses
    );

    // Add URLs to each invite
    const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3000";
    const invitesWithUrls = activeInvites.map((invite) => ({
      ...invite,
      url: getInviteUrl(invite.token, baseUrl),
    }));

    return NextResponse.json({
      success: true,
      data: { invites: invitesWithUrls },
    });
  } catch (error) {
    console.error("Error listing invites:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to list invites" },
      },
      { status: 500 }
    );
  }
}
