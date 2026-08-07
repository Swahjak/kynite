import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { SHARE_USE_COALESCE_MS, hashShareToken, isShareTokenShaped } from '@/lib/share-token';
import type { Principal } from '@/modules/family/authorize';
import { shareLinkStateOf, shouldCountShareUse, type ShareLinkScope } from './domain/scope';
import { recordShareUse } from './queries';
import { shareLink, type ShareLinkRole } from './schema';

/**
 * Turning a raw URL token into a request-scoped principal — the third and last
 * way a request can identify itself (docs/architecture.md §7).
 *
 * It is deliberately **not** in `modules/family/principal.ts` alongside the
 * other two, and the difference is the point of the whole surface. Those two
 * read a *cookie*; `getPrincipal()` is `cache()`d with no arguments because
 * "who is asking" is a property of the request. A share principal is a property
 * of the **URL**: it is passed in, it sets no cookie, it writes no session row,
 * and two different tokens in two tabs are two different principals in the same
 * browser. Folding it into `getPrincipal()` would mean either giving that
 * function an argument (making every other call site lie about being
 * request-scoped) or storing the token somewhere request-wide — which is a
 * session by another name, and "no session at all" is the criterion.
 *
 * The corollary is enforced from the other side: `(share)` route files never
 * call `getPrincipal()`, so no cookie is ever read there and none is ever set.
 */

/** Why a link did not resolve. All three render the same friendly gone state. */
export type ShareDenial = 'notFound' | 'expired' | 'revoked';

export type ShareResolution =
  | {
      status: 'ok';
      principal: Extract<Principal, { kind: 'share' }>;
      linkId: string;
      label: string | null;
      scope: ShareLinkScope;
      role: ShareLinkRole;
    }
  | { status: ShareDenial };

/**
 * Resolve a raw token, and count the visit.
 *
 * Memoised per request with `React.cache`, keyed on the token: a page and the
 * components under it resolve the same link, and without this the telemetry
 * write would race with itself inside a single render. (The coalescing window
 * would swallow the duplicate anyway; the cache makes it not happen at all.)
 *
 * **`notFound` is returned for a malformed token without touching the
 * database.** `/s/<anything>` is a public endpoint, so the cheap rejection is
 * the one that carries the load.
 *
 * The distinction between `expired`, `revoked` and `notFound` is kept
 * internally but is **not** surfaced to the caregiver: the gone state says the
 * same thing for all three. Telling an anonymous holder of a wrong token that
 * it "expired" would confirm the token was once real, which is a probe result
 * a stranger has no business getting. Parents see the true state — in
 * `(app)/settings/sharing`, where they are authenticated.
 */
export const resolveShareLink = cache(async (rawToken: string): Promise<ShareResolution> => {
  if (!isShareTokenShaped(rawToken)) return { status: 'notFound' };

  const [row] = await getDb()
    .select({
      id: shareLink.id,
      familyId: shareLink.familyId,
      role: shareLink.role,
      scope: shareLink.scope,
      label: shareLink.label,
      expiresAt: shareLink.expiresAt,
      revokedAt: shareLink.revokedAt,
      lastUsedAt: shareLink.lastUsedAt,
    })
    .from(shareLink)
    .where(eq(shareLink.tokenHash, hashShareToken(rawToken)))
    .limit(1);

  if (!row) return { status: 'notFound' };

  const now = new Date();
  const state = shareLinkStateOf(row, now);
  // An expired or revoked link is not a *use*: a parent looking at the usage
  // column wants to know when the link last worked, not how often somebody has
  // knocked on a door that is already locked.
  if (state !== 'active') return { status: state };

  if (shouldCountShareUse(row.lastUsedAt, now, SHARE_USE_COALESCE_MS)) {
    await recordShareUse(row.id, now);
  }

  return {
    status: 'ok',
    principal: {
      kind: 'share',
      familyId: row.familyId,
      role: row.role,
      // The stored scope *is* the authorization scope: `decide()` reads
      // `memberIds`/`calendarIds` from here, so the read filter and the write
      // check cannot drift — there is one object, not two copies of one rule.
      scope: row.scope,
    },
    linkId: row.id,
    label: row.label,
    scope: row.scope,
    role: row.role,
  };
});
