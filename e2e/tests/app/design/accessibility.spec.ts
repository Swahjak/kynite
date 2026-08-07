import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { gotoDesignPage } from '@e2e/utils/design-page';

/**
 * M02 acceptance criterion: zero WCAG AA contrast violations on /dev/design in
 * both themes. Colour tokens are the fix — never the exclusion list.
 */
test.describe('design system accessibility', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`has no WCAG AA contrast violations in ${theme} mode`, async ({ page }) => {
      await gotoDesignPage(page, theme);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const contrast = results.violations.filter((v) => v.id === 'color-contrast');
      expect(
        contrast.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')} — ${n.failureSummary}`))
      ).toEqual([]);
    });

    test(`has no WCAG A/AA violations of any kind in ${theme} mode`, async ({ page }) => {
      await gotoDesignPage(page, theme);

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
    });
  }
});
