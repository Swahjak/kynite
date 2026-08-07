import { pairHub, unpairHub } from '../../fixtures/hub';
import { expect, test } from '../../fixtures/family';

/**
 * Signing out takes this device's copy of the household with it (M11 review
 * blocker 1).
 *
 * The scenario is a shared tablet, which is the most ordinary device this
 * product has. Parent A opens `/nl/today`; the service worker stores that
 * rendered document in `kynite-app-pages-v1`, keyed by URL and nothing else,
 * and the hub board is mirrored to IndexedDB. A signs out and B signs in. The
 * next time the network is slow enough to trip the three-second fuse, the
 * worker serves A's page — with A's family on it — to B. No server-side guard
 * is consulted to answer from a cache, so the only place this can be fixed is
 * in the browser, at sign-out.
 *
 * What is asserted is the *absence of A's content*, not the absence of the
 * caches themselves: the sign-in page A is redirected to is itself a cacheable
 * navigation, so a cache existing after sign-out is normal and expected. What
 * must not exist is anything rendered for the session that just ended.
 */

type CacheContents = { cache: string; urls: string[] }[];

async function cacheContents(page: import('@playwright/test').Page): Promise<CacheContents> {
  return page.evaluate(async () => {
    const names = await caches.keys();
    return Promise.all(
      names.map(async (cache) => {
        const entries = await (await caches.open(cache)).keys();
        return { cache, urls: entries.map((request) => request.url) };
      })
    );
  });
}

async function databaseNames(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(async () =>
    (await indexedDB.databases()).map((entry) => entry.name ?? '').filter(Boolean)
  );
}

const urlsIn = (contents: CacheContents) => contents.flatMap((entry) => entry.urls);

test.describe('sign-out', () => {
  test('clears every page cache and IndexedDB store this session filled', async ({
    page,
    family,
  }) => {
    // M12: hub surfaces run behind a device principal. This browser is the
    // wall tablet for the first half of the test and the parent's phone for
    // the second — which no real device does, but the claim under test is
    // about one *cache storage* holding both surfaces' documents, and cache
    // storage is per browsing context.
    await pairHub(page, family.familyId);

    // The hub fills both the shell cache and the IndexedDB mirror...
    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
        timeout: 20_000,
      })
      .toBe(true);
    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();

    // ...and the parent app fills the page cache with a document that is
    // *this household's* today. The device cookie goes first: it outranks the
    // account session, and `(app)` is member-only.
    await unpairHub(page);
    await page.goto('/nl/today');
    await expect(page.getByRole('button', { name: 'Uitloggen' })).toBeVisible();
    await page.goto('/nl/today');
    await expect(page.getByRole('button', { name: 'Uitloggen' })).toBeVisible();

    // The precondition, asserted rather than assumed: without this the test
    // could pass on a device that never cached anything.
    await expect
      .poll(
        async () => urlsIn(await cacheContents(page)).filter((url) => url.includes('/nl/hub')),
        {
          timeout: 20_000,
        }
      )
      .not.toHaveLength(0);
    await expect
      .poll(async () => (await databaseNames(page)).includes('kynite-offline'), {
        timeout: 20_000,
      })
      .toBe(true);

    await page.getByRole('button', { name: 'Uitloggen' }).click();
    await page.waitForURL(/\/nl\/sign-in$/);

    const remaining = urlsIn(await cacheContents(page));
    expect(remaining.filter((url) => url.includes('/nl/today'))).toHaveLength(0);
    expect(remaining.filter((url) => url.includes('/nl/hub'))).toHaveLength(0);

    // Both hand-rolled stores are gone: the mirrored board, and the completion
    // outbox — a queued tap belongs to the person who made it and must never
    // be replayed under the next session.
    const databases = await databaseNames(page);
    expect(databases).not.toContain('kynite-offline');
    expect(databases).not.toContain('kynite-realtime');
  });

  test('keeps the asset cache — fonts and celebrations belong to the device', async ({ page }) => {
    await page.goto('/nl/today');
    await expect(page.getByRole('button', { name: 'Uitloggen' })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.goto('/nl/today');

    const before = (await cacheContents(page)).find((entry) => entry.cache === 'kynite-assets-v1');
    test.skip(!before || before.urls.length === 0, 'no assets cached in this run');

    await page.getByRole('button', { name: 'Uitloggen' }).click();
    await page.waitForURL(/\/nl\/sign-in$/);

    // §6 promises a celebration never waits on a network, and that promise is
    // made to the device, not to whoever happens to be signed in on it.
    const after = (await cacheContents(page)).find((entry) => entry.cache === 'kynite-assets-v1');
    expect(after?.urls.length ?? 0).toBeGreaterThan(0);
  });
});
