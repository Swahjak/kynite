import { expect, test } from '@playwright/test';

import { DESIGN_ROUTE } from '@e2e/utils/design-page';

/**
 * M02 acceptance criterion: fonts are self-hosted. Nothing may hit
 * fonts.googleapis.com or fonts.gstatic.com at runtime.
 */
test('serves Lexend, Noto Sans and Material Symbols from our own origin', async ({ page }) => {
  const external: string[] = [];
  const fontRequests: string[] = [];

  page.on('request', (request) => {
    const url = request.url();
    if (/fonts\.(googleapis|gstatic)\.com/.test(url)) {
      external.push(url);
    }
    if (request.resourceType() === 'font') {
      fontRequests.push(url);
    }
  });

  await page.goto(DESIGN_ROUTE);
  await page.waitForFunction(() => document.fonts.status === 'loaded');

  expect(external).toEqual([]);
  expect(fontRequests.length).toBeGreaterThan(0);
  expect(fontRequests.every((url) => url.startsWith(page.url().split('/dev')[0]))).toBe(true);

  // next/font hashes family names (fontDisplay / fontBody / fontIcon come from
  // the exported const names in src/lib/fonts.ts), so assert on those.
  const families = await page.evaluate(() => {
    const loaded = new Set<string>();
    document.fonts.forEach((face) => loaded.add(face.family));
    return [...loaded].join(' ');
  });

  expect(families).toContain('fontDisplay');
  expect(families).toContain('fontBody');
  expect(families).toContain('fontIcon');

  // The rendered stacks actually resolve to the self-hosted families.
  const stacks = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    heading: getComputedStyle(document.querySelector('h1') as Element).fontFamily,
    icon: getComputedStyle(document.querySelector('[data-slot="icon"]') as Element).fontFamily,
  }));

  expect(stacks.body).toContain('fontBody');
  expect(stacks.heading).toContain('fontDisplay');
  expect(stacks.icon).toContain('fontIcon');
});
