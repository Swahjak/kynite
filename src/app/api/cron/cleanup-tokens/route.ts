import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { secureCompare } from "@/lib/crypto";
import "@/lib/env";
import { db } from "@/server/db";
import { childUpgradeTokens } from "@/server/schema";
import { lt } from "drizzle-orm";

// Vercel cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

// DELETE expired upgrade tokens older than 7 days
// This prevents database bloat from unused/expired tokens
// GET /api/cron/cleanup-tokens - Triggered daily at 4am
export async function GET(_request: Request) {
  // Verify cron secret
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const providedToken = authHeader?.replace("Bearer ", "") ?? "";

  if (!CRON_SECRET || !secureCompare(providedToken, CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Delete tokens that expired more than 7 days ago
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const deleted = await db
      .delete(childUpgradeTokens)
      .where(lt(childUpgradeTokens.expiresAt, cutoffDate))
      .returning({ id: childUpgradeTokens.id });

    const summary = {
      deletedCount: deleted.length,
      cutoffDate: cutoffDate.toISOString(),
    };

    console.log("Token cleanup completed:", summary);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Token cleanup failed:", error);
    return NextResponse.json(
      { success: false, error: "Cleanup job failed" },
      { status: 500 }
    );
  }
}
