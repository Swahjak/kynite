import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { accounts } from "@/server/schema";
import { and, eq } from "drizzle-orm";
import type { AccountOperationResponse } from "@/types/accounts";

type RouteParams = {
  params: Promise<{ accountId: string }>;
};

// DELETE /api/v1/accounts/linked/[accountId] - Unlink a Google account
export async function DELETE(
  _request: Request,
  { params }: RouteParams
): Promise<NextResponse<AccountOperationResponse>> {
  try {
    const { accountId } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        },
        { status: 401 }
      );
    }

    // Verify the account belongs to this user and is a Google account
    const existingAccount = await db
      .select()
      .from(accounts)
      .where(
        and(
          eq(accounts.id, accountId),
          eq(accounts.userId, session.user.id),
          eq(accounts.providerId, "google")
        )
      )
      .limit(1);

    if (existingAccount.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_FOUND", message: "Account not found" },
        },
        { status: 404 }
      );
    }

    // Prevent unlinking the only Google account
    const googleAccountCount = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, session.user.id),
          eq(accounts.providerId, "google")
        )
      );

    if (googleAccountCount.length <= 1) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CANNOT_UNLINK_PRIMARY",
            message: "Cannot unlink your only Google account",
          },
        },
        { status: 400 }
      );
    }

    // Delete the linked account
    await db
      .delete(accounts)
      .where(
        and(eq(accounts.id, accountId), eq(accounts.userId, session.user.id))
      );

    return NextResponse.json({
      success: true,
      data: { message: "Account unlinked successfully" },
    });
  } catch (error) {
    console.error("Error unlinking account:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to unlink account" },
      },
      { status: 500 }
    );
  }
}
