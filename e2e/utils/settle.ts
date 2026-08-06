import type { Page } from '@playwright/test';

/**
 * Put a page into a screenshot-stable state.
 *
 * The same discipline `utils/design-page.ts` applies to `/dev/design`, factored
 * out so the calendar visuals cannot drift from it: wait for font loading to
 * settle (not for a guessed number of milliseconds), then kill animations,
 * transitions and the caret so nothing is mid-flight when the shot is taken.
 */
export async function settlePage(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));

  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation: none !important;
      transition: none !important;
      caret-color: transparent !important;
    }
    /* The Next.js dev-mode indicator is not part of the design. */
    nextjs-portal { display: none !important; }`,
  });

  // Style injection can itself trigger a font load (a newly visible element in
  // a family that had not been used yet), so settle once more afterwards.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}
