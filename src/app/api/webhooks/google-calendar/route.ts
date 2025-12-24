import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  verifyChannelToken,
  getCalendarIdForChannel,
} from "@/server/services/google-channel-service";
import { performIncrementalSync } from "@/server/services/google-sync-service";

/**
 * Google Calendar Push Notification Webhook
 * @see https://developers.google.com/workspace/calendar/api/guides/push
 *
 * Headers received:
 * - X-Goog-Channel-ID: Our channel UUID
 * - X-Goog-Channel-Token: Our verification token
 * - X-Goog-Resource-State: 'sync' | 'exists' | 'not_exists'
 * - X-Goog-Resource-ID: Google's resource identifier
 * - X-Goog-Message-Number: Notification sequence number
 */
export async function POST(_request: Request) {
  const headersList = await headers();

  const channelId = headersList.get("x-goog-channel-id");
  const token = headersList.get("x-goog-channel-token");
  const resourceState = headersList.get("x-goog-resource-state");
  const messageNumber = headersList.get("x-goog-message-number");

  // Log notification receipt
  console.log("Google Calendar webhook received:", {
    channelId,
    resourceState,
    messageNumber,
  });

  // Validate required headers
  if (!channelId || !token) {
    console.warn("Webhook missing required headers");
    return new NextResponse(null, { status: 400 });
  }

  // Verify token matches our stored token
  const calendarId = await verifyChannelToken(channelId, token);

  if (!calendarId) {
    console.warn("Webhook token verification failed:", channelId);
    // Still return 200 to prevent Google from retrying
    return new NextResponse(null, { status: 200 });
  }

  // Handle different resource states
  if (resourceState === "sync") {
    // Initial sync message - channel successfully created
    console.log("Channel sync confirmed for calendar:", calendarId);
    return new NextResponse(null, { status: 200 });
  }

  if (resourceState === "exists") {
    // Resource changed - trigger incremental sync
    console.log("Triggering incremental sync for calendar:", calendarId);

    // Run sync in background (don't block webhook response)
    performIncrementalSync(calendarId)
      .then((result) => {
        console.log("Webhook-triggered sync completed:", {
          calendarId,
          created: result.eventsCreated,
          updated: result.eventsUpdated,
          deleted: result.eventsDeleted,
          error: result.error,
        });
      })
      .catch((error) => {
        console.error("Webhook-triggered sync failed:", calendarId, error);
      });

    return new NextResponse(null, { status: 200 });
  }

  if (resourceState === "not_exists") {
    // Resource was deleted - could indicate calendar was deleted
    console.warn("Resource not_exists for calendar:", calendarId);
    return new NextResponse(null, { status: 200 });
  }

  // Unknown state - acknowledge anyway
  return new NextResponse(null, { status: 200 });
}

// Google also sends GET for webhook verification during setup
export async function GET() {
  return new NextResponse(null, { status: 200 });
}
