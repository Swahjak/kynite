import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { googleCalendars, familyMembers } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import {
  performIncrementalSync,
  performInitialSync,
} from "@/server/services/google-sync-service";
import { Errors } from "@/lib/errors";

type RouteParams = {
  params: Promise<{ familyId: string; calendarId: string }>;
};

// POST /api/v1/families/[familyId]/calendars/[calendarId]/sync - Trigger sync
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Errors.unauthorized();
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
      return Errors.notFamilyMember();
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
      return Errors.notFound("calendar");
    }

    // Perform sync (initial or incremental based on sync cursor)
    const result = calendar[0].syncCursor
      ? await performIncrementalSync(calendarId)
      : await performInitialSync(calendarId);

    if (result.error) {
      return Errors.googleError({ syncError: result.error });
    }

    return NextResponse.json({
      success: true,
      data: {
        eventsCreated: result.eventsCreated,
        eventsUpdated: result.eventsUpdated,
        eventsDeleted: result.eventsDeleted,
      },
    });
  } catch (error) {
    console.error("Error triggering sync:", error);
    return Errors.internal(error);
  }
}
