import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { secureCompare } from "@/lib/crypto";
import "@/lib/env";
import {
  getChannelsNeedingRenewal,
  createWatchChannel,
} from "@/server/services/google-channel-service";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Cron job to renew expiring push notification channels
 * Runs every hour to renew channels expiring within 1 hour
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
    const channelsToRenew = await getChannelsNeedingRenewal();

    if (channelsToRenew.length === 0) {
      return NextResponse.json({
        success: true,
        data: { renewed: 0, failed: 0 },
      });
    }

    console.log(`Renewing ${channelsToRenew.length} expiring channels`);

    const results = await Promise.allSettled(
      channelsToRenew.map((channel) => createWatchChannel(channel.calendarId))
    );

    const summary = {
      renewed: results.filter(
        (r) => r.status === "fulfilled" && r.value.success
      ).length,
      failed: results.filter(
        (r) =>
          r.status === "rejected" ||
          (r.status === "fulfilled" && !r.value.success)
      ).length,
    };

    console.log("Channel renewal completed:", summary);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Channel renewal failed:", error);
    return NextResponse.json(
      { success: false, error: "Renewal job failed" },
      { status: 500 }
    );
  }
}
