import { safeEqual } from '../crypto';

/**
 * Push-notification validation (docs/architecture.md §5 "Push channels").
 *
 * Pure so the whole decision table is unit-tested: the route handler does one
 * indexed lookup, calls this, and enqueues. Nothing else — Google retries
 * aggressively on a slow webhook, so the handler must never sync inline.
 *
 * Notifications are content-free by design; the body is ignored entirely.
 */

export const CHANNEL_ID_HEADER = 'x-goog-channel-id';
export const CHANNEL_TOKEN_HEADER = 'x-goog-channel-token';
export const RESOURCE_ID_HEADER = 'x-goog-resource-id';
export const RESOURCE_STATE_HEADER = 'x-goog-resource-state';

export type ChannelNotification = {
  channelId: string | null;
  channelToken: string | null;
  resourceId: string | null;
  /** `sync` on channel creation, `exists` for a change. */
  resourceState: string | null;
};

export type ChannelRegistration = {
  calendarId: string;
  channelResourceId: string | null;
  /** The token we derived for this channel (`channelTokenFor`). */
  expectedToken: string;
  syncEnabled: boolean;
};

export type NotificationDecision =
  | { action: 'sync'; calendarId: string }
  /** Valid but nothing to do — the handshake ping, or a paused calendar. */
  | { action: 'ignore'; reason: string }
  /** Rejected. Still answered with 200 (see the route), but never acted on. */
  | { action: 'reject'; reason: string };

export function readNotification(headers: Headers): ChannelNotification {
  return {
    channelId: headers.get(CHANNEL_ID_HEADER),
    channelToken: headers.get(CHANNEL_TOKEN_HEADER),
    resourceId: headers.get(RESOURCE_ID_HEADER),
    resourceState: headers.get(RESOURCE_STATE_HEADER),
  };
}

export function decideNotification(
  notification: ChannelNotification,
  registration: ChannelRegistration | null
): NotificationDecision {
  if (!notification.channelId) return { action: 'reject', reason: 'missing_channel_id' };
  if (!registration) return { action: 'reject', reason: 'unknown_channel' };

  // The shared secret first: an attacker who guesses a channel id must still
  // produce the token. Constant-time, because it is a secret comparison.
  if (
    !notification.channelToken ||
    !safeEqual(notification.channelToken, registration.expectedToken)
  ) {
    return { action: 'reject', reason: 'bad_channel_token' };
  }

  // §5: "match X-Goog-Resource-ID". A replayed notification from a stale
  // channel carries the wrong resource for this calendar.
  if (
    registration.channelResourceId &&
    (!notification.resourceId ||
      !safeEqual(notification.resourceId, registration.channelResourceId))
  ) {
    return { action: 'reject', reason: 'resource_id_mismatch' };
  }

  // The `sync` state is Google acknowledging the watch; there is no change yet.
  if (notification.resourceState === 'sync') {
    return { action: 'ignore', reason: 'channel_handshake' };
  }

  if (!registration.syncEnabled) return { action: 'ignore', reason: 'sync_disabled' };

  return { action: 'sync', calendarId: registration.calendarId };
}
