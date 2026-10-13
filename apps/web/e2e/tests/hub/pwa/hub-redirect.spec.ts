import { expect, test } from '@playwright/test';

/**
 * H3 (D12): every old `/hub/*` path permanently redirects to its twin on the
 * one route tree (`proxy.ts`, `HUB_REDIRECTS`). The Fully kiosk and the
 * installed hub PWA still open `/nl/hub` (`public/hub.webmanifest`'s
 * `start_url`), so this redirect is the hub's front door — nothing else in the
 * suite would notice if it went missing.
 *
 * Asserted on the raw response (`maxRedirects: 0`): the redirect is a URL
 * rewrite that runs before any cookie check, so it needs no paired device.
 */

const MEMBER_ID = '00000000-0000-4000-8000-000000000001';

test.describe('legacy /hub URLs', () => {
  test('bare /nl/hub redirects permanently to /nl/today', async ({ request }) => {
    const response = await request.get('/nl/hub', { maxRedirects: 0 });

    expect(response.status()).toBe(308);
    expect(new URL(response.headers()['location']!, 'http://x').pathname).toBe('/nl/today');
  });

  test('/nl/hub/routines/<id> keeps its tail on the way to /nl/routines/<id>', async ({
    request,
  }) => {
    const response = await request.get(`/nl/hub/routines/${MEMBER_ID}`, { maxRedirects: 0 });

    expect(response.status()).toBe(308);
    expect(new URL(response.headers()['location']!, 'http://x').pathname).toBe(
      `/nl/routines/${MEMBER_ID}`
    );
  });

  test('a renamed segment lands on its new name (/nl/hub/kalender -> /nl/calendar)', async ({
    request,
  }) => {
    const response = await request.get('/nl/hub/kalender', { maxRedirects: 0 });

    expect(response.status()).toBe(308);
    expect(new URL(response.headers()['location']!, 'http://x').pathname).toBe('/nl/calendar');
  });

  test('an unknown segment falls back to /nl/today', async ({ request }) => {
    const response = await request.get('/nl/hub/does-not-exist', { maxRedirects: 0 });

    expect(response.status()).toBe(308);
    expect(new URL(response.headers()['location']!, 'http://x').pathname).toBe('/nl/today');
  });

  test('the query string survives the redirect', async ({ request }) => {
    const response = await request.get('/nl/hub/kalender?date=2026-10-13', { maxRedirects: 0 });

    expect(response.status()).toBe(308);
    const location = new URL(response.headers()['location']!, 'http://x');
    expect(location.pathname).toBe('/nl/calendar');
    expect(location.searchParams.get('date')).toBe('2026-10-13');
  });
});
