import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { googleCalendars, familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

type RouteParams = { params: Promise<{ familyId: string }> };

// GET /api/v1/families/[familyId]/calendars - List synced calendars
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

    const { familyId } = await params;

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

    const calendars = await db
      .select()
      .from(googleCalendars)
      .where(eq(googleCalendars.familyId, familyId));

    return NextResponse.json({
      success: true,
      data: { calendars },
    });
  } catch (error) {
    console.error("Error fetching family calendars:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to fetch calendars" },
      },
      { status: 500 }
    );
  }
}

// POST /api/v1/families/[familyId]/calendars - Add calendar to sync
export async function POST(request: Request, { params }: RouteParams) {
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

    const { familyId } = await params;
    const body = await request.json();
    const { accountId, googleCalendarId, name, color, accessRole } = body;

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

    // Check if calendar already linked
    const existing = await db
      .select()
      .from(googleCalendars)
      .where(
        and(
          eq(googleCalendars.familyId, familyId),
          eq(googleCalendars.accountId, accountId),
          eq(googleCalendars.googleCalendarId, googleCalendarId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CONFLICT", message: "Calendar already linked" },
        },
        { status: 409 }
      );
    }

    const newCalendar = await db
      .insert(googleCalendars)
      .values({
        id: createId(),
        familyId,
        accountId,
        googleCalendarId,
        name,
        color,
        accessRole: accessRole || "reader",
        syncEnabled: true,
      })
      .returning();

    return NextResponse.json({
      success: true,
      data: { calendar: newCalendar[0] },
    });
  } catch (error) {
    console.error("Error adding calendar:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to add calendar" },
      },
      { status: 500 }
    );
  }
}
