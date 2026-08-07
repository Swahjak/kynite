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

test.describe('smoke', () => {
  test('home page redirects to the default locale and renders', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/nl$/);
    await expect(page.getByRole('heading', { name: 'Kynite' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  });

  test('the en locale is reachable', async ({ page }) => {
    await page.goto('/en');

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { name: 'Kynite' })).toBeVisible();
  });
});
