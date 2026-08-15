import { createHash, randomBytes } from 'node:crypto';
import type { Page } from '@playwright/test';

import { withDb } from '../utils/seed';

/**
 * A paired wall display, as a Playwright helper (M12).
 *
 * Every hub surface now runs behind a **device** principal — §2's "`(hub)/` —
 * kiosk, device session required, no account" — so a spec that navigates to
 * `/nl/hub…` has to be a paired tablet, not a signed-in parent. This is the
 * one-line way to become one.
 *
 * The device row and its session are seeded straight into the database and the
 * cookie is injected into the browser context, rather than driving the two-part
 * UI flow (generate a code in settings, type it into a keypad). That flow is
 * itself under test in `e2e/tests/hub/pairing.spec.ts`, once, end to end; making
 * every other hub spec re-run it would add several seconds each and make an
 * unrelated failure in the settings page break the routines suite.
 *
 * Note what this does *not* do: it does not sign the parent out. It does not
 * have to. `getPrincipal()` resolves the device cookie *before* the account
 * session precisely so a browser that is paired is a kiosk regardless of what
 * else it carries (see `modules/family/principal.ts`), which is the same reason
 * a spec cannot drive the parent app and the hub from one page — pair a second
 * context for that, as `timers.spec.ts` already does.
 */

export const DEVICE_SESSION_COOKIE = 'kynite_device_session';

export type PairedDevice = { deviceId: string; deviceName: string; token: string };

/**
 * Seeds a device + session for `familyId` and puts the token in `page`'s
 * context. Returns the device so a spec can revoke it.
 */
export async function pairHub(
  page: Page,
  familyId: string,
  deviceName = 'Keukenhub'
): Promise<PairedDevice> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const deviceId = await withDb(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `insert into device (family_id, name, kind, paired_at, last_seen_at)
       values ($1, $2, 'hub', now(), now())
       returning id`,
      [familyId, deviceName]
    );

    await client.query(
      `insert into device_session (device_id, token_hash, expires_at)
       values ($1, $2, now() + interval '365 days')`,
      [rows[0].id, tokenHash]
    );

    return rows[0].id;
  });

  const context = page.context();
  const origin = page.url().startsWith('http')
    ? new URL(page.url()).origin
    : (process.env.E2E_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? 3100}`);

  await context.addCookies([
    {
      name: DEVICE_SESSION_COOKIE,
      value: token,
      url: origin,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  // Asserted rather than assumed. Without this, a cookie that failed to attach
  // (a mismatched origin, a context that was cleared between fixture and call)
  // shows up much later as "the parent app rendered on a hub route", which is
  // the correct behaviour for a browser with no device cookie and a genuinely
  // confusing thing to debug from a type-scale assertion.
  const attached = (await context.cookies(origin)).some(
    (cookie) => cookie.name === DEVICE_SESSION_COOKIE && cookie.value === token
  );
  if (!attached) {
    throw new Error(`pairHub: the device cookie did not attach to ${origin}`);
  }

  // B-1 moved `ServiceWorkerRegistrar` out of the root `[locale]` layout and
  // into `(app)` and `(hub)` only, so `family`'s sign-up flow (which ends on
  // `/nl/family`, inside `(app)`) is now the *only* navigation before this
  // point that could have registered a worker — one fewer than before, when
  // the root layout registered on `/nl/sign-up` as well. A spec that pairs and
  // then immediately asserts `serviceWorker.controller` on its very first
  // `/nl/hub` navigation needs that worker to already be *active*, not merely
  // registered, by the time that navigation starts — a controller is decided
  // once, at the start of a navigation, and never retroactively. Waiting here,
  // on whatever page `pairHub` was called from, is what makes that
  // deterministic instead of a race against however long `/nl/family` took to
  // register and activate.
  if (await page.evaluate(() => 'serviceWorker' in navigator)) {
    await page.evaluate(() => navigator.serviceWorker.ready);
  }

  return { deviceId, deviceName, token };
}

/**
 * Drops the device cookie, so the browser stops being a kiosk and goes back to
 * whatever account session it holds.
 *
 * Only one spec needs it — the sign-out cache test, which has to fill both the
 * hub *and* the parent-app caches from a single browsing context, and cannot
 * reach `(app)` while a device cookie outranks the account session (see
 * `modules/family/principal.ts` on resolution order). It is a harness detail,
 * not a product flow: nothing in the app un-pairs a device from the device.
 */
export async function unpairHub(page: Page): Promise<void> {
  const context = page.context();
  const kept = (await context.cookies()).filter((cookie) => cookie.name !== DEVICE_SESSION_COOKIE);
  await context.clearCookies();
  await context.addCookies(kept);
}

/** Revokes a device the way `revokeDeviceAction` does, straight in the database. */
export async function revokeDevice(deviceId: string): Promise<void> {
  await withDb(async (client) => {
    await client.query(`update device set revoked_at = now() where id = $1`, [deviceId]);
    await client.query(
      `update device_session set revoked_at = now() where device_id = $1 and revoked_at is null`,
      [deviceId]
    );
  });
}

/**
 * Ages a device session by `days` — the "simulated multi-day gap".
 *
 * The clock that matters is the *row's*, not the browser's: the cookie carries
 * no timestamp the server trusts, and `expires_at` is what
 * `getPrincipal()` compares. So a week away from the tablet is exactly a
 * `last_seen_at` a week in the past, which is also what makes the next request
 * cross the sliding threshold.
 */
export async function ageDeviceSession(deviceId: string, days: number): Promise<void> {
  await withDb(async (client) => {
    await client.query(
      `update device set last_seen_at = now() - ($2 || ' days')::interval where id = $1`,
      [deviceId, String(days)]
    );
    await client.query(
      `update device_session
         set expires_at = now() + interval '365 days' - ($2 || ' days')::interval
       where device_id = $1`,
      [deviceId, String(days)]
    );
  });
}

/** The session row's current expiry, for asserting that a use slid it forward. */
export async function deviceSessionExpiry(deviceId: string): Promise<Date> {
  return withDb(async (client) => {
    const { rows } = await client.query<{ expires_at: Date }>(
      `select expires_at from device_session where device_id = $1 order by created_at desc limit 1`,
      [deviceId]
    );
    return rows[0].expires_at;
  });
}
