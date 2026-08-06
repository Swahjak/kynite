import 'server-only';
import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { googleConfig } from './config';
import { decryptToken, encryptToken } from './crypto';
import { GoogleAuthError } from './domain/errors';
import { refreshAccessToken, type TokenResponse } from './oauth';
import { googleAccount, type GoogleAccount } from './schema';

/**
 * Token storage and refresh (docs/architecture.md §5: "Tokens encrypted at
 * rest … refreshed lazily with a single-flight lock per account").
 *
 * **Single flight.** A webhook burst can start five syncs for the same account
 * within a second. Without a lock each one refreshes, and Google invalidates
 * all but the last — so the other four jobs fail with a token that was valid
 * when they read it. The in-process map collapses them onto one refresh.
 *
 * The lock is per process, which is the right scope for §10's single-process
 * deployment. A second process would refresh once more, not incorrectly: the
 * database write is last-one-wins and every holder still gets a live token.
 */

/** Refresh when the token expires within this window (also the job's predicate). */
export const REFRESH_WINDOW_MS = 10 * 60 * 1000;

const inFlight = new Map<string, Promise<string>>();

export class GoogleReauthRequiredError extends Error {
  readonly accountId: string;

  constructor(accountId: string) {
    super(`Google account ${accountId} needs to be linked again`);
    this.name = 'GoogleReauthRequiredError';
    this.accountId = accountId;
  }
}

export function encryptForStorage(plaintext: string): string {
  return encryptToken(plaintext, googleConfig().encryptionKey);
}

export function decryptFromStorage(ciphertext: string): string {
  return decryptToken(ciphertext, googleConfig().encryptionKey);
}

/** §5: `invalid_grant` ends the account until a human links it again. */
export async function markReauthRequired(accountId: string): Promise<void> {
  await getDb()
    .update(googleAccount)
    .set({ status: 'reauth_required', updatedAt: new Date() })
    .where(eq(googleAccount.id, accountId));
}

async function loadAccount(accountId: string): Promise<GoogleAccount> {
  const [row] = await getDb()
    .select()
    .from(googleAccount)
    .where(eq(googleAccount.id, accountId))
    .limit(1);

  if (!row) throw new Error(`google account ${accountId} not found`);
  return row;
}

/** Persist a refresh result. Google omits `refresh_token` on refresh — keep ours. */
export async function persistTokens(accountId: string, tokens: TokenResponse): Promise<void> {
  await getDb()
    .update(googleAccount)
    .set({
      accessToken: encryptForStorage(tokens.accessToken),
      ...(tokens.refreshToken ? { refreshToken: encryptForStorage(tokens.refreshToken) } : {}),
      tokenExpiresAt: tokens.expiresAt,
      ...(tokens.scopes.length > 0 ? { scopes: tokens.scopes } : {}),
      status: 'active',
      updatedAt: new Date(),
    })
    .where(eq(googleAccount.id, accountId));
}

async function refreshNow(account: GoogleAccount): Promise<string> {
  if (!account.refreshToken) {
    await markReauthRequired(account.id);
    throw new GoogleReauthRequiredError(account.id);
  }

  try {
    const tokens = await refreshAccessToken(decryptFromStorage(account.refreshToken));
    await persistTokens(account.id, tokens);
    return tokens.accessToken;
  } catch (error) {
    if (error instanceof GoogleAuthError && error.isInvalidGrant) {
      await markReauthRequired(account.id);
      throw new GoogleReauthRequiredError(account.id);
    }
    throw error;
  }
}

/**
 * A live access token for `accountId`, refreshing if it is missing, expiring
 * within `REFRESH_WINDOW_MS`, or explicitly forced (a 401 mid-request).
 */
export async function getAccessToken(
  accountId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<string> {
  const account = await loadAccount(accountId);

  if (account.status === 'reauth_required') throw new GoogleReauthRequiredError(accountId);

  const stale =
    !account.accessToken ||
    !account.tokenExpiresAt ||
    account.tokenExpiresAt.getTime() - Date.now() < REFRESH_WINDOW_MS;

  if (!options.forceRefresh && !stale) {
    return decryptFromStorage(account.accessToken!);
  }

  const pending = inFlight.get(accountId);
  // A forced refresh still joins an in-flight one: it was started because the
  // token was stale, which is the same thing the caller is asking for.
  if (pending) return pending;

  const promise = refreshNow(account).finally(() => inFlight.delete(accountId));
  inFlight.set(accountId, promise);
  return promise;
}

/** The `AccessTokenProvider` shape `createGoogleCalendarApi` expects. */
export function accessTokenProvider(accountId: string) {
  return (options?: { forceRefresh?: boolean }) => getAccessToken(accountId, options);
}

/**
 * `google:refresh-tokens` (every 15 min): refresh everything expiring within
 * 10 minutes so a sync never pays for it, and retire dead grants.
 */
export async function refreshExpiringTokens(now: Date = new Date()): Promise<{
  refreshed: number;
  reauthRequired: number;
}> {
  const cutoff = new Date(now.getTime() + REFRESH_WINDOW_MS);

  const accounts = await getDb()
    .select()
    .from(googleAccount)
    .where(
      and(
        eq(googleAccount.status, 'active'),
        isNotNull(googleAccount.refreshToken),
        lt(googleAccount.tokenExpiresAt, cutoff)
      )
    );

  let refreshed = 0;
  let reauthRequired = 0;

  for (const account of accounts) {
    try {
      await getAccessToken(account.id, { forceRefresh: true });
      refreshed += 1;
    } catch (error) {
      if (error instanceof GoogleReauthRequiredError) reauthRequired += 1;
      else throw error;
    }
  }

  return { refreshed, reauthRequired };
}

/** Test seam: the single-flight map is process state. */
export function resetTokenState(): void {
  inFlight.clear();
}
