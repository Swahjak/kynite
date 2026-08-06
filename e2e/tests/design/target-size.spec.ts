import { expect, test } from '@playwright/test';

import { gotoDesignPage } from '../../utils/design-page';

const MIN_TARGET = 48;

/**
 * Base UI mirrors component state into visually hidden, `aria-hidden`,
 * unfocusable native inputs (e.g. the Select's form value). Those are not touch
 * targets, so every selector filters them out rather than the audit
 * special-casing them afterwards.
 */
const NOT_HIDDEN = ':not([aria-hidden="true"]):not([type="hidden"])';

const INTERACTIVE_SELECTOR = [
  'button',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="combobox"]',
  'a[href]',
  'input',
  'select',
  'textarea',
]
  .map((selector) => `${selector}${NOT_HIDDEN}`)
  .join(', ');

/**
 * M02 acceptance criterion: every interactive primitive in its hub variant is
 * at least 48x48 CSS px — the kiosk touch target from the Stitch design spec.
 */
test.describe('hub target sizes', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`every hub-variant control is >= ${MIN_TARGET}px in ${theme} mode`, async ({ page }) => {
      await gotoDesignPage(page, theme);

      const section = page.getByTestId('hub-variants');
      await expect(section).toBeVisible();

      const controls = section.locator(INTERACTIVE_SELECTOR);
      const count = await controls.count();
      // 5 buttons + hub input + hub select trigger + 3 hub tabs.
      expect(count).toBe(10);

      const undersized: string[] = [];

      for (let i = 0; i < count; i += 1) {
        const control = controls.nth(i);
        const box = await control.boundingBox();
        const describe = await control.evaluate((el) => {
          const tag = el.tagName.toLowerCase();
          const slot = el.getAttribute('data-slot') ?? '';
          const label =
            el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30) ?? '(no label)';
          return `${tag}[${slot}] "${label}"`;
        });

        if (!box) {
          undersized.push(`${describe} — not rendered`);
          continue;
        }

        if (box.width < MIN_TARGET || box.height < MIN_TARGET) {
          undersized.push(`${describe} — ${Math.round(box.width)}x${Math.round(box.height)}`);
        }
      }

      expect(undersized).toEqual([]);
    });
  }
});
