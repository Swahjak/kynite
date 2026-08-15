import { pairHub } from '@e2e/fixtures/hub';
import { expect, test } from '@e2e/fixtures/family';
import { expectNoAxeViolations } from '@e2e/utils/axe';
import { seedHousehold } from '@e2e/utils/household';

/**
 * Zero WCAG AA violations across the wall display (M17).
 *
 * The hub is the surface where this matters most and is easiest to get wrong:
 * it is glanceable, it is operated by a child, and most of its controls are
 * icons. A missing accessible name on a step tap is invisible to everyone who
 * can see the icon.
 */

/**
 * A pinned clock, so the board is audited in one known state rather than
 * whichever one the time of day produces — the past-event treatment in
 * particular is only on screen after the seeded morning event has ended.
 */
const CLOCK = 'time=13:00';

const SURFACES = [
  { name: 'board', path: () => `/nl/hub?${CLOCK}` },
  { name: 'routines', path: (ids: { child: string }) => `/nl/hub/routines/${ids.child}` },
  { name: 'star chart', path: (ids: { child: string }) => `/nl/hub/stars/${ids.child}` },
  { name: 'store', path: (ids: { child: string }) => `/nl/hub/store?member=${ids.child}` },
  { name: 'timers', path: () => `/nl/hub/timers` },
] as const;

test.describe('hub accessibility', { tag: '@heavy' }, () => {
  for (const surface of SURFACES) {
    test(`the hub ${surface.name} has no WCAG AA violations`, async ({ page, family }) => {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(
        new Date()
      );
      const { children } = await seedHousehold(family.familyId, today);

      // M12: hub surfaces run behind a device principal, never an account.
      await pairHub(page, family.familyId);

      await page.goto(surface.path({ child: children[0].id }));
      await expect(page.locator('main')).toBeVisible();
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      await expectNoAxeViolations(page, `the hub ${surface.name}`);
    });
  }
});
