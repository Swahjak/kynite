import { expect, test } from '@playwright/test';

import { gotoDesignPage } from '@e2e/utils/design-page';

/**
 * Visual regression baseline for the design system (M02).
 * Update with `pnpm e2e:visual:update` after an intentional token change.
 */
test.describe('design system visuals', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const theme of ['light', 'dark'] as const) {
    test(`/dev/design renders in ${theme} mode`, async ({ page }) => {
      await gotoDesignPage(page, theme);

      await expect(page).toHaveScreenshot(`design-system-${theme}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.01,
        animations: 'disabled',
      });
    });
  }

  test('the theme toggle switches the document theme', async ({ page }) => {
    await gotoDesignPage(page, 'light');

    const toggle = page.getByTestId('theme-toggle');
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click();

    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});
