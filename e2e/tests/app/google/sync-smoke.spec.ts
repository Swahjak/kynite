import { expect, test } from '@e2e/fixtures/family';
import { withDb } from '@e2e/utils/seed';

/**
 * Google Calendar sync, end to end, with Google as the only fake (M17).
 *
 * Everything in this file is the real thing except the far side of the
 * network: a real OAuth redirect out and back, a real form POST to the token
 * endpoint, real bearer-authenticated `calendarList` and `events` requests,
 * real token encryption at rest, the real sync engine and the real store. What
 * is faked is Google itself — a Node server on `GOOGLE_API_BASE_URL`
 * (`e2e/support/fake-google.mjs`) answering the paths the app requests. No
 * internal module is stubbed anywhere in this path, which is exactly the M17
 * rule.
 *
 * It runs against the second app server, the one booted *with* Google
 * credentials — see `playwright.config.ts` for why there are two.
 */

test.use({ baseURL: process.env.E2E_GOOGLE_BASE_URL });

test.describe('google calendar sync smoke', () => {
  test('links an account, discovers a calendar and pulls an event onto the board', async ({
    page,
    family,
  }) => {
    await page.goto('/nl/settings/google');

    // Linking is offered, because this server *is* configured.
    // A Base UI `Button` rendered as an `<a>`: the accessible role stays
    // `button` (see `google-accounts-panel.tsx`), so that is what it is
    // reached by.
    const link = page.getByRole('button', { name: 'Google-account koppelen' });
    await expect(link).toBeVisible();

    // One click, and the whole consent round trip happens for real: our start
    // route → the fake's authorize endpoint → back to our callback with a code
    // → token exchange → userinfo → account row → calendar discovery.
    await link.click();
    await page.waitForURL(/\/nl\/settings\/google/);

    // No error, and the account card is on screen. That pairing is the point:
    // the first run of this spec redirected to `?error=linkFailed` over a
    // household whose account *was* linked, because the post-link
    // `enqueueCalendarSync` threw on a process with no job queues. The link no
    // longer depends on it (see `modules/google/linking.ts`).
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('ouder@example.test');
    await expect(page.getByText('ouder@example.test').first()).toBeVisible();
    await expect(page.getByText('Gezinsagenda (Google)')).toBeVisible();

    // The tokens landed encrypted, not in the clear (§5). Asserted here rather
    // than trusted, because this is the only path that ever writes them.
    const account = await withDb(async (client) => {
      const { rows } = await client.query<{ access_token: string; refresh_token: string }>(
        `select access_token, refresh_token from google_account where family_id = $1`,
        [family.familyId]
      );
      return rows[0];
    });
    expect(account.access_token).not.toContain('fake-access-token');
    expect(account.access_token.startsWith('v1:')).toBe(true);

    // Turn the calendar on, the way a parent does.
    // Linking auto-enables the primary calendar, so this is a no-op assertion
    // when it is already on — and a real click when it is not.
    const enable = page.getByRole('button', { name: 'Synchroniseren', exact: true });
    if (await enable.count()) await enable.first().click();
    await expect(page.getByRole('button', { name: 'Niet meer synchroniseren' })).toBeVisible();

    const calendarId = await withDb(async (client) => {
      const { rows } = await client.query<{ id: string; sync_enabled: boolean }>(
        `select id, sync_enabled from calendar
           where family_id = $1 order by created_at desc limit 1`,
        [family.familyId]
      );
      expect(rows[0].sync_enabled).toBe(true);
      return rows[0].id;
    });

    // Run the pull. In production a pg-boss worker does this; the e2e server
    // runs without workers on purpose, so the same `syncCalendarById` is
    // invoked directly through a development-only route (see that route's own
    // note — it triggers the real path, it does not stand in for it).
    const response = await page.request.post('/api/dev/google/sync', {
      data: { calendarId },
    });
    expect(response.ok()).toBe(true);

    // The event Google returned is now the family's, with its own row.
    const events = await withDb(async (client) => {
      const { rows } = await client.query<{ title: string; google_event_id: string | null }>(
        `select title, google_event_id from event where family_id = $1`,
        [family.familyId]
      );
      return rows;
    });
    expect(events.map((row) => row.title)).toContain('Tandarts (Google)');

    // And it renders where a parent would look for it.
    await page.goto('/nl/calendar?date=2026-03-11');
    await expect(page.getByText('Tandarts (Google)').first()).toBeVisible();
  });
});
