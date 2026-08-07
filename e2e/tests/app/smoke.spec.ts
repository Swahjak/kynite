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
 * "Renders" is asserted through the landing page's *own* shape (M19).
 *
 * Until M19 the marketing route was the M01 scaffold — a bare `<h1>Kynite</h1>`
 * — so the product name doubled as proof the page had rendered. The rewrite
 * gives the route a real hero: the wordmark is a `<BrandMark>` image in the
 * banner and the `<h1>` is the proposition ("Eén overzicht voor het hele
 * gezin."). Asserting the *marks* rather than a literal string keeps the check
 * about "the localized landing page rendered" without pinning copy that
 * marketing is expected to rewrite.
 */
function landed(page: import('@playwright/test').Page) {
  return {
    wordmark: page.getByRole('banner').getByRole('img', { name: 'Kynite' }),
    hero: page.getByRole('heading', { level: 1 }),
  };
}

test.describe('smoke', () => {
  test('home page redirects to the default locale and renders', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/nl$/);
    await expect(landed(page).wordmark).toBeVisible();
    await expect(landed(page).hero).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  });

  test('the en locale is reachable', async ({ page }) => {
    await page.goto('/en');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(landed(page).wordmark).toBeVisible();
    await expect(landed(page).hero).toBeVisible();
    // The locale reached the copy, not just the `lang` attribute.
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });
});
