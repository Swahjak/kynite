import { expect, test } from '../../fixtures/family';

/**
 * M11: "Hub boots and renders the last-known schedule with the network
 * disabled — Playwright offline test."
 *
 * PRD FR21 in the flesh: a wall tablet whose wifi has dropped keeps showing
 * the plan. The failure this prevents is not a broken page, it is a *blank
 * kitchen wall on a Tuesday morning* — the one moment the household is relying
 * on the thing being there.
 *
 * Two mechanisms are exercised, in the order they matter:
 *
 *  1. the service worker's cached hub document, which is what puts pixels on
 *     the wall with no network at all. The strategy is **`NetworkFirst` with a
 *     two-second fuse**, not §6's literal `StaleWhileRevalidate` — see
 *     `HUB_NETWORK_TIMEOUT_SECONDS` for the argument (a stale document paints a
 *     wrong countdown, which regresses M09);
 *  2. the IndexedDB mirror of family state (§6, hub row 3), which is the data
 *     behind those pixels. It is written on every load and every SSE event and
 *     *read* on boot: when the mirror is newer than the cached document — the
 *     normal case for a tablet that stayed on the board while the network went
 *     — it reconciles the board onto the newer state, and only for its own
 *     family.
 *
 * And the indicator that tells a parent which of the two they are looking at —
 * derived from the stream, not from `navigator.onLine` (§6, hub row 4).
 */

type Page = import('@playwright/test').Page;

/** The hub navigation and its RSC refetches — everything that serves the board. */
const HUB_DOCUMENT = '**/nl/hub*';

/** Wait until this page is actually being served through the worker. */
async function waitForController(page: Page): Promise<void> {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
      timeout: 20_000,
    })
    .toBe(true);
}

type MirrorRow = { familyId: string; savedAt: number; data: Record<string, unknown> };

/**
 * Rewrite the mirrored snapshot in place.
 *
 * This is how the *read* path is proved to be live rather than merely present:
 * the board is given a snapshot the server never sent, and if that snapshot
 * reaches the screen then the boot genuinely reconciles from IndexedDB. There
 * is no other way to distinguish "renders from the mirror" from "renders the
 * cached document that happens to say the same thing".
 *
 * `familyId: null` leaves the row's family alone; a string forges it, which is
 * the rejection case.
 */
async function rewriteMirror(
  page: Page,
  patch: { displayName: string; familyId: string | null; newer: boolean }
): Promise<void> {
  await page.evaluate(async (input) => {
    const open = () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('kynite-offline');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(new Error('open failed'));
      });

    const database = await open();
    const row = await new Promise<MirrorRowInPage>((resolve, reject) => {
      const request = database
        .transaction('family-state', 'readonly')
        .objectStore('family-state')
        .get('hub-board');
      request.onsuccess = () => resolve(request.result as MirrorRowInPage);
      request.onerror = () => reject(new Error('read failed'));
    });

    row.savedAt = Date.now();
    if (input.familyId !== null) row.familyId = input.familyId;
    // A minute *ahead* of the document the worker will serve: the swap only
    // happens for a strictly newer snapshot.
    if (input.newer) row.data.generatedAt = Date.now() + 60_000;
    row.data.members = row.data.members.map((member, index) =>
      index === 0 ? { ...member, displayName: input.displayName } : member
    );

    await new Promise<void>((resolve, reject) => {
      const request = database
        .transaction('family-state', 'readwrite')
        .objectStore('family-state')
        .put(row);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('write failed'));
    });
    database.close();
  }, patch);
}

/** The row shape as the page sees it (declared for the evaluated closure). */
type MirrorRowInPage = {
  key: string;
  familyId: string;
  savedAt: number;
  data: { generatedAt: number; members: { displayName: string }[] };
};

/** Poll until the hub has written its snapshot, then hand it back. */
async function waitForMirror(page: Page): Promise<MirrorRow | null> {
  return page.evaluate(async () => {
    /**
     * Only ever *open* the database once it exists. `indexedDB.open(name)`
     * with no version silently creates an empty database, which would then
     * make the app's own `open(name, 1)` skip `onupgradeneeded` and never
     * create the store — a probe that broke the thing it was measuring.
     */
    const exists = async () =>
      (await indexedDB.databases()).some((entry) => entry.name === 'kynite-offline');

    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (await exists()) {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('kynite-offline');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(new Error('open failed'));
        });

        if (database.objectStoreNames.contains('family-state')) {
          const row = await new Promise<unknown>((resolve) => {
            const request = database
              .transaction('family-state', 'readonly')
              .objectStore('family-state')
              .get('hub-board');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
          });
          database.close();
          if (row)
            return row as { familyId: string; savedAt: number; data: Record<string, unknown> };
        } else {
          database.close();
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return null;
  });
}

