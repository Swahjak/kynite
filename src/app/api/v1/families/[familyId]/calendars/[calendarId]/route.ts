import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { googleCalendars, familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { stopWatchChannel } from "@/server/services/google-channel-service";
import { Errors } from "@/lib/errors";

type RouteParams = {
  params: Promise<{ familyId: string; calendarId: string }>;
};

// PATCH /api/v1/families/[familyId]/calendars/[calendarId] - Toggle sync
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Errors.unauthorized();
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
      return Errors.managerRequired();
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
      return Errors.notFound("calendar");
    }

    return NextResponse.json({
      success: true,
      data: { calendar: updated[0] },
    });
  } catch (error) {
    console.error("Error updating calendar:", error);
    return Errors.internal(error);
  }
}

// DELETE /api/v1/families/[familyId]/calendars/[calendarId] - Remove calendar
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Errors.unauthorized();
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
      return Errors.managerRequired();
    }

    // Stop push notification channel
    await stopWatchChannel(calendarId);

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
    return Errors.internal(error);
  }
}
