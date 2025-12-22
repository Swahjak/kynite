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
