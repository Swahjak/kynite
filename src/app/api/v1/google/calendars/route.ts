import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { getValidAccessToken } from "@/server/services/google-token-service";
import { GoogleCalendarClient } from "@/server/services/google-calendar-client";
import { db } from "@/server/db";
import { accounts } from "@/server/schema";
import { eq, and } from "drizzle-orm";
import { Errors } from "@/lib/errors";

// GET /api/v1/google/calendars?accountId=xxx
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return Errors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");

    if (!accountId) {
      return Errors.badRequest({ message: "accountId required" });
    }

    // Verify account belongs to user
    const account = await db
      .select()
      .from(accounts)
      .where(
        and(eq(accounts.id, accountId), eq(accounts.userId, session.user.id))
      )
      .limit(1);

    if (account.length === 0) {
      return Errors.notFound("Account");
    }

    const accessToken = await getValidAccessToken(accountId);
    if (!accessToken) {
      return Errors.unauthorized({ reason: "Could not get valid token" });
    }

    const client = new GoogleCalendarClient(accessToken);
    const calendars = await client.listCalendars();

    return NextResponse.json({
      success: true,
      data: {
        calendars: calendars.items.map((cal) => ({
          id: cal.id,
          name: cal.summary,
          color: cal.backgroundColor,
          accessRole: cal.accessRole,
          primary: cal.primary ?? false,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching Google calendars:", error);
    return Errors.googleError(error);
  }
}