test.describe('hub offline', () => {
  test('renders the last-known board with the network disabled', async ({ page, context }) => {
    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();
    await waitForController(page);

    // A second visit, so the document is definitely in the cache the worker
    // falls back to when the network fuse blows, not only in the one it just
    // wrote.
    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();

    const onlineHeading = await page.getByTestId('hub-board').locator('h1').first().innerText();

    await context.setOffline(true);
    await page.reload();

    // The wall still has a board on it.
    await expect(page.getByTestId('hub-board')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('hub-board').locator('h1').first()).toHaveText(onlineHeading);

    await context.setOffline(false);
  });

  test('mirrors the board to IndexedDB on every load', async ({ page }) => {
    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();

    const snapshot = await waitForMirror(page);

    expect(snapshot, 'the hub should mirror its board to IndexedDB').not.toBeNull();
    expect(snapshot!.familyId).toMatch(/^[0-9a-f-]{36}$/);
    expect(snapshot!.savedAt).toBeGreaterThan(0);
    expect(snapshot!.data).toHaveProperty('members');
    expect(snapshot!.data).toHaveProperty('timeZone');
    // The instant the reconcile compares against the served document.
    expect(snapshot!.data).toHaveProperty('generatedAt');
  });

  test('boots from the mirror when it is newer than the cached document', async ({
    page,
    context,
  }) => {
    /**
     * §6's "boot renders from IDB then reconciles", proved rather than
     * narrated. The situation staged is the real one: a tablet that stayed on
     * the board while the network went has a *newer* mirror than the document
     * the worker cached, because the mirror is rewritten on every realtime
     * event and the document only on a navigation.
     *
     * The mirrored member name is changed to something the server never sent,
     * so seeing it on the wall can only mean the board reconciled from
     * IndexedDB.
     *
     * **Why the document request is failed instead of the whole network.**
     * Under `next dev` a page that boots with the context offline never runs
     * its JavaScript at all — the HMR client cannot connect and hydration
     * never completes — so a `setOffline` version of this test would assert
     * nothing about the read path while appearing to pass. Failing the
     * navigation alone reproduces precisely the condition under test: the
     * document on screen is the worker's cached one. The sibling test above
     * covers the genuinely-offline half (pixels on the wall with no network).
     */
    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();
    await waitForController(page);
    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();
    expect(await waitForMirror(page)).not.toBeNull();

    await rewriteMirror(page, { displayName: 'Mirror Sanne', familyId: null, newer: true });

    await context.route(HUB_DOCUMENT, (route) => route.abort());
    await page.reload();

    await expect(page.getByTestId('hub-board')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('hub-board')).toContainText('Mirror Sanne', { timeout: 20_000 });

    await context.unroute(HUB_DOCUMENT);
  });

  test('refuses a snapshot belonging to another family', async ({ page, context }) => {
    /**
     * The other half of the same mechanism, and the one that makes it safe to
     * have at all: a shared tablet re-paired to another household must never be
     * reconciled onto the previous one's board. The snapshot below is newer
     * than the document in every way that would otherwise make it win — it
     * simply belongs to someone else. Same staging as the test above, so the
     * difference in outcome is attributable to the family check and nothing
     * else.
     */
    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();
    await waitForController(page);
    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();
    const own = await waitForMirror(page);
    expect(own).not.toBeNull();

    await rewriteMirror(page, {
      displayName: 'Buurfamilie',
      familyId: '00000000-0000-4000-8000-000000000000',
      newer: true,
    });

    await context.route(HUB_DOCUMENT, (route) => route.abort());
    await page.reload();

    const board = page.getByTestId('hub-board');
    await expect(board).toBeVisible({ timeout: 20_000 });
    // The board came from the served document, not from the foreign snapshot.
    await expect(board).toContainText('Sanne');
    await expect(board).not.toContainText('Buurfamilie');

    // And non-vacuously so: the read path did run, rejected the foreign row,
    // and replaced it with this family's own board.
    await expect
      .poll(async () => (await waitForMirror(page))?.familyId, { timeout: 20_000 })
      .toBe(own!.familyId);

    await context.unroute(HUB_DOCUMENT);
  });

  test('says nothing while the stream is healthy', async ({ page }) => {
    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();

    // The board is unchanged the rest of the day: the indicator renders
    // nothing at all unless the stream has actually failed.
    await expect(page.getByTestId('offline-indicator')).toHaveCount(0);
  });

  test('shows the offline notice from the stream, while the browser still claims to be online', async ({
    page,
    context,
  }) => {
    /**
     * The captive-portal case, staged exactly: the *stream* is dead and
     * `navigator.onLine` is `true`. §6 chose the stream over `onLine` because
     * "a captive-portal tablet lies about `onLine`" — this is that lie.
     *
     * `EventSource` is replaced rather than the request blocked: blocking
     * would also block it for the service worker, and what is under test is
     * what the component believes, not what the network did. The script is
     * installed before the first navigation, so the very first connection
     * attempt is the dead one.
     */
    await context.addInitScript(() => {
      // A constructor function rather than a `class`: the provider only ever
      // reads `readyState`, `onerror`, `close()` and `addEventListener`.
      const Dead = function (this: Record<string, unknown>, url: string) {
        this.url = url;
        this.readyState = 2;
        setTimeout(() => (this.onerror as (() => void) | undefined)?.(), 0);
      } as unknown as { new (url: string): EventSource };
      Object.assign(Dead, { CONNECTING: 0, OPEN: 1, CLOSED: 2 });
      Object.assign((Dead as unknown as { prototype: Record<string, unknown> }).prototype, {
        close() {},
        addEventListener() {},
        removeEventListener() {},
      });

      Object.defineProperty(window, 'EventSource', { value: Dead, configurable: true });
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    });

    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();

    await expect(page.getByTestId('offline-indicator')).toBeVisible({ timeout: 20_000 });
    // The lie the indicator refuses to believe.
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);
  });

  test('the board is still readable offline — no error page, no empty shell', async ({
    page,
    context,
  }) => {
    await page.goto('/nl/hub');
    await expect(page.getByTestId('hub-board')).toBeVisible();
    await waitForController(page);
    await page.goto('/nl/hub');

    await context.setOffline(true);
    await page.reload();

    const board = page.getByTestId('hub-board');
    await expect(board).toBeVisible({ timeout: 20_000 });
    // The wall clock and the day are the two things a person reads from six
    // feet away; both come from the cached render.
    await expect(page.getByTestId('hub-clock')).toBeVisible();
    // And nothing on the board apologises for the network.
    await expect(board).not.toContainText(/offline|fout|error/i);

    await context.setOffline(false);
  });
});
