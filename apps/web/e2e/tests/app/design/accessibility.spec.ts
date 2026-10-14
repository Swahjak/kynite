import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { gotoDesignPage } from '@e2e/utils/design-page';

/**
 * Zero WCAG A/AA violations on /dev/design in both themes. Colour contrast is
 * not checked (D32: the design leads).
 */
test.describe('design system accessibility', { tag: '@heavy' }, () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`has no WCAG A/AA violations of any kind in ${theme} mode`, async ({ page }) => {
      await gotoDesignPage(page, theme);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .disableRules(['color-contrast'])
        .analyze();

      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
    });
  }
});
