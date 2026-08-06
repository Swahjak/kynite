import { expect, test } from '@playwright/test';

/**
 * M05 acceptance, end to end: the webhook is real and fast, the OAuth start
 * route is real and authorized, and an installation without Google credentials
 * degrades to a clear message instead of a broken consent screen.
 *
 * The e2e server runs without `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` on
 * purpose — no third-party secret belongs in a test run, and "unconfigured" is
 * a state a self-hosted install genuinely has.
 */

function uniqueEmail(): string {
  return `e2e-google-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

async function signUp(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/nl/sign-up');
  await page.getByLabel('Jouw naam').fill('Sarah');
  await page.getByLabel('Naam van je gezin').fill(`Familie Google ${Date.now()}`);
  await page.getByLabel('E-mailadres').fill(uniqueEmail());
  await page.getByLabel('Wachtwoord').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Gezin aanmaken' }).click();
  await expect(page).toHaveURL(/\/nl\/family$/);
}

test.describe('google webhook', () => {
  test('answers an unknown channel with 200, fast, without syncing', async ({ request }) => {
    // Warm-up: the dev server compiles the route on first hit, which is not
    // what the latency budget is about.
    await request.post('/api/webhooks/google-calendar', { headers: {} });

    const started = Date.now();

    const response = await request.post('/api/webhooks/google-calendar', {
      headers: {
        'x-goog-channel-id': 'unknown-channel',
        'x-goog-channel-token': 'guessed',
        'x-goog-resource-id': 'resource-1',
        'x-goog-resource-state': 'exists',
      },
    });

    // Google retries aggressively on non-200s and disables slow channels, so
    // the handler always answers 200 and never blocks on a sync.
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ ok: false, reason: 'unknown_channel' });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  test('rejects a notification with no channel id', async ({ request }) => {
    const response = await request.post('/api/webhooks/google-calendar', {
      headers: { 'x-goog-resource-state': 'exists' },
    });

    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ reason: 'missing_channel_id' });
  });
});

test.describe('google settings', () => {
  test('turns an anonymous OAuth start into a sign-in redirect', async ({ page }) => {
    await page.goto('/api/google/oauth/start');
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test('explains that linking is switched off when credentials are unset', async ({ page }) => {
    await signUp(page);

    await page.getByRole('link', { name: 'Instellingen' }).click();
    await expect(page).toHaveURL(/\/nl\/settings\/google$/);

    await expect(page.getByRole('heading', { name: 'Google Agenda' })).toBeVisible();
    await expect(page.getByText(/GOOGLE_CLIENT_ID/)).toBeVisible();
    await expect(page.getByText('Er is nog geen Google-account gekoppeld.')).toBeVisible();
    // No link button while unconfigured: the flow would only dead-end.
    await expect(page.getByRole('link', { name: 'Google-account koppelen' })).toHaveCount(0);
  });

  test('sends an authorized parent to the settings page with a reason when unconfigured', async ({
    page,
  }) => {
    await signUp(page);

    // Warm-up: same reason as above — the first hit compiles the route.
    await page.request.get('/api/google/oauth/start', { maxRedirects: 0 });

    await page.goto('/api/google/oauth/start');

    await expect(page).toHaveURL(/\/nl\/settings\/google\?error=notConfigured$/);
    // Scoped to the page's own alert: Next.js renders a route announcer with
    // the same role.
    await expect(page.getByRole('alert').first()).toContainText('niet ingesteld');
  });
});
