import { db } from "@/server/db";
import { googleCalendars, googleCalendarChannels } from "@/server/schema";
import { eq, and, lt } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { randomBytes } from "crypto";
import { getValidAccessToken } from "./google-token-service";
import { GoogleCalendarClient } from "./google-calendar-client";

const WEBHOOK_BASE_URL = process.env.GOOGLE_WEBHOOK_BASE_URL;

// Renew channels 1 hour before expiration
const RENEWAL_BUFFER_MS = 60 * 60 * 1000;

// Default channel TTL: 7 days (Google max varies, typically up to 1 week)
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Generate a secure verification token
 */
function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Create a watch channel for a calendar's events
 */
export async function createWatchChannel(
  calendarId: string
): Promise<{ success: boolean; error?: string }> {
  if (!WEBHOOK_BASE_URL) {
    return { success: false, error: "GOOGLE_WEBHOOK_BASE_URL not configured" };
  }

  const calendar = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.id, calendarId))
    .limit(1);

  if (calendar.length === 0) {
    return { success: false, error: "Calendar not found" };
  }

  const cal = calendar[0];
  const accessToken = await getValidAccessToken(cal.accountId);

  if (!accessToken) {
    return { success: false, error: "Invalid access token" };
  }

  // Stop any existing channel first
  await stopExistingChannel(calendarId);

  const client = new GoogleCalendarClient(accessToken);
  const channelId = createId();
  const token = generateToken();
  const expiration = Date.now() + DEFAULT_TTL_MS;

  try {
    const response = await client.watchEvents(cal.googleCalendarId, {
      id: channelId,
      type: "web_hook",
      address: `${WEBHOOK_BASE_URL}/api/webhooks/google-calendar`,
      token,
      expiration: String(expiration),
    });

    // Store channel in database
    await db.insert(googleCalendarChannels).values({
      id: channelId,
      googleCalendarId: calendarId,
      resourceId: response.resourceId,
      token,
      expiration: new Date(parseInt(response.expiration, 10)),
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to create watch channel:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Stop an existing channel for a calendar
 */
async function stopExistingChannel(calendarId: string): Promise<void> {
  const existing = await db
    .select()
    .from(googleCalendarChannels)
    .where(eq(googleCalendarChannels.googleCalendarId, calendarId))
    .limit(1);

  if (existing.length === 0) return;

  const channel = existing[0];
  const calendar = await db
    .select()
    .from(googleCalendars)
    .where(eq(googleCalendars.id, calendarId))
    .limit(1);

  if (calendar.length > 0) {
    const accessToken = await getValidAccessToken(calendar[0].accountId);
    if (accessToken) {
      const client = new GoogleCalendarClient(accessToken);
      try {
        await client.stopChannel(channel.id, channel.resourceId);
      } catch {
        // Channel may already be expired, continue with cleanup
      }
    }
  }

  // Delete from database
  await db
    .delete(googleCalendarChannels)
    .where(eq(googleCalendarChannels.id, channel.id));
}

/**
 * Stop a channel by ID (called when calendar is unlinked)
 */
export async function stopWatchChannel(calendarId: string): Promise<void> {
  await stopExistingChannel(calendarId);
}

/**
 * Get channels that need renewal (expiring within buffer time)
 */
export async function getChannelsNeedingRenewal() {
  const threshold = new Date(Date.now() + RENEWAL_BUFFER_MS);

  return db
    .select({
      channelId: googleCalendarChannels.id,
      calendarId: googleCalendarChannels.googleCalendarId,
      expiration: googleCalendarChannels.expiration,
    })
    .from(googleCalendarChannels)
    .where(lt(googleCalendarChannels.expiration, threshold));
}

/**
 * Verify webhook notification token
 */
export async function verifyChannelToken(
  channelId: string,
  token: string
): Promise<string | null> {
  const channel = await db
    .select()
    .from(googleCalendarChannels)
    .where(
      and(
        eq(googleCalendarChannels.id, channelId),
        eq(googleCalendarChannels.token, token)
      )
    )
    .limit(1);

  if (channel.length === 0) {
    return null;
  }

  return channel[0].googleCalendarId;
}

/**
 * Get calendar ID for a channel (for sync notifications)
 */
export async function getCalendarIdForChannel(
  channelId: string
): Promise<string | null> {
  const channel = await db
    .select()
    .from(googleCalendarChannels)
    .where(eq(googleCalendarChannels.id, channelId))
    .limit(1);

  return channel.length > 0 ? channel[0].googleCalendarId : null;
}
