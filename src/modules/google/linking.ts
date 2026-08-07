import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { stopChannel, watchCalendar } from './channels';
import { enqueueCalendarSync } from './jobs';
import type { GoogleIdentity, TokenResponse } from './oauth';
import { findAccountByGoogleUserId } from './queries';
import { calendar, googleAccount, type GoogleAccount } from './schema';
import { discoverCalendars } from './sync';
import { encryptForStorage } from './tokens';

/**
 * Account linking (docs/architecture.md §5 "OAuth"), called by the OAuth
 * callback route once the code has been exchanged.
 *
 * Re-linking an already-linked identity is an *update*, not a second row: it is
 * how a `reauth_required` account is repaired, and it must keep the calendars
 * (and their sync tokens) that hang off it.
 */

export async function linkGoogleAccount({
  familyId,
  memberId,
  identity,
  tokens,
}: {
  familyId: string;
  memberId: string;
  identity: GoogleIdentity;
  tokens: TokenResponse;
}): Promise<GoogleAccount> {
  const db = getDb();

  // M04 carry-forward: scoped by family, because `google_user_id` is unique
  // per family — the same identity may serve two households.
  const existing = await findAccountByGoogleUserId(familyId, identity.googleUserId);

  const secrets = {
    accessToken: encryptForStorage(tokens.accessToken),
    ...(tokens.refreshToken ? { refreshToken: encryptForStorage(tokens.refreshToken) } : {}),
    tokenExpiresAt: tokens.expiresAt,
    scopes: tokens.scopes,
    status: 'active' as const,
    email: identity.email,
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db
      .update(googleAccount)
      .set(secrets)
      .where(eq(googleAccount.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(googleAccount)
    .values({
      familyId,
      ownerMemberId: memberId,
      googleUserId: identity.googleUserId,
      ...secrets,
    })
    .returning();

  return created;
}

/**
 * Discover the account's calendars, then register a push channel and queue an
 * initial sync for each one that is enabled. Best effort per calendar: one
 * calendar that refuses a `watch` must not abort the link.
 */
export async function bootstrapAccount(accountId: string): Promise<{ calendars: number }> {
  const calendars = await discoverCalendars(accountId);

  for (const row of calendars) {
    if (!row.syncEnabled) continue;
    await watchCalendar(row).catch(() => {
      // No channel means we fall back to the 15-minute poll — degraded, not
      // broken, and the renewal job retries every 30 minutes.
    });
    await enqueueCalendarSync(row.id).catch((error: unknown) => {
      // Same reasoning as the `watch` above, and found the same way (M17's
      // sync smoke): the account is linked and its calendars are stored by the
      // time we get here, so a queue that is unavailable — a web-only process
      // with `JOBS_ENABLED=false`, a boss that has not declared its queues yet
      // — is a *delayed first sync*, not a failed link. Letting it throw made
      // the callback redirect to `?error=linkFailed` over a household whose
      // Google account was, in fact, connected. The 15-minute poll picks the
      // calendar up regardless.
      console.error('[google] initial sync could not be queued', error);
    });
  }

  return { calendars: calendars.length };
}

/** Unlink: the row's calendars and their events cascade away with it (§3). */
export async function unlinkGoogleAccount(accountId: string): Promise<void> {
  const db = getDb();
  const rows = await db.select().from(calendar).where(eq(calendar.googleAccountId, accountId));

  for (const row of rows) {
    if (!row.channelId || !row.channelResourceId) continue;
    // Stop the channel before the row disappears, or Google keeps notifying a
    // calendar we can no longer resolve.
    await stopChannel(row).catch(() => {});
  }

  await db.delete(googleAccount).where(eq(googleAccount.id, accountId));
}
