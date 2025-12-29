import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { secureCompare } from "@/lib/crypto";
import "@/lib/env";
import { extendRecurringEvents } from "@/server/jobs/extend-recurring-events";

const CRON_SECRET = process.env.CRON_SECRET;

// Vercel Cron config
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes

/**
 * Cron job to extend recurring events horizon.
 * Runs weekly to generate new occurrences for patterns approaching their generation horizon.
 *
 * Recommended cron schedule: "0 2 * * 0" (weekly on Sunday at 2 AM)
 */
export async function GET(_request: Request) {
  // Verify cron secret for security
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const providedToken = authHeader?.replace("Bearer ", "") ?? "";

  if (CRON_SECRET && !secureCompare(providedToken, CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await extendRecurringEvents();

    console.log(
      `[CRON] Extended ${result.patternsExtended} patterns, created ${result.eventsCreated} events`
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("[CRON] Error extending recurring events:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to extend recurring events",
      },
      { status: 500 }
    );
  }
}
