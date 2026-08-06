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
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
    }
    /* The Next.js dev-mode indicator is not part of the design system. */
    nextjs-portal { display: none !important; }`,
  });
  await page.waitForTimeout(150);
}
