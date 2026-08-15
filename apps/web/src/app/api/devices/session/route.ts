import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { DEVICE_SESSION_COOKIE, deviceCookieOptions, hashDeviceToken } from '@/lib/device-session';
import { getPrincipal } from '@/modules/family';

/**
 * `GET /api/devices/session` — the kiosk's heartbeat, and the **cookie half of
 * the sliding renewal** (docs/architecture.md §7).
 *
 * The renewal is split across two places for a structural reason, not a
 * stylistic one. The *session row* slides wherever the principal is resolved
 * (`modules/family/principal.ts`), which is every request; but a Server
 * Component may not set a cookie in Next.js, so the *cookie's* own expiry can
 * only be re-stamped somewhere that is allowed to write response headers.
 * This route is that place, and the kiosk shell pings it hourly.
 *
 * It answers two questions in one round trip:
 *
 *  - **is this device still paired?** `getPrincipal()` joins
 *    `device.revoked_at is null` and `expires_at > now`, so a revoked tablet
 *    gets `revoked` here and drops to the pair screen. This is the belt to the
 *    SSE `device.revoked` braces: a wall display can sit for hours between
 *    navigations, and a stream that quietly died is exactly when revocation
 *    must still land.
 *  - **for how much longer?** The response re-stamps the cookie a full year
 *    out on every call, so a tablet that is used never approaches its expiry.
 *
 * No family data crosses this boundary, so nothing here needs scoping beyond
 * the principal's own kind.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const jar = await cookies();
  const raw = jar.get(DEVICE_SESSION_COOKIE)?.value;
  const principal = await getPrincipal();

  if (!raw || principal?.kind !== 'device') {
    // A cookie that no longer resolves is deleted rather than left to rot:
    // otherwise the hub re-sends a dead credential on every request for a
    // year, and `document.cookie` on the kiosk keeps a token that is now only
    // useful to whoever finds it.
    if (raw) jar.delete(DEVICE_SESSION_COOKIE);
    return NextResponse.json(
      { status: 'revoked' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Re-stamped, not merely echoed: `deviceCookieOptions()` is the single
  // definition of the attributes, so mint and renewal cannot drift.
  jar.set(DEVICE_SESSION_COOKIE, raw, deviceCookieOptions());

  return NextResponse.json(
    {
      status: 'active',
      deviceId: principal.deviceId,
      // A fingerprint, not the token: enough for a support conversation
      // ("which session is this?") and useless as a credential.
      sessionFingerprint: hashDeviceToken(raw).slice(0, 8),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
