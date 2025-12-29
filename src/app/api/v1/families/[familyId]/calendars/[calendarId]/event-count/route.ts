import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { events } from "@/server/schema";
import { eq, count } from "drizzle-orm";
import { isUserFamilyMember } from "@/server/services/family-service";
import { Errors } from "@/lib/errors";

type RouteParams = {
  params: Promise<{ familyId: string; calendarId: string }>;
};

// GET /api/v1/families/[familyId]/calendars/[calendarId]/event-count
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Errors.unauthorized();
    }

    const { familyId, calendarId } = await params;

    const isMember = await isUserFamilyMember(session.user.id, familyId);
    if (!isMember) {
      return Errors.notFamilyMember();
    }

    const result = await db
      .select({ count: count() })
      .from(events)
      .where(eq(events.googleCalendarId, calendarId));

    return NextResponse.json({
      success: true,
      data: { eventCount: result[0]?.count ?? 0 },
    });
  } catch (error) {
    console.error("Error getting event count:", error);
    return Errors.internal();
  }
}
