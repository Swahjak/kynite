import { expect, test } from '@playwright/test';

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
