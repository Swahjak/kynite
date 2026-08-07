import { expect, test } from '@playwright/test';

/**
 * M11: "Push opt-in is never prompted on first load — asserted by a Playwright
 * test on cold entry."
 *
 * This is not a politeness rule. A browser that receives a permission request
 * from a page the user has not engaged with will, in current Chromium, refuse
 * to ask again for that origin — so one badly-placed prompt costs a household
 * their notifications permanently, with no way back except browser settings
 * they will never find. §6 step 1 states it as "opt-in prompted after a
 * meaningful action, never on first load".
 *
 * The assertion is made by instrumenting `Notification.requestPermission`
 * itself, before any of the app's own JavaScript runs, and then walking every
 * surface a first-time visitor can reach. Instrumenting the API rather than
 * watching for a dialog is what makes this non-vacuous: a prompt that the
 * headless browser auto-dismisses is still a prompt that was *asked for*, and
 * it would be invisible to a dialog-based check.
 */

const COLD_ENTRY_PATHS = ['/', '/nl', '/nl/sign-in', '/nl/sign-up', '/nl/hub'];

/** Records every call, and never actually prompts. */
const INSTRUMENT = `
  window.__permissionRequests = [];
  if (window.Notification) {
    Notification.requestPermission = function (...args) {
      window.__permissionRequests.push(new Error().stack ?? 'requestPermission');
      return Promise.resolve('default');
    };
  }
  const originalSubscribe = window.PushManager?.prototype?.subscribe;
  if (originalSubscribe) {
    window.PushManager.prototype.subscribe = function (...args) {
      window.__permissionRequests.push('pushManager.subscribe');
      return originalSubscribe.apply(this, args);
    };
  }
`;

test.describe('cold entry', () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(INSTRUMENT);
  });

  for (const path of COLD_ENTRY_PATHS) {
    test(`never asks for notification permission on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const requests = await page.evaluate(
        () => (window as unknown as { __permissionRequests: string[] }).__permissionRequests
      );

      expect(requests, `${path} asked for notification permission on load`).toEqual([]);
      // And nothing granted itself permission along the way. (A headless
      // profile reports `denied` rather than `default` for an origin that has
      // never asked, so the assertion is on `granted` — the only value that
      // could indicate a prompt was answered.)
      expect(await page.evaluate(() => Notification.permission)).not.toBe('granted');
    });
  }

  test('registers a service worker without ever asking for anything', async ({ page }) => {
    // The two acts are independent and this is the test that keeps them so:
    // a worker is installed (offline caching, push *delivery*) with no
    // permission dialog anywhere near it.
    //
    // `/nl/hub` rather than `/nl`: B-1 moved `ServiceWorkerRegistrar` out of
    // the root `[locale]` layout (which also wraps the caregiver `(share)`
    // tree — that tree must never install a worker) and into `(app)` and
    // `(hub)` only. An unpaired browser hitting `/nl/hub` still redirects to
    // `/nl/hub/pair`, which is inside `(hub)/layout.tsx` and registers just
    // the same, with no session and no device cookie required.
    await page.goto('/nl/hub');
    await page.evaluate(() => navigator.serviceWorker.ready);

    const requests = await page.evaluate(
      () => (window as unknown as { __permissionRequests: string[] }).__permissionRequests
    );
    expect(requests).toEqual([]);
  });

  test('exactly one module in the shipped app can request permission', async ({ page }) => {
    // Belt to the runtime braces: a future component could add a prompt on a
    // route this spec does not visit. `requestPermission` appearing in one
    // client module — the settings opt-in — is what keeps that reviewable.
    await page.goto('/nl');

    const sources = await page.evaluate(async () => {
      const scripts = [...document.querySelectorAll('script[src]')].map(
        (element) => (element as HTMLScriptElement).src
      );
      const bodies = await Promise.all(
        scripts.map((src) =>
          fetch(src)
            .then((response) => response.text())
            .catch(() => '')
        )
      );
      return bodies.filter((body) => body.includes('requestPermission')).length;
    });

    // The marketing/auth entry bundle must not carry it at all.
    expect(sources).toBe(0);
  });
});
