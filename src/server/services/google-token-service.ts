import { db } from "@/server/db";
import { accounts } from "@/server/schema";
import { and, eq } from "drizzle-orm";

export interface TokenResult {
  accessToken: string;
  refreshToken: string | null;
  accountId: string;
  expiresAt: Date | null;
}

/**
 * Get Google OAuth tokens for a specific user
 * Used by Story 1.2 Calendar Aggregator to fetch calendar data
 */
export async function getGoogleTokensForUser(
  userId: string
): Promise<TokenResult[]> {
  const googleAccounts = await db
    .select({
      id: accounts.id,
      accountId: accounts.accountId,
      accessToken: accounts.accessToken,
      refreshToken: accounts.refreshToken,
      accessTokenExpiresAt: accounts.accessTokenExpiresAt,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.providerId, "google")));

  return googleAccounts
    .filter((acc) => acc.accessToken !== null)
    .map((acc) => ({
      accessToken: acc.accessToken!,
      refreshToken: acc.refreshToken,
      accountId: acc.accountId,
      expiresAt: acc.accessTokenExpiresAt,
    }));
}

/**
 * Get Google OAuth token for a specific account
 */
export async function getGoogleTokenForAccount(
  userId: string,
  accountId: string
): Promise<TokenResult | null> {
  const result = await db
    .select({
      id: accounts.id,
      accountId: accounts.accountId,
      accessToken: accounts.accessToken,
      refreshToken: accounts.refreshToken,
      accessTokenExpiresAt: accounts.accessTokenExpiresAt,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.id, accountId),
        eq(accounts.providerId, "google")
      )
    )
    .limit(1);

  if (result.length === 0 || !result[0].accessToken) {
    return null;
  }

  return {
    accessToken: result[0].accessToken,
    refreshToken: result[0].refreshToken,
    accountId: result[0].accountId,
    expiresAt: result[0].accessTokenExpiresAt,
  };
}

/**
 * Check if a token is expired (with 5 minute buffer)
 */
export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  return Date.now() >= expiresAt.getTime() - bufferMs;
}

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

interface RefreshedToken {
  accessToken: string;
  expiresAt: Date;
}

/**
 * Refresh an expired Google access token
 */
export async function refreshGoogleToken(
  refreshToken: string
): Promise<RefreshedToken> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    const errorMessage =
      response.status === 400
        ? "invalid_grant - token revoked or expired"
        : `status ${response.status}`;
    throw new Error(
      `Token refresh failed: ${errorMessage}${errorBody ? ` - ${errorBody}` : ""}`
    );
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

/**
 * Update stored token after refresh
 */
export async function updateStoredToken(
  accountId: string,
  accessToken: string,
  expiresAt: Date
): Promise<void> {
  await db
    .update(accounts)
    .set({
      accessToken,
      accessTokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(accounts.id, accountId));
}

/**
 * Get a valid access token, refreshing if needed
 */
export async function getValidAccessToken(
  accountDbId: string
): Promise<string | null> {
  const account = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountDbId))
    .limit(1);

  if (account.length === 0 || !account[0].accessToken) {
    return null;
  }

  const { accessToken, refreshToken, accessTokenExpiresAt } = account[0];

  // Check if token needs refresh
  if (isTokenExpired(accessTokenExpiresAt) && refreshToken) {
    try {
      const refreshed = await refreshGoogleToken(refreshToken);
      await updateStoredToken(
        accountDbId,
        refreshed.accessToken,
        refreshed.expiresAt
      );
      // Clear any previous error on success
      await db
        .update(accounts)
        .set({ lastSyncError: null, lastSyncErrorAt: null })
        .where(eq(accounts.id, accountDbId));
      return refreshed.accessToken;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(
        `Failed to refresh token for account ${accountDbId}:`,
        errorMessage
      );
      // Persist error for UI display
      await db
        .update(accounts)
        .set({
          lastSyncError: "Token refresh failed - please re-link account",
          lastSyncErrorAt: new Date(),
        })
        .where(eq(accounts.id, accountDbId));
      return null;
    }
  }

  return accessToken;
}
