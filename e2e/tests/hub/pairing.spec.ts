import { expect, test } from '../../fixtures/family';
import {
  DEVICE_SESSION_COOKIE,
  ageDeviceSession,
  deviceSessionExpiry,
  pairHub,
  revokeDevice,
} from '../../fixtures/hub';

/**
 * Kiosk pairing, revocation and survival, end to end (M12).
 *
 * `tests/integration/device-pairing.test.ts` proves the credential's
 * properties against a real database. This file proves the two things only a
 * browser can: that a parent and a wall tablet can actually complete the
 * hand-off through the two screens, and that a paired tablet keeps working
 * across reloads and long silences with no login screen ever appearing.
 *
 * It is the only spec that drives the pairing UI. Every other hub spec seeds a
 * device (`fixtures/hub.pairHub`) — running six keypad taps before each of
 * forty assertions would buy nothing and cost minutes.
 */

test.describe('device pairing', () => {
  test('a parent generates a code and the wall tablet redeems it', async ({ page, family }) => {
    // --- The parent's phone -------------------------------------------------
    await page.goto('/nl/settings/devices');

    await expect(page.getByTestId('devices-empty')).toBeVisible();

    await page.getByTestId('device-name-input').fill('Keuken');
    await page.getByRole('button', { name: 'Code aanmaken' }).click();

    const code = await page.getByTestId('pairing-code').innerText();
    expect(code).toMatch(/^\d{6}$/);

    // --- The wall tablet ----------------------------------------------------
    // A second context, because the two are different physical devices and,
    // since M12, a browser that holds a device cookie is a kiosk regardless of
    // what account session it also carries.
    const kiosk = await page.context().browser()!.newContext({ locale: 'nl-NL' });
    const hub = await kiosk.newPage();

    await hub.goto('/nl/hub');
    // Unpaired: the proxy turns it away before anything renders.
    await expect(hub).toHaveURL(/\/nl\/hub\/pair$/);
    await expect(hub.getByTestId('pair-form')).toBeVisible();

    for (const digit of code) await hub.getByTestId(`pair-key-${digit}`).click();
    await hub.getByTestId('pair-submit').click();

    await hub.waitForURL(/\/nl\/hub$/);
    await expect(hub.getByTestId('hub-board')).toBeVisible();
    await expect(hub.getByTestId('hub-device-name')).toContainText('Keuken');

    // The credential is httpOnly, so the page cannot read it — which is the
    // point, and is asserted rather than assumed.
    const readable = await hub.evaluate(() => document.cookie);
    expect(readable).not.toContain(DEVICE_SESSION_COOKIE);

    const cookie = (await kiosk.cookies()).find((entry) => entry.name === DEVICE_SESSION_COOKIE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('Lax');
    // A year out, give or take the round trip.
    expect(cookie!.expires * 1000 - Date.now()).toBeGreaterThan(360 * 86_400_000);

    // --- Back on the parent's phone ----------------------------------------
    await page.reload();
    await expect(page.getByTestId('device-row')).toHaveCount(1);
    await expect(page.getByTestId('device-list')).toContainText('Keuken');

    await kiosk.close();
    expect(family.familyId).toBeTruthy();
  });

  test('the same code cannot pair a second tablet', async ({ page }) => {
    await page.goto('/nl/settings/devices');
    await page.getByTestId('device-name-input').fill('Keuken');
    await page.getByRole('button', { name: 'Code aanmaken' }).click();
    const code = await page.getByTestId('pairing-code').innerText();

    const browser = page.context().browser()!;

    const first = await browser.newContext({ locale: 'nl-NL' });
    const firstPage = await first.newPage();
    await firstPage.goto('/nl/hub/pair');
    for (const digit of code) await firstPage.getByTestId(`pair-key-${digit}`).click();
    await firstPage.getByTestId('pair-submit').click();
    await firstPage.waitForURL(/\/nl\/hub$/);

    const second = await browser.newContext({ locale: 'nl-NL' });
    const secondPage = await second.newPage();
    await secondPage.goto('/nl/hub/pair');
    for (const digit of code) await secondPage.getByTestId(`pair-key-${digit}`).click();
    await secondPage.getByTestId('pair-submit').click();

    await expect(secondPage.getByTestId('pair-status')).toContainText('werkt niet');
    await expect(secondPage).toHaveURL(/\/nl\/hub\/pair$/);

    await first.close();
    await second.close();
  });
});

test.describe('a paired hub', () => {
  test('survives a reload and a simulated multi-day gap with no login screen', async ({
    browser,
    family,
  }) => {
    // A real kiosk context: no account session anywhere in it. That matters
    // for the claim being made — "no login screen" is only interesting when
    // there is no signed-in parent quietly holding the page up.
    const kiosk = await browser.newContext({ locale: 'nl-NL' });
    const page = await kiosk.newPage();
    await page.goto('/nl/hub/pair');
    const device = await pairHub(page, family.familyId, 'Keuken');

    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();

    // 1. A plain reload. This is what a tablet does after a power cut.
    await page.reload();
    await expect(page.getByTestId('hub-board')).toBeVisible();
    expect(page.url()).not.toContain('sign-in');

    // 2. A multi-day gap. The clock that matters is the session row's, not the
    // browser's — the cookie carries no timestamp the server trusts — so the
    // gap is expressed as a session last seen nine days ago.
    const before = await deviceSessionExpiry(device.deviceId);
    await ageDeviceSession(device.deviceId, 9);
    const aged = await deviceSessionExpiry(device.deviceId);
    expect(aged.getTime()).toBeLessThan(before.getTime());

    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();
    expect(page.url()).not.toContain('sign-in');
    expect(page.url()).not.toContain('/pair');

    // And the gap put the session back to a full year: "sliding on each use".
    const slid = await deviceSessionExpiry(device.deviceId);
    expect(slid.getTime()).toBeGreaterThan(aged.getTime());

    await kiosk.close();
  });

  test('drops to the pair screen on the next request once revoked', async ({ browser, family }) => {
    // Again a context with no account session: `getPrincipal()` resolves the
    // device *before* the member (see `modules/family/principal.ts`), so a
    // browser that also held a parent's cookie would fall back to it after
    // revocation and be sent to `/today` — correct, but a different story from
    // the one this test is telling.
    const kiosk = await browser.newContext({ locale: 'nl-NL' });
    const page = await kiosk.newPage();
    await page.goto('/nl/hub/pair');
    const device = await pairHub(page, family.familyId, 'Keuken');

    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();

    await revokeDevice(device.deviceId);

    // The next request is made from a *fresh* page in the same (still cookied)
    // context rather than by re-navigating the open one. Not a workaround: the
    // open board is simultaneously discovering the revocation on its own —
    // its stream 401s and the session watcher calls `router.refresh()` — and a
    // second navigation racing that is a test artefact, not the criterion.
    // What "on the next request" means is that a request carrying the revoked
    // cookie is turned away, which is exactly what this asserts.
    const next = await kiosk.newPage();
    await next.goto('/nl/hub');

    await expect(next).toHaveURL(/\/nl\/hub\/pair$/);
    await expect(next.getByTestId('pair-form')).toBeVisible();
    await expect(next.getByTestId('hub-board')).toHaveCount(0);

    await kiosk.close();
  });

  test('sends a signed-in parent to their own surface, never to the board', async ({
    page,
    family,
  }) => {
    // The other half of the boundary: `/hub` is a device surface, and an
    // account session is not a way onto it. Before M12 this *was* the hub —
    // an owner-level session on a kitchen wall (§7: "a wall tablet is
    // physically unauthenticated").
    expect(family.familyId).toBeTruthy();

    await page.goto('/nl/hub');
    await expect(page).toHaveURL(/\/nl\/today$/);
  });

  test('drops to the pair screen on an SSE tick, without navigating', async ({
    page,
    browser,
    family,
  }) => {
    // The kitchen is a second context: revocation is driven from the parent's
    // own session in `page`, and the wall display must react on its own.
    const kiosk = await browser.newContext({ locale: 'nl-NL' });
    const hub = await kiosk.newPage();

    await hub.goto('/nl/hub/pair');
    const device = await pairHub(hub, family.familyId, 'Keuken');

    await hub.goto('/nl/hub');
    await expect(hub.getByTestId('hub-board')).toBeVisible();
    // The stream has to be up, or this test would pass on the reload path.
    await expect(hub.getByTestId('offline-indicator')).toHaveCount(0);

    await page.goto('/nl/settings/devices');
    // Two taps (review finding 7): revoking is destructive to whatever screen
    // it targets, so the first tap only reveals the confirm step.
    await page.getByTestId('revoke-device').click();
    await page.getByTestId('revoke-device-confirm-yes').click();

    // No navigation on the hub: the `device.revoked` event arrives on the
    // family channel, the watcher recognises its own id, and the refresh runs
    // straight into `requireHubDevice`.
    await expect(hub.getByTestId('pair-form')).toBeVisible({ timeout: 15_000 });
    expect(device.deviceId).toBeTruthy();

    await kiosk.close();
  });

  test('self-unpair via the settings sheet hands a browser with a member session back to the parent app', async ({
    page,
    family,
  }) => {
    // BLOCKING 2: before this affordance existed, a browser that was ever
    // paired had no way back — the device cookie outranks the account
    // session (`modules/family/principal.ts`), and `(app)/layout.tsx` sends
    // a device principal to `/hub` before the parent app ever renders. This
    // is the same physical browser as the `family` fixture's signed-in
    // session, deliberately: the point is that the account session was there
    // the whole time, just shadowed by the device cookie.
    await pairHub(page, family.familyId, 'Laptop per ongeluk');

    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();

    await page.getByTestId('hub-settings-trigger').click();
    await expect(page.getByTestId('hub-settings')).toBeVisible();
    await page.getByTestId('hub-unpair-trigger').click();
    await expect(page.getByTestId('hub-unpair-confirm')).toBeVisible();
    await page.getByTestId('hub-unpair-confirm-yes').click();

    // The member session, never gone, takes over: the redirect target is the
    // bare locale root, and it is `(marketing)/page.tsx`'s own check that
    // sends a resolved member principal on to their own surface.
    await page.waitForURL(/\/nl\/today$/);
    await expect(page.getByTestId('hub-board')).toHaveCount(0);

    // And the device really is gone, not just the cookie on this page: a
    // fresh page carrying nothing but that same (now revoked) device token
    // resolves no principal on the hub tree either.
    const next = await page.context().newPage();
    await next.goto('/nl/hub');
    await expect(next).toHaveURL(/\/nl\/today$/);
  });

  test('self-unpair drops a plain kiosk (no account session) to the pair screen', async ({
    browser,
    family,
  }) => {
    const kiosk = await browser.newContext({ locale: 'nl-NL' });
    const hub = await kiosk.newPage();

    await hub.goto('/nl/hub/pair');
    await pairHub(hub, family.familyId, 'Wandtablet');

    await hub.goto('/nl/hub');
    await expect(hub.getByTestId('hub-board')).toBeVisible();

    await hub.getByTestId('hub-settings-trigger').click();
    await hub.getByTestId('hub-unpair-trigger').click();
    await hub.getByTestId('hub-unpair-confirm-yes').click();

    // No account session anywhere in this context, so the redirect lands on
    // the marketing root rather than the parent app.
    await hub.waitForURL(/\/nl$/);

    // And the hub itself is back to square one.
    await hub.goto('/nl/hub');
    await expect(hub).toHaveURL(/\/nl\/hub\/pair$/);
    await expect(hub.getByTestId('pair-form')).toBeVisible();

    await kiosk.close();
  });
});
