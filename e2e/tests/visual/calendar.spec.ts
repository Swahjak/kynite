import { expect, test } from '../../fixtures/family';
import { ownerMemberOf, seedCalendar, seedEvents, seedMembers, withDb } from '../../utils/seed';
import { settlePage } from '../../utils/settle';

/**
 * Visual regression for every calendar surface, at both viewports M06 names:
 * the hub tablet (1280×800) and a phone (390×844).
 *
 * Determinism is the whole design of this file, and it is bought with fixed
 * dates rather than masks.
 *
 * Every surface is pinned to an anchor date via `?date=`, with fixtures on
 * fixed dates, so nothing depends on the day the suite runs. The calendar
 * views use a past anchor, where the now-line and today-highlight are absent
 * by construction. `/today` and the hub use a *future* anchor: their chips dim
 * once an event has ended, which would otherwise make the snapshot depend on
 * the hour the suite ran. A day that has not happened yet is never dimmed.
 *
 * The single genuinely live element left is the hub's wall clock, which is
 * masked — and nothing else is, so the snapshots still assert real layout.
 *
 * Update deliberately with `pnpm e2e:visual:update`.
 */

const VIEWPORTS = {
  /** The hub's wall tablet. */
  tablet: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const;

const ANCHOR = '2026-03-11';
/**
 * A date that is always in the future, so no chip on the per-person boards is
 * ever rendered in its "already finished" state. Revisit before March 2027.
 */
const FUTURE_ANCHOR = '2027-03-10';

/** Fixed-date fixtures covering every chip state the views can render. */
async function seedFixedWeek(familyId: string) {
  await withDb(async (client) => {
    const owner = await ownerMemberOf(client, familyId);
    const [mila, daan] = await seedMembers(client, familyId, [
      { displayName: 'Mila', role: 'child', color: 'purple', sortOrder: 1 },
      { displayName: 'Daan', role: 'child', color: 'orange', sortOrder: 2 },
    ]);

    const privateCalendar = await seedCalendar(client, familyId, owner.id, {
      summary: 'Werk',
      visibility: 'private',
      color: '#a855f7',
    });

    await seedEvents(client, familyId, [
      {
        title: 'Tandarts',
        startsAt: '2026-03-11T08:00:00Z',
        endsAt: '2026-03-11T09:00:00Z',
        ownerMemberId: owner.id,
        category: 'teal',
      },
      {
        title: 'Zwemles',
        startsAt: '2026-03-11T15:30:00Z',
        endsAt: '2026-03-11T16:30:00Z',
        ownerMemberId: mila.id,
        category: 'purple',
      },
      {
        title: 'Voetbaltraining',
        startsAt: '2026-03-12T16:00:00Z',
        endsAt: '2026-03-12T17:00:00Z',
        ownerMemberId: daan.id,
        category: 'orange',
      },
      {
        title: 'Familiediner',
        startsAt: '2026-03-11T17:00:00Z',
        endsAt: '2026-03-11T18:30:00Z',
        eventType: 'other',
        category: 'yellow',
      },
      {
        title: 'Papa-week',
        startsAt: '2026-03-02T07:30:00Z',
        endsAt: '2026-03-02T08:30:00Z',
        ownerMemberId: owner.id,
        eventType: 'custody',
        category: 'blue',
        rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
      },
      {
        title: 'Meivakantie',
        startsAt: '2026-03-13T00:00:00Z',
        endsAt: '2026-03-15T00:00:00Z',
        allDay: true,
        eventType: 'birthday',
        category: 'green',
      },
      {
        title: 'Nog niet gesynct',
        startsAt: '2026-03-11T10:00:00Z',
        endsAt: '2026-03-11T11:00:00Z',
        ownerMemberId: owner.id,
        category: 'red',
        pendingSync: true,
      },
      {
        // A private-calendar event, so the busy-only treatment is in the shot.
        title: 'Sollicitatiegesprek',
        startsAt: '2026-03-12T09:00:00Z',
        endsAt: '2026-03-12T10:30:00Z',
        ownerMemberId: owner.id,
        calendarId: privateCalendar,
      },
    ]);
  });
}

/** Fixtures for the two per-person boards, on the fixed future anchor day. */
async function seedBoardDay(familyId: string) {
  const at = (hour: number, minute = 0) =>
    new Date(Date.UTC(2027, 2, 10, hour, minute)).toISOString();

  await withDb(async (client) => {
    const owner = await ownerMemberOf(client, familyId);
    const [mila, daan] = await seedMembers(client, familyId, [
      { displayName: 'Mila', role: 'child', color: 'purple', sortOrder: 1 },
      { displayName: 'Daan', role: 'child', color: 'orange', sortOrder: 2 },
    ]);

    await seedEvents(client, familyId, [
      {
        title: 'Tandarts',
        startsAt: at(8),
        endsAt: at(9),
        ownerMemberId: owner.id,
        category: 'teal',
      },
      {
        title: 'Zwemles',
        startsAt: at(15, 30),
        endsAt: at(16, 30),
        ownerMemberId: mila.id,
        category: 'purple',
      },
      {
        title: 'Voetbaltraining',
        startsAt: at(16),
        endsAt: at(17),
        ownerMemberId: daan.id,
        category: 'orange',
      },
      {
        title: 'Familiediner',
        startsAt: at(17),
        endsAt: at(18, 30),
        eventType: 'other',
        category: 'yellow',
      },
    ]);
  });
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`calendar visuals — ${name}`, () => {
    test.use({ viewport });

    for (const view of ['day', 'week', 'month', 'agenda'] as const) {
      test(`${view} view`, async ({ page, family }) => {
        await seedFixedWeek(family.familyId);

        await page.goto(`/nl/calendar?view=${view}&date=${ANCHOR}`);
        await expect(page.getByTestId(`calendar-view-${view}`)).toBeVisible();
        await settlePage(page);

        await expect(page).toHaveScreenshot(`calendar-${view}-${name}.png`, { fullPage: true });
      });
    }

    test('today board', async ({ page, family }) => {
      await seedBoardDay(family.familyId);

      await page.goto(`/nl/today?date=${FUTURE_ANCHOR}`);
      await expect(page.getByTestId('today-board')).toBeVisible();
      await settlePage(page);

      await expect(page).toHaveScreenshot(`today-${name}.png`, { fullPage: true });
    });

    test('hub ambient board', async ({ page, family }) => {
      await seedBoardDay(family.familyId);

      await page.goto(`/nl/hub?date=${FUTURE_ANCHOR}`);
      await expect(page.getByTestId('hub-board')).toBeVisible();
      await settlePage(page);

      await expect(page).toHaveScreenshot(`hub-${name}.png`, {
        fullPage: true,
        // The wall clock is the one deliberately live element on the board.
        mask: [page.getByTestId('hub-clock')],
      });
    });
  });
}
