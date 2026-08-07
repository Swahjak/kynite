import 'server-only';
import webpush from 'web-push';
import { assertPushConfigured } from './config';
import { outcomeForStatus, type DeliveryOutcome } from './domain/delivery';
import type { PushPayload } from './queues';

/**
 * The `web-push` boundary (docs/architecture.md §6 step 3).
 *
 * One function's worth of surface, behind a `PushTransport` seam. The seam is
 * not decoration: the whole delivery *policy* (delete on gone, disable after
 * three) is only testable if a test can say "this endpoint returns 410"
 * without a real push service, and the integration suite must never reach the
 * network (§9).
 */

export type PushTarget = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** What one attempt reports back. `statusCode` is absent for a transport throw. */
export type PushAttempt = { statusCode?: number; error?: string };

export type PushTransport = (target: PushTarget, payload: PushPayload) => Promise<PushAttempt>;

/** The real one. Reads VAPID config at call time, never at import time. */
export const webPushTransport: PushTransport = async (target, payload) => {
  const config = assertPushConfigured();

  try {
    const result = await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      JSON.stringify(payload),
      {
        vapidDetails: {
          subject: config.subject,
          publicKey: config.publicKey,
          privateKey: config.privateKey,
        },
        // A reminder that arrives an hour late is worse than one that never
        // arrives. The lead is about a minute (`LOOK_AHEAD_MS`), so five
        // minutes of TTL is already generous: past it the routine has started
        // and the notification would only be telling a household about its own
        // past.
        TTL: 300,
      }
    );

    return { statusCode: result.statusCode };
  } catch (error: unknown) {
    // `web-push` throws a `WebPushError` carrying the service's status code.
    // That status is the entire signal (`404`/`410` = gone), so it is read off
    // the error rather than collapsed into "it failed".
    const statusCode =
      typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode: unknown }).statusCode)
        : undefined;

    return {
      statusCode: Number.isFinite(statusCode) ? statusCode : undefined,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export async function sendToSubscription(
  target: PushTarget,
  payload: PushPayload,
  transport: PushTransport = webPushTransport
): Promise<DeliveryOutcome> {
  const attempt = await transport(target, payload);
  return outcomeForStatus(attempt.statusCode);
}
