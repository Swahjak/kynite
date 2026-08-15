import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, lt, or, isNull } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { channelTokenFor, googleConfig } from './config';
import { GoogleApiError } from './domain/errors';
import { apiForAccount, isGoogleBacked } from './sync';
import { calendar, googleAccount, type Calendar } from './schema';

/**
 * Push channels (docs/architecture.md §5 "Push channels" / "Renewal +
 * fallback").
 *
 * Google caps `events.watch` at ~7 days and one missed renewal is silent sync
 * death (risk §11.2) — which is why the 15-minute poll is not optional and why
 * the renewal window is generous.
 */

/** §5: re-watch anything expiring within 2 hours. */
export const RENEWAL_WINDOW_MS = 2 * 60 * 60 * 1000;

/**
 * Register (or re-register) a channel for one calendar. Idempotent: the
 * previous channel is stopped first, so a renewal never leaves Google sending
 * duplicate notifications to a channel id we have forgotten.
 */
export async function watchCalendar(row: Calendar): Promise<Calendar | null> {
  // A household calendar has no remote to watch (M23).
  if (!row.syncEnabled || !isGoogleBacked(row)) return null;

  const api = apiForAccount(row.googleAccountId);
  const { webhookAddress } = googleConfig();

  if (row.channelId && row.channelResourceId) {
    await api.stopChannel(row.channelId, row.channelResourceId).catch((error: unknown) => {
      // A channel that is already gone is the state we wanted anyway.
      if (!(error instanceof GoogleApiError) || !error.isNotFound) throw error;
    });
  }

  const channelId = randomUUID();
  const channel = await api.watch({
    calendarId: row.googleCalendarId,
    channelId,
    address: webhookAddress,
    token: channelTokenFor(channelId),
  });

  const [updated] = await getDb()
    .update(calendar)
    .set({
      channelId: channel.id,
      channelResourceId: channel.resourceId,
      channelExpiration: channel.expiration ? new Date(Number(channel.expiration)) : null,
      updatedAt: new Date(),
    })
    .where(eq(calendar.id, row.id))
    .returning();

  return updated ?? null;
}

/** The `google:renew-channels` job body (every 30 min). */
export async function renewExpiringChannels(now: Date = new Date()): Promise<{
  renewed: number;
  failed: number;
}> {
  const cutoff = new Date(now.getTime() + RENEWAL_WINDOW_MS);

  const rows = await getDb()
    .select()
    .from(calendar)
    .innerJoin(googleAccount, eq(calendar.googleAccountId, googleAccount.id))
    .where(
      and(
        eq(calendar.syncEnabled, true),
        eq(googleAccount.status, 'active'),
        or(
          // Never watched; watched but with no known expiration (a channel
          // row we cannot otherwise judge as fresh, so it is treated as due —
          // this predicate previously required `channelExpiration IS NOT
          // NULL`, which meant a `channelId` set with a NULL expiration was
          // *never* renewed); or watched and now expiring.
          isNull(calendar.channelId),
          isNull(calendar.channelExpiration),
          lt(calendar.channelExpiration, cutoff)
        )
      )
    )
    .then((joined) => joined.map((entry) => entry.calendar));

  let renewed = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await watchCalendar(row);
      renewed += 1;
    } catch {
      // One dead calendar must not stop the renewal sweep; the 15-minute poll
      // keeps its data fresh until the next pass succeeds.
      failed += 1;
    }
  }

  return { renewed, failed };
}

/** Stop a channel and forget it — used when a calendar is disabled or unlinked. */
export async function stopChannel(row: Calendar): Promise<void> {
  if (row.channelId && row.channelResourceId && isGoogleBacked(row)) {
    await apiForAccount(row.googleAccountId)
      .stopChannel(row.channelId, row.channelResourceId)
      .catch(() => {
        // Best effort: the channel expires on its own within 7 days.
      });
  }

  await getDb()
    .update(calendar)
    .set({
      channelId: null,
      channelResourceId: null,
      channelExpiration: null,
      updatedAt: new Date(),
    })
    .where(eq(calendar.id, row.id));
}
