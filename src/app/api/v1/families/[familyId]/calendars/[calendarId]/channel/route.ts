import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  googleCalendars,
  googleCalendarChannels,
  familyMembers,
} from "@/server/schema";
import { eq, and } from "drizzle-orm";
import {
  createWatchChannel,
  stopWatchChannel,
} from "@/server/services/google-channel-service";

type RouteParams = {
  params: Promise<{ familyId: string; calendarId: string }>;
};

/**
 * GET - Get channel status for a calendar
 */
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, calendarId } = await params;

    // Verify user is family member
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Not a family member" },
        },
        { status: 403 }
      );
    }

    // Get channel status
    const channel = await db
      .select()
      .from(googleCalendarChannels)
      .where(eq(googleCalendarChannels.googleCalendarId, calendarId))
      .limit(1);

    if (channel.length === 0) {
      return NextResponse.json({
        success: true,
        data: { active: false },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        active: true,
        expiration: channel[0].expiration.toISOString(),
        expiresIn: channel[0].expiration.getTime() - Date.now(),
      },
    });
  } catch (error) {
    console.error("Error getting channel status:", error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to get channel status",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Create/recreate channel for a calendar
 */
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, calendarId } = await params;

    // Verify user is manager
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      )
      .limit(1);

    if (membership.length === 0 || membership[0].role !== "manager") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Manager role required" },
        },
        { status: 403 }
      );
    }

    // Verify calendar exists
    const calendar = await db
      .select()
      .from(googleCalendars)
      .where(
        and(
          eq(googleCalendars.id, calendarId),
          eq(googleCalendars.familyId, familyId)
        )
      )
      .limit(1);

    if (calendar.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Calendar not found" },
        },
        { status: 404 }
      );
    }

    const result = await createWatchChannel(calendarId);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CHANNEL_ERROR", message: result.error },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: "Push notification channel created" },
    });
  } catch (error) {
    console.error("Error creating channel:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to create channel" },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Stop channel for a calendar
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    const { familyId, calendarId } = await params;

    // Verify user is manager
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id)
        )
      )
      .limit(1);

    if (membership.length === 0 || membership[0].role !== "manager") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Manager role required" },
        },
        { status: 403 }
      );
    }

    await stopWatchChannel(calendarId);

    return NextResponse.json({
      success: true,
      data: { message: "Push notification channel stopped" },
    });
  } catch (error) {
    console.error("Error stopping channel:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to stop channel" },
      },
      { status: 500 }
    );
  }
}
