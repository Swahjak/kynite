import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { DEVICE_SESSION_COOKIE } from '@/lib/device-session';
import { getPrincipal } from '@/modules/family';
import { publish } from '@/modules/realtime';
import { revokeDevice } from '@/modules/devices';

/**
 * `POST /api/devices/session/unpair` — a paired screen giving up its own
 * credential (BLOCKING 2: a self-paired browser had no way back to the
 * parent app).
 *
 * A route handler, not a Server Action, and deliberately with **no
 * `assertCan` call**: `device:manage` is the capability for one principal
 * acting on *another* device, and this is not that shape. The device session
 * cookie carried on this very request is the only thing being authorized
 * here, and surrendering it needs no further permission — the same way
 * signing out needs no capability check on the account being signed out of.
 * `tests/unit/server-action-authorization.test.ts` only audits `'use server'`
 * modules, so this route is invisible to it by construction, not by omission.
 *
 * Two things happen, in the order that matters if the second one never runs:
 *
 *  1. **the device row is revoked** — `revokeDevice`, the same write
 *     `revokeDeviceAction` makes, publishing `device.revoked` so any other
 *     open stream for this device (there should be none, but a second tab is
 *     not impossible) drops too. If this fails, the cookie survives and the
 *     screen is still paired, which is the safe failure.
 *  2. **the cookie is cleared** — after the row is gone, never before: a
 *     cleared cookie with a live row would just make the parent generate a
 *     fresh code for a screen that could have unpaired itself with one more
 *     tap.
 *
 * `GET /api/devices/session` already proves cookie-clearing works from a
 * route handler; this is the write half of the same pattern.
 */
export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  const principal = await getPrincipal();

  if (principal?.kind !== 'device') {
    // Not a paired screen — there is no credential here to surrender. A
    // member session hitting this by mistake gets a plain 403, not a 401:
    // this is not "please authenticate", it is "this action does not apply".
    return NextResponse.json(
      { error: 'not_a_device' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const revoked = await revokeDevice(principal.familyId, principal.deviceId);

  if (revoked) {
    await publish({
      familyId: principal.familyId,
      type: 'device.revoked',
      entity: { id: principal.deviceId },
      actor: { deviceId: principal.deviceId, source: 'hub' },
    });
  }

  (await cookies()).delete(DEVICE_SESSION_COOKIE);

  return NextResponse.json({ status: 'unpaired' }, { headers: { 'Cache-Control': 'no-store' } });
}
