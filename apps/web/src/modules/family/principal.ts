import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getAuth } from '@/server/auth';
import { getDb } from '@/server/db';
// Tables from the schema assembly point, not from a slice barrel: importing
// `@/modules/devices` here would close an import cycle, because that slice's
// actions import this one for `assertCan` (see `@/lib/device-session`).
import { device, deviceSession } from '@/server/db/schema';
import {
  DEVICE_SESSION_COOKIE,
  deviceSessionExpiry,
  hashDeviceToken,
  shouldSlideDeviceSession,
} from '@/lib/device-session';
import { ForbiddenError, can, type Capability, type Principal, type Resource } from './authorize';
import { member } from './schema';

/**
 * Request principal resolution (server-side only).
 *
 * Two credentials can stand behind a request, and they are resolved in a fixed
 * order (docs/architecture.md §7):
 *
 *  1. **a paired device session** — the kiosk (M12). An opaque token in an
 *     httpOnly cookie, matched against its SHA-256 hash.
 *  2. **an account session** — the parent app. The session cookie carries
 *     `activeFamilyId` + `memberId`, so scoping is a cookie read. The member's
 *     *role* is read from the database: a demoted parent must lose their powers
 *     on the next request, not when the cookie cache expires. It is a
 *     primary-key lookup, memoised per request by `React.cache`.
 *
 * **The device wins when both are present**, and that order is the security
 * property, not a preference. §7's premise is that "a wall tablet is physically
 * unauthenticated; anyone in the house can touch it". If an account session
 * outranked the device cookie, then a tablet where a parent once signed in
 * would quietly become an owner-level terminal on the kitchen wall — permanent,
 * invisible, and reachable by any visitor — which is the exact state pairing
 * exists to end. A paired browser is a kiosk, full stop; the parent app is used
 * from a device that is not paired. The corollary is deliberate and is enforced
 * in `(app)/layout.tsx`: a paired browser cannot reach the parent tree at all,
 * even with a valid account session.
 */
export const getPrincipal = cache(async (): Promise<Principal | null> => {
  return (await getDevicePrincipal()) ?? (await getMemberPrincipal());
});

async function getMemberPrincipal(): Promise<Principal | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });

  const familyId = session?.session.activeFamilyId;
  const memberId = session?.session.memberId;
  if (!familyId || !memberId) return null;

  const [row] = await getDb()
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.familyId, familyId)))
    .limit(1);

  if (!row) return null;

  return { kind: 'member', familyId, memberId, role: row.role };
}

/**
 * Resolve the kiosk cookie into a device principal.
 *
 * Four conditions are in the `where`, not in branches afterwards: the token
 * hash matches, the session is not revoked, the session has not expired, and
 * the *device* is not revoked. Revoking a device therefore drops the hub on the
 * very next request — there is no cached decision to invalidate.
 *
 * The session also **slides here**, which is the only place every kiosk request
 * passes through. §7 says "sliding on each use"; the write is coalesced to at
 * most one an hour (`shouldSlideDeviceSession`), because a wall tablet polls
 * every two seconds and a literal write per use would be tens of thousands of
 * UPDATEs a day to move a timestamp that is a year away. The **cookie's** own
 * expiry is re-stamped by `GET /api/devices/session`, which the kiosk shell
 * pings — a Server Component may not set a cookie, so the two halves of the
 * renewal necessarily live in different places.
 */
async function getDevicePrincipal(): Promise<Principal | null> {
  const raw = (await cookies()).get(DEVICE_SESSION_COOKIE)?.value;
  if (!raw) return null;

  const now = new Date();

  const [row] = await getDb()
    .select({
      sessionId: deviceSession.id,
      deviceId: device.id,
      familyId: device.familyId,
      lastSeenAt: device.lastSeenAt,
    })
    .from(deviceSession)
    .innerJoin(device, eq(device.id, deviceSession.deviceId))
    .where(
      and(
        eq(deviceSession.tokenHash, hashDeviceToken(raw)),
        isNull(deviceSession.revokedAt),
        gt(deviceSession.expiresAt, now),
        isNull(device.revokedAt)
      )
    )
    .limit(1);

  if (!row) return null;

  if (shouldSlideDeviceSession(row.lastSeenAt, now)) {
    const db = getDb();
    await db
      .update(deviceSession)
      .set({ expiresAt: deviceSessionExpiry(now), updatedAt: now })
      .where(eq(deviceSession.id, row.sessionId));
    await db
      .update(device)
      .set({ lastSeenAt: now, updatedAt: now })
      .where(eq(device.id, row.deviceId));
  }

  return { kind: 'device', familyId: row.familyId, deviceId: row.deviceId };
}

/** Throws `ForbiddenError` unless the caller may perform `capability`. */
export async function assertCan(
  capability: Capability,
  resource?: Omit<Resource, 'familyId'> & { familyId?: string }
): Promise<Principal> {
  const principal = await getPrincipal();
  if (!principal) throw new ForbiddenError(capability);

  const target: Resource = { familyId: principal.familyId, ...resource };

  if (!can(principal, capability, target)) throw new ForbiddenError(capability);

  return principal;
}

/**
 * The kiosk principal, or `null` — never a member. The `(hub)` tree's gate.
 *
 * Strict by design, matching §2 verbatim ("`(hub)/` — kiosk, device session
 * required, no account"). A signed-in parent who lands on `/hub` is not shown
 * the board with owner powers behind it; they already have a surface, and the
 * whole point of M12 is that the wall display is never an owner-level session.
 */
export async function requireDevicePrincipal(): Promise<Principal | null> {
  const principal = await getPrincipal();
  return principal?.kind === 'device' ? principal : null;
}
