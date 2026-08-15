import { newAnonymousContext } from '@e2e/utils/context';
import { expect, test } from '@e2e/fixtures/family';
import { expectNoAxeViolations } from '@e2e/utils/axe';
import { seedHousehold } from '@e2e/utils/household';
import { seedCalendar, seedEvents, seedShareLink, withDb } from '@e2e/utils/seed';

/**
 * Zero WCAG AA violations on the caregiver share view (M17).
 *
 * Both roles, because they are different documents: a viewer link renders a
 * read-only schedule with nothing to press, and a contributor link adds the
 * tick controls — which are the interactive elements that can lack a name.
 *
 * Read in a **fresh context** with no cookies, the way a grandparent opens the
 * link. That is also what proves the surface needs no session to be
 * accessible: it renders, and it is labelled, for somebody who has never
 * signed in to anything.
 */

test.describe('share view accessibility', { tag: '@heavy' }, () => {
  for (const role of ['viewer', 'contributor'] as const) {
    test(`a ${role} link has no WCAG AA violations`, async ({ browser, family }) => {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(
        new Date()
      );
      const { owner, children } = await seedHousehold(family.familyId, today);

      // `calendar:view_private` is `deny` for both share roles (§7), so an
      // event on a private calendar renders busy-only here — the same
      // reduced-detail chip the hub renders for a device principal. Neither
      // share role had ever put one in front of axe before this, which is
      // exactly the gap that let the chip's `opacity-70` contrast hazard
      // (`EventChip`, same class of bug the past-event treatment was fixed
      // for in M17) go unaudited.
      await withDb(async (client) => {
        const privateCalendarId = await seedCalendar(client, family.familyId, owner.id, {
          summary: 'Werk',
          visibility: 'private',
        });
        await seedEvents(client, family.familyId, [
          {
            title: 'Teamoverleg',
            startsAt: `${today}T10:00:00Z`,
            endsAt: `${today}T11:00:00Z`,
            calendarId: privateCalendarId,
            ownerMemberId: children[0].id,
            attendeeMemberIds: [children[0].id],
            location: 'Kantoor Amsterdam',
          },
        ]);
      });

      const { token } = await withDb((client) =>
        seedShareLink(client, family.familyId, {
          role,
          label: 'Oma',
          scope: role === 'contributor' ? { memberIds: [children[0].id] } : {},
        })
      );

      const context = await newAnonymousContext(browser);
      const page = await context.newPage();
      await page.goto(`/nl/s/${token}`);
      await expect(page.locator('main')).toBeVisible();
      await page.evaluate(() => document.fonts.ready.then(() => undefined));

      await expectNoAxeViolations(page, `the ${role} share view`);
      await context.close();
    });
  }
});
