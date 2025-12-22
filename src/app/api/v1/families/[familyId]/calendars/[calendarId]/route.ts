import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { googleCalendars, familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";

type RouteParams = {
  params: Promise<{ familyId: string; calendarId: string }>;
};

// PATCH /api/v1/families/[familyId]/calendars/[calendarId] - Toggle sync
export async function PATCH(request: Request, { params }: RouteParams) {
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
    const body = await request.json();
    const { syncEnabled } = body;

    // Verify user is family manager
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id),
          eq(familyMembers.role, "manager")
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Manager access required" },
        },
        { status: 403 }
      );
    }

    const updated = await db
      .update(googleCalendars)
      .set({ syncEnabled, updatedAt: new Date() })
      .where(
        and(
          eq(googleCalendars.id, calendarId),
          eq(googleCalendars.familyId, familyId)
        )
      )
      .returning();

    if (updated.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Calendar not found" },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { calendar: updated[0] },
    });
  } catch (error) {
    console.error("Error updating calendar:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to update calendar" },
      },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/families/[familyId]/calendars/[calendarId] - Remove calendar
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

    // Verify user is family manager
    const membership = await db
      .select()
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, familyId),
          eq(familyMembers.userId, session.user.id),
          eq(familyMembers.role, "manager")
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "Manager access required" },
        },
        { status: 403 }
      );
    }

    await db
      .delete(googleCalendars)
      .where(
        and(
          eq(googleCalendars.id, calendarId),
          eq(googleCalendars.familyId, familyId)
        )
      );

    return NextResponse.json({
      success: true,
      data: { message: "Calendar removed" },
    });
  } catch (error) {
    console.error("Error removing calendar:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to remove calendar" },
      },
      { status: 500 }
    );
  }
}
