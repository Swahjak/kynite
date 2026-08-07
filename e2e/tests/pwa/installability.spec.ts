import { pairHub } from '../../fixtures/hub';
import { expect, test } from '../../fixtures/family';

/**
 * Installability, in a real browser (M11: "both hub and parent app are
 * installable (Lighthouse PWA installability passes)").
 *
 * Lighthouse removed its PWA category in v12, so there is no longer a
 * "Lighthouse PWA audit" to run. What that audit *checked* is split in two
 * here, and both halves are stronger for being separated:
 *
 *  - the **static** contract (name, start_url, display, 192/512 PNG icons)
 *    lives in `tests/unit/offline/manifest.test.ts`, where it runs on every
 *    unit gate rather than only when a browser is available;
 *  - the **runtime** contract is this file: the manifest is actually served
 *    and linked from both surfaces, the icons resolve, and a service worker
 *    registers and takes control of the origin.
 *
 * The one thing neither can assert is the browser's own install prompt, which
 * requires a user gesture and a headful profile. That is a genuine gap and it
 * is named rather than papered over.
 */

type Manifest = {
  name?: string;
  start_url?: string;
  display?: string;
  icons?: { src: string; sizes?: string; type?: string }[];
};

test.describe('installability', () => {
  test('serves the parent-app manifest and links it from the app tree', async ({ page }) => {
    await page.goto('/nl');

    const href = await page.locator('link[rel="manifest"]').first().getAttribute('href');
    expect(href).toBe('/manifest.webmanifest');

    const response = await page.request.get('/manifest.webmanifest');
    expect(response.status()).toBe(200);

    const manifest = (await response.json()) as Manifest;
    expect(manifest.name).toBe('Kynite');
    expect(manifest.start_url).toBe('/nl/today');
    expect(manifest.display).toBe('standalone');
  });

  test('serves a separate hub manifest that launches at the board', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const response = await page.request.get('/hub.webmanifest');
    expect(response.status()).toBe(200);

    const manifest = (await response.json()) as Manifest;
    expect(manifest.start_url).toBe('/nl/hub');
    // Installing the hub must give a wall display, not a second parent app.
    expect(manifest.display).toBe('fullscreen');
  });

  test('the hub tree links its own manifest, not the parent app’s', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    await page.goto('/nl/hub');

    const href = await page.locator('link[rel="manifest"]').first().getAttribute('href');
    expect(href).toBe('/hub.webmanifest');
  });

  test('every declared icon actually resolves', async ({ page }) => {
    const manifest = (await (await page.request.get('/manifest.webmanifest')).json()) as Manifest;
    const icons = manifest.icons ?? [];

    expect(icons.length).toBeGreaterThanOrEqual(2);

    for (const icon of icons) {
      const response = await page.request.get(icon.src);
      // A manifest pointing at a 404 is the classic silent uninstallability.
      expect(response.status(), `${icon.src} should be served`).toBe(200);
      expect(response.headers()['content-type']).toContain('image/png');
    }
  });

  test('serves a service worker that may claim the whole origin', async ({ page }) => {
    const response = await page.request.get('/serwist/sw.js');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('javascript');
    // Without this header a worker served from `/serwist/` could only control
    // `/serwist/` — neither the hub nor the parent app.
    expect(response.headers()['service-worker-allowed']).toBe('/');
    // Never cached: a stale worker is a deploy that never reaches the wall.
    expect(response.headers()['cache-control']).toContain('no-store');
  });

  test('registers a service worker and takes control of the page', async ({ page }) => {
    // `/nl/hub` rather than `/nl`: B-1 moved `ServiceWorkerRegistrar` out of
    // the root `[locale]` layout (shared with the caregiver `(share)` tree,
    // which must never install one) and into `(app)` and `(hub)` only. An
    // unpaired browser here redirects to `/nl/hub/pair`, still inside
    // `(hub)/layout.tsx`.
    await page.goto('/nl/hub');

    const scope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.scope;
    });

    // Scope `/`: one worker for both surfaces (§6).
    expect(new URL(scope).pathname).toBe('/');

    // A controller means the *page* is being served through the worker, which
    // is the precondition for every offline guarantee in this milestone.
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
        timeout: 15_000,
      })
      .toBe(true);
  });
});
