import { expect, test } from '@e2e/fixtures/family';
import { expectNoAxeViolations } from '@e2e/utils/axe';
import { seedHousehold } from '@e2e/utils/household';

/**
 * Zero WCAG AA violations across the parent app (M17).
 *
 * Every surface is seeded first. An axe run against an empty family passes by
 * having nothing on screen — no routine cards to label, no shelf, no chips —
 * which is the accessibility equivalent of a test that asserts `true`. The
 * household comes from the factory, so this spec owns its data and can run
 * twice concurrently.
 */

const SURFACES = [
  { name: 'today', path: () => '/nl/today' },
  { name: 'calendar', path: () => '/nl/calendar' },
  { name: 'routines', path: () => '/nl/routines' },
  { name: 'rewards', path: () => '/nl/rewards' },
  { name: 'settings', path: () => '/nl/settings' },
] as const;

test.describe('parent app accessibility', { tag: '@heavy' }, () => {
  for (const surface of SURFACES) {
    test(`${surface.name} has no WCAG AA violations`, async ({ page, family }) => {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(
        new Date()
      );
      await seedHousehold(family.familyId, today);

      await page.goto(surface.path());
      // Something rendered: axe on a blank page is a green run with no content.
      await expect(page.locator('main')).toBeVisible();
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      await expectNoAxeViolations(page, `the ${surface.name} surface`);
    });
  }
});
