import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  getCalendarsNeedingSync,
  performIncrementalSync,
} from "@/server/services/google-sync-service";

// Vercel cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

// GET /api/cron/sync-calendars - Triggered by cron every hour
export async function GET(_request: Request) {
  // Verify cron secret
  const headersList = await headers();
  const authHeader = headersList.get("authorization");

  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const calendars = await getCalendarsNeedingSync(5);

    const results = await Promise.allSettled(
      calendars.map((cal) => performIncrementalSync(cal.id))
    );

    const summary = {
      total: calendars.length,
      successful: results.filter(
        (r) => r.status === "fulfilled" && !r.value.error && r.value.complete
      ).length,
      incomplete: results.filter(
        (r) => r.status === "fulfilled" && !r.value.error && !r.value.complete
      ).length,
      failed: results.filter(
        (r) =>
          r.status === "rejected" || (r.status === "fulfilled" && r.value.error)
      ).length,
    };

    console.log("Cron sync completed:", summary);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Cron sync failed:", error);
    return NextResponse.json(
      { success: false, error: "Sync job failed" },
      { status: 500 }
    );
  }
}
