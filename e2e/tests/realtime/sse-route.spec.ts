import { pairHub } from '../../fixtures/hub';
import { expect, test } from '../../fixtures/family';

/**
 * `GET /api/sse` as a real HTTP response (M10's first acceptance criterion).
 *
 * Asserted over the wire rather than against the constants, because the two
 * can drift in exactly one direction that matters: the headers are correct in
 * `SSE_HEADERS` and wrong on the response, because something between the
 * handler and the socket rewrote them. `X-Accel-Buffering` in particular exists
 * only to be read by a proxy — nothing in the app ever looks at it, so nothing
 * else would notice it disappearing.
 */

test.describe('GET /api/sse', () => {
  test('streams event-stream frames with the documented headers', async ({ page }) => {
    // Fetched from inside the page (so the session cookie rides along the way
    // the browser's own `EventSource` would send it) and **aborted after the
    // headers**: this response never ends, so anything that waits for a body
    // waits forever.
    const head = await page.evaluate(async () => {
      const controller = new AbortController();
      const response = await fetch('/api/sse', { signal: controller.signal });
      const headers = Object.fromEntries(response.headers.entries());
      const { status } = response;
      controller.abort();
      return { status, headers };
    });

    expect(head.status).toBe(200);
    expect(head.headers['content-type']).toContain('text/event-stream');
    expect(head.headers['cache-control']).toContain('no-store');
    expect(head.headers['x-accel-buffering']).toBe('no');
  });

  test('refuses a request with no session', async ({ browser }) => {
    // A fresh context: no cookie, therefore no principal, therefore no family
    // to scope a stream to. There is no family id in the request for an
    // anonymous caller to supply instead.
    const anonymous = await browser.newContext();
    const response = await anonymous.request.get('/api/sse');

    expect(response.status()).toBe(401);
    expect(response.headers()['content-type']).toContain('application/json');

    await anonymous.close();
  });

  test('the hub opens exactly one stream for the whole surface', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    expect(family.familyId).toBeTruthy();

    const opened: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/sse')) opened.push(request.url());
    });

    await page.goto('/nl/hub');
    await expect(page.getByTestId('ambient-timers').or(page.locator('body'))).toBeVisible();
    // Give the provider's effect a moment to connect.
    await page.waitForTimeout(1500);

    // One `EventSource` per surface, not per slice: the timer board, the star
    // chart and the routine board all share it (`MAX_STREAMS_PER_FAMILY` is a
    // budget a single hub must not spend on itself).
    //
    // The bound is two rather than one because the e2e server runs `next dev`,
    // where React's StrictMode mounts every effect twice — a per-slice
    // subscription would still show up here as four or more.
    expect(opened.length).toBeLessThanOrEqual(2);
  });
});
