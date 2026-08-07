import 'server-only';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { generateShareToken, hashShareToken } from '@/lib/share-token';
import { normalizeScope, type ShareLinkScope } from './domain/scope';
import { shareLink, type ShareLink, type ShareLinkRole } from './schema';

/**
 * Reads and writes for the sharing slice. `server-only`, like every other
 * slice's `queries.ts`.
 *
 * This module is imported from both sides of the M13 boundary: by
 * `./actions.ts` (a parent minting or revoking a link) and by `./view/` (the
 * public, no-account resolution of a token). That is safe in the direction that
 * matters — the `(share)` tree's ban is on *reaching* a `'use server'` module,
 * and nothing here imports one. The reverse edge is what would break it, which
 * is why `actions.ts` imports this file and never the other way round.
 */

export type CreateShareLinkInput = {
  familyId: string;
  role: ShareLinkRole;
  scope: ShareLinkScope;
  label: string | null;
  expiresAt: Date | null;
};

export type CreateShareLinkResult = {
  link: ShareLink;
  /**
   * The raw token — the **only** time it exists outside the caregiver's URL
   * bar. It is returned, never stored, never logged. `share_link.token_hash`
   * holds `sha256('share:' + token)`, so no database read can reconstruct it.
   */
  token: string;
};

/**
 * Mint a link. One INSERT, and the raw token exists only in this function's
 * return value.
 *
 * There is no retry loop around a hash collision: the unique index on
 * `token_hash` would raise, and the probability of two 256-bit tokens colliding
 * is not a case worth writing code for — if it ever happened, a raised error is
 * the honest outcome, not a silently re-rolled credential.
 */
export async function createShareLink(input: CreateShareLinkInput): Promise<CreateShareLinkResult> {
  const token = generateShareToken();

  const [row] = await getDb()
    .insert(shareLink)
    .values({
      familyId: input.familyId,
      tokenHash: hashShareToken(token),
      role: input.role,
      scope: normalizeScope(input.scope),
      label: input.label,
      expiresAt: input.expiresAt,
    })
    .returning();

  return { link: row, token };
}

/**
 * Revoke a link, family-scoped and idempotent-ish: an already-revoked link
 * returns `false` rather than moving its `revokedAt` stamp, so the settings
 * list keeps saying when access was actually taken away.
 */
export async function revokeShareLink(familyId: string, id: string): Promise<boolean> {
  const now = new Date();

  const [row] = await getDb()
    .update(shareLink)
    .set({ revokedAt: now, updatedAt: now })
    .where(and(eq(shareLink.id, id), eq(shareLink.familyId, familyId), isNull(shareLink.revokedAt)))
    .returning({ id: shareLink.id });

  return !!row;
}

/**
 * Every link a family has ever minted, newest first — including revoked and
 * expired ones.
 *
 * `tokenHash` is deliberately **not** selected. It is useless to the UI, and a
 * column that never leaves the database is a column that cannot end up in a
 * server-component payload, a log line or a React DevTools tree.
 */
export type ShareLinkListEntry = {
  id: string;
  role: ShareLinkRole;
  scope: ShareLinkScope;
  label: string | null;
  createdAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  useCount: number;
};

export async function listShareLinks(familyId: string): Promise<ShareLinkListEntry[]> {
  return getDb()
    .select({
      id: shareLink.id,
      role: shareLink.role,
      scope: shareLink.scope,
      label: shareLink.label,
      createdAt: shareLink.createdAt,
      expiresAt: shareLink.expiresAt,
      revokedAt: shareLink.revokedAt,
      lastUsedAt: shareLink.lastUsedAt,
      useCount: shareLink.useCount,
    })
    .from(shareLink)
    .where(eq(shareLink.familyId, familyId))
    .orderBy(desc(shareLink.createdAt));
}

/**
 * Record a visit: `lastUsedAt = now`, `useCount += 1`.
 *
 * Split out from the resolver (`./view/resolve.ts`) so the public read path
 * owns *when* a visit counts and this owns *how* it is written. The increment
 * is done in SQL rather than read-modify-write: two grandparents opening the
 * same link at once must both be counted.
 */
export async function recordShareUse(id: string, now: Date): Promise<void> {
  await getDb()
    .update(shareLink)
    .set({ lastUsedAt: now, useCount: sql`${shareLink.useCount} + 1`, updatedAt: now })
    .where(eq(shareLink.id, id));
}
