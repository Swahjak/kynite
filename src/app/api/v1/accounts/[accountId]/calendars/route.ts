import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { googleCalendars, accounts } from "@/server/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { accountId } = await params;

  // Verify user owns this account
  const account = await db
    .select({ id: accounts.id, userId: accounts.userId })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (account.length === 0 || account[0].userId !== session.user.id) {
    return NextResponse.json(
      { success: false, error: "Account not found" },
      { status: 404 }
    );
  }

  const calendars = await db
    .select({
      id: googleCalendars.id,
      name: googleCalendars.name,
      color: googleCalendars.color,
      syncEnabled: googleCalendars.syncEnabled,
      isPrivate: googleCalendars.isPrivate,
    })
    .from(googleCalendars)
    .where(eq(googleCalendars.accountId, accountId))
    .orderBy(googleCalendars.name);

  return NextResponse.json({
    success: true,
    data: { calendars },
  });
}
