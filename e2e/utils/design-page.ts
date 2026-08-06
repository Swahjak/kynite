import type { Page } from '@playwright/test';

export type Theme = 'light' | 'dark';

export const DESIGN_ROUTE = '/dev/design';

/**
 * Opens `/dev/design` in a deterministic state: the theme is forced through the
 * query string (no click needed), fonts are fully loaded and animations are
 * disabled, so screenshots do not race the font swap.
 */
export async function gotoDesignPage(page: Page, theme: Theme) {
  await page.goto(`${DESIGN_ROUTE}?theme=${theme}`);

  await page.waitForFunction(
    (expected) => document.documentElement.dataset.theme === expected,
    theme
  );
  // `document.fonts.ready` resolves once font loading has *settled*, which is
  // the actual precondition for a stable screenshot. Polling `status` can
  // observe a transient 'loaded' between two loads, which is what the old
  // arbitrary 150ms sleep below was really compensating for.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
    }
    /* The Next.js dev-mode indicator is not part of the design system. */
    nextjs-portal { display: none !important; }`,
  });

  // Nothing arbitrary left to wait for: fonts have settled and animations are
  // off, so the next paint is the one we screenshot.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}
