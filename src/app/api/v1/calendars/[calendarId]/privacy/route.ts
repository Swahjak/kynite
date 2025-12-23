import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { googleCalendars, accounts } from "@/server/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updatePrivacySchema = z.object({
  isPrivate: z.boolean(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ calendarId: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { calendarId } = await params;

  const body = await request.json();
  const parsed = updatePrivacySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid request body" },
      { status: 400 }
    );
  }

  // Verify user owns this calendar (via their account)
  const calendar = await db
    .select({
      id: googleCalendars.id,
      accountUserId: accounts.userId,
    })
    .from(googleCalendars)
    .innerJoin(accounts, eq(googleCalendars.accountId, accounts.id))
    .where(eq(googleCalendars.id, calendarId))
    .limit(1);

  if (calendar.length === 0) {
    return NextResponse.json(
      { success: false, error: "Calendar not found" },
      { status: 404 }
    );
  }

  if (calendar[0].accountUserId !== session.user.id) {
    return NextResponse.json(
      { success: false, error: "You can only modify your own calendars" },
      { status: 403 }
    );
  }

  await db
    .update(googleCalendars)
    .set({
      isPrivate: parsed.data.isPrivate,
      updatedAt: new Date(),
    })
    .where(eq(googleCalendars.id, calendarId));

  return NextResponse.json({
    success: true,
    data: { isPrivate: parsed.data.isPrivate },
  });
}
