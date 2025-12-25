import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { accounts } from "@/server/schema";
import { eq } from "drizzle-orm";
import { Errors } from "@/lib/errors";
import type { LinkedAccountsResponse } from "@/types/accounts";

// GET /api/v1/accounts/linked - List linked Google accounts
export async function GET(): Promise<NextResponse<LinkedAccountsResponse>> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return Errors.unauthorized();
    }

    const linkedAccounts = await db
      .select({
        id: accounts.id,
        accountId: accounts.accountId,
        providerId: accounts.providerId,
        scope: accounts.scope,
        createdAt: accounts.createdAt,
      })
      .from(accounts)
      .where(eq(accounts.userId, session.user.id));

    // Filter to only Google accounts and format response
    const googleAccounts = linkedAccounts
      .filter((acc) => acc.providerId === "google")
      .map((acc) => ({
        id: acc.id,
        googleAccountId: acc.accountId,
        scopes: acc.scope?.split(" ") || [],
        linkedAt: acc.createdAt,
      }));

    return NextResponse.json({
      success: true,
      data: {
        accounts: googleAccounts,
        count: googleAccounts.length,
      },
    });
  } catch (error) {
    console.error("Error fetching linked accounts:", error);
    return Errors.internal(error);
  }
}
