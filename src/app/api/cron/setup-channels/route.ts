import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { secureCompare } from "@/lib/crypto";
import "@/lib/env";
import { db } from "@/server/db";
import { googleCalendars, googleCalendarChannels } from "@/server/schema";
import { eq } from "drizzle-orm";
import { createWatchChannel } from "@/server/services/google-channel-service";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Cron job to set up push notification channels for calendars without one
 * Runs daily to catch any calendars that failed initial setup or were added before push notifications
 */
export async function GET(_request: Request) {
  // Verify cron secret
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const providedToken = authHeader?.replace("Bearer ", "") ?? "";

  if (!CRON_SECRET || !secureCompare(providedToken, CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all enabled calendars and existing channels
    const allCalendars = await db
      .select()
      .from(googleCalendars)
      .where(eq(googleCalendars.syncEnabled, true));

    const existingChannels = await db
      .select({ calendarId: googleCalendarChannels.googleCalendarId })
      .from(googleCalendarChannels);

    const channelCalendarIds = new Set(
      existingChannels.map((ch) => ch.calendarId)
    );

    const calendarsNeedingChannels = allCalendars.filter(
      (cal) => !channelCalendarIds.has(cal.id)
    );

    if (calendarsNeedingChannels.length === 0) {
      return NextResponse.json({
        success: true,
        data: { created: 0, failed: 0, message: "All calendars have channels" },
      });
    }

    console.log(
      `Setting up channels for ${calendarsNeedingChannels.length} calendars`
    );

    let created = 0;
    let failed = 0;

    for (const calendar of calendarsNeedingChannels) {
      const result = await createWatchChannel(calendar.id);
      if (result.success) {
        created++;
      } else {
        console.warn(
          `Failed to create channel for ${calendar.name}:`,
          result.error
        );
        failed++;
      }
    }

    console.log(
      `Channel setup completed: ${created} created, ${failed} failed`
    );

    return NextResponse.json({
      success: true,
      data: { created, failed },
    });
  } catch (error) {
    console.error("Channel setup cron failed:", error);
    return NextResponse.json(
      { success: false, error: "Setup job failed" },
      { status: 500 }
    );
  }
}
