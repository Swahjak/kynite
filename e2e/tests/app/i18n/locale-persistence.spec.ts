import { expect, test } from '@playwright/test';

/**
 * Every test in this file starts from a browser that has never been anything.
 *
 * The `app` project hands each context the baseline parent's session (M17), so
 * that the surfaces a signed-in parent uses need no setup. This file is about
 * the other half — the sign-up form, the sign-in guard, the locale a *new*
 * visitor lands on — and all of it is a different assertion once a session is
 * already present.
 */
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

/**
 * M15 acceptance: "locale persists across navigation and after sign-in."
 * `smoke.spec.ts` covers `/` → `/nl` and `/en` being reachable in isolation;
 * this covers the part that actually matters for a bilingual family — that
 * choosing `/en` once keeps every subsequent link, redirect and auth
 * transition inside `/en/...` rather than silently falling back to `nl`.
 */

function uniqueEmail(): string {
  return `e2e-i18n-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
}

const PASSWORD = 'correct-horse-battery';

test.describe('locale persistence', () => {
  test('sign-up under /en lands the new family on /en/family', async ({ page }) => {
    const email = uniqueEmail();
    const familyName = `EN Family ${Date.now()}`;

    await page.goto('/en/sign-up');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.getByLabel('Your name').fill('Sam');
    await page.getByLabel('Family name').fill(familyName);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create family' }).click();

    await expect(page).toHaveURL(/\/en\/family$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { name: familyName })).toBeVisible();
  });

  test('locale survives sign-out and sign-in under /en', async ({ page }) => {
    const email = uniqueEmail();
    const familyName = `EN Return ${Date.now()}`;

    await page.goto('/en/sign-up');
    await page.getByLabel('Your name').fill('Sam');
    await page.getByLabel('Family name').fill(familyName);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create family' }).click();
    await expect(page).toHaveURL(/\/en\/family$/);

    // See the comment in the navigation test below: first visit to a route
    // under the e2e dev server pays a one-time on-demand compile.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/en\/sign-in$/, { timeout: 15000 });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/en\/family$/, { timeout: 15000 });
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('navigating between app sections under /en stays in /en', async ({ page }) => {
    const email = uniqueEmail();
    const familyName = `EN Nav ${Date.now()}`;

    await page.goto('/en/sign-up');
    await page.getByLabel('Your name').fill('Sam');
    await page.getByLabel('Family name').fill(familyName);
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create family' }).click();
    await expect(page).toHaveURL(/\/en\/family$/);

    // A generous timeout here, not a shorter default one: this is the e2e
    // dev-server webServer (`playwright.config.ts`), so the *first* visit to
    // each of these routes in the run pays a one-time on-demand compile, not
    // just a client-side transition — the same cost `page.goto()` pays
    // elsewhere in this suite.
    await page.getByRole('link', { name: 'Today', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/today$/, { timeout: 15000 });

    await page.getByRole('link', { name: 'Calendar', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/calendar$/, { timeout: 15000 });

    await page.getByRole('link', { name: 'Routines', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/routines$/, { timeout: 15000 });
  });

  test('a nl session never crosses into /en and vice versa on the sign-in guard', async ({
    page,
  }) => {
    // M18 added `?callbackUrl=` to the guard's redirect, so the path is no
    // longer the whole URL. The crossing this test is about is asserted on
    // *both* halves now: the sign-in page must be in-locale, and so must the
    // route it will send the parent back to — a `callbackUrl` that had lost
    // its prefix would bounce an English parent into the Dutch app after they
    // signed in, which is the same bug one navigation later.
    for (const locale of ['en', 'nl'] as const) {
      await page.goto(`/${locale}/today`);
      await expect(page).toHaveURL(new RegExp(`/${locale}/sign-in\\?`));

      const url = new URL(page.url());
      expect(url.pathname).toBe(`/${locale}/sign-in`);
      expect(url.searchParams.get('callbackUrl')).toBe(`/${locale}/today`);
    }
  });
});
