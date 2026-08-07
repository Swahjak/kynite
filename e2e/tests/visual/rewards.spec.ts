import { pairHub } from '../../fixtures/hub';
import { expect, test } from '../../fixtures/family';
import {
  ownerMemberOf,
  seedRedemptions,
  seedMembers,
  seedRewards,
  seedRoutines,
  seedStars,
  withDb,
} from '../../utils/seed';
import { settlePage } from '../../utils/settle';

/**
 * Visual regression for the reward surfaces, at the hub tablet (1280×800) and a
 * phone (390×844).
 *
 * The acceptance criterion these shots exist for is the age split: `instant`
 * (ages ~4–7) must render an icon-heavy, minimal-text store, and `savings`
 * (ages ~8–12) must render progress bars and weekly totals. Those are *layout*
 * claims, so they are pinned as pictures — a behavioural test can assert a goal
 * card exists, but only a snapshot notices the day it renders three words wide.
 *
 * Every reward state a child can see is in the store shots on purpose:
 * affordable (vivid), out of reach (dimmed, with the "more stars" hint), and
 * already asked for (the hourglass badge). If the dimmed treatment ever grows a
 * colour, a border or a glyph, these change.
 *
 * Fixed ids for the same reason the routine visuals use them: the request
 * idempotency key is derived from `member:reward:day`, and anything derived
 * from a random id would flap. `?date=` pins the day.
 *
 * Update deliberately with `pnpm e2e:visual:update`.
 */

const VIEWPORTS = {
  tablet: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const;

/** A fixed Wednesday. */
const ANCHOR = '2026-03-11';

/** The last uuid group is exactly 12 hex: `0000ab` + a 2-char scope + a 4-char suffix. */
const ID = (scope: string, suffix: string) => `00000000-0000-4000-8000-0000ab${scope}${suffix}`;

/**
 * One child, one shelf, one balance — sized so the store shows all three tile
 * states at once. 12 available against prices of 3 / 8 / 20 / 30 gives two
 * affordable, two out of reach, and one of the affordable pair is pre-requested.
 */
async function seedShelf(familyId: string, scope: string, horizon: 'instant' | 'savings') {
  return withDb(async (client) => {
    await ownerMemberOf(client, familyId);

    // Fixed ids are globally unique rows, so a retry of this same test would
    // otherwise collide with its own previous attempt. Each test owns a
    // `scope`, which keeps parallel workers from colliding too.
    await client.query(`delete from member where id::text like $1`, [
      `00000000-0000-4000-8000-0000ab${scope}%`,
    ]);
    await client.query(`delete from reward where id::text like $1`, [
      `00000000-0000-4000-8000-0000ab${scope}%`,
    ]);

    const [mila] = await seedMembers(client, familyId, [
      {
        id: ID(scope, '0001'),
        displayName: 'Mila',
        role: 'child',
        color: 'purple',
        sortOrder: 1,
        rewardHorizon: horizon,
      },
    ]);

    // Dated inside the pinned week (2026-03-05 … 2026-03-11), so the chart's
    // seven bars carry the same shape on every run instead of falling outside
    // the window and rendering empty.
    await seedStars(client, familyId, mila.id, [
      { amount: 8, reason: 'routine', createdAt: '2026-03-09T07:40:00Z' },
      { amount: 3, reason: 'routine', createdAt: '2026-03-10T07:35:00Z' },
      {
        amount: 1,
        reason: 'surprise',
        note: 'Dat heb je helemaal zelf bedacht!',
        createdAt: '2026-03-11T07:45:00Z',
      },
    ]);

    const [story, film, swim, zoo] = await seedRewards(client, familyId, [
      {
        id: ID(scope, '1001'),
        title: 'Extra verhaaltje',
        costStars: 3,
        category: 'privilege',
        icon: 'menu_book',
      },
      {
        id: ID(scope, '1002'),
        title: 'Jij kiest de film',
        costStars: 8,
        category: 'privilege',
        icon: 'movie',
      },
      {
        id: ID(scope, '1003'),
        title: 'Naar het zwembad',
        costStars: 20,
        category: 'experience',
        icon: 'pool',
      },
      {
        id: ID(scope, '1004'),
        title: 'Naar de dierentuin',
        costStars: 30,
        category: 'experience',
        icon: 'pets',
      },
    ]);

    // One open request, so the hourglass state is in every store shot.
    await seedRedemptions(client, familyId, mila.id, [
      { rewardId: film.id, costStars: film.costStars },
    ]);

    // A graduated routine, so the chart's badge is in every chart shot.
    await seedRoutines(client, familyId, [
      {
        id: ID(scope, '2001'),
        title: 'Tanden poetsen',
        ownerMemberId: mila.id,
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '07:30' },
        rewardEnabled: false,
        fadedAt: '2026-02-01T00:00:00Z',
        createdAt: '2026-01-05T06:00:00Z',
        steps: [{ id: ID(scope, '2002'), title: 'Poetsen' }],
      },
    ]);

    return { mila, story, film, swim, zoo };
  });
}

/** A distinct scope per (test, viewport) pair — fixed ids are globally unique. */
const SCOPE: Record<string, Record<string, string>> = {
  tablet: { storeInstant: '1a', storeSavings: '1b', chartInstant: '1c', chartSavings: '1d' },
  mobile: { storeInstant: '2a', storeSavings: '2b', chartInstant: '2c', chartSavings: '2d' },
};

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`reward visuals — ${name}`, () => {
    test.use({ viewport });

    test('store, instant horizon (ages 4-7)', async ({ page, family }) => {
      // M12: hub surfaces run behind a device principal, never an account
      // session — this browser is the wall tablet for the rest of the test.
      await pairHub(page, family.familyId);

      const { mila } = await seedShelf(family.familyId, SCOPE[name].storeInstant, 'instant');

      await page.goto(`/nl/hub/store?member=${mila.id}&date=${ANCHOR}`);
      await expect(page.getByTestId('reward-store')).toHaveAttribute('data-horizon', 'instant');
      // Icon-first and minimal-text: no goal card exists on this tier at all.
      await expect(page.getByTestId('savings-goal')).toHaveCount(0);
      await settlePage(page);

      await expect(page).toHaveScreenshot(`store-instant-${name}.png`, { fullPage: true });
    });

    test('store, savings horizon (ages 8-12)', async ({ page, family }) => {
      // M12: hub surfaces run behind a device principal, never an account
      // session — this browser is the wall tablet for the rest of the test.
      await pairHub(page, family.familyId);

      const { mila } = await seedShelf(family.familyId, SCOPE[name].storeSavings, 'savings');

      await page.goto(`/nl/hub/store?member=${mila.id}&date=${ANCHOR}`);
      await expect(page.getByTestId('reward-store')).toHaveAttribute('data-horizon', 'savings');
      // The featured goal: the nearest thing still out of reach (20, not 30).
      await expect(page.getByTestId('savings-goal')).toBeVisible();
      await expect(page.getByTestId('goal-progress')).toHaveText('12 / 20');
      await settlePage(page);

      await expect(page).toHaveScreenshot(`store-savings-${name}.png`, { fullPage: true });
    });

    test('star chart, instant horizon (ages 4-7)', async ({ page, family }) => {
      // M12: hub surfaces run behind a device principal, never an account
      // session — this browser is the wall tablet for the rest of the test.
      await pairHub(page, family.familyId);

      const { mila } = await seedShelf(family.familyId, SCOPE[name].chartInstant, 'instant');

      await page.goto(`/nl/hub/stars/${mila.id}?date=${ANCHOR}`);
      await expect(page.getByTestId('star-chart')).toHaveAttribute('data-horizon', 'instant');
      // The cumulative total is the whole metric on this tier; no week chart.
      await expect(page.getByTestId('earned-stars')).toHaveText('12');
      await expect(page.getByTestId('week-chart')).toHaveCount(0);
      await settlePage(page);

      await expect(page).toHaveScreenshot(`chart-instant-${name}.png`, { fullPage: true });
    });

    test('star chart, savings horizon (ages 8-12)', async ({ page, family }) => {
      // M12: hub surfaces run behind a device principal, never an account
      // session — this browser is the wall tablet for the rest of the test.
      await pairHub(page, family.familyId);

      const { mila } = await seedShelf(family.familyId, SCOPE[name].chartSavings, 'savings');

      await page.goto(`/nl/hub/stars/${mila.id}?date=${ANCHOR}`);
      await expect(page.getByTestId('star-chart')).toHaveAttribute('data-horizon', 'savings');
      // Weekly totals: seven bars, zeros included, plus the week's sum.
      await expect(page.getByTestId('week-bar')).toHaveCount(7);
      await expect(page.getByTestId('week-total')).toBeVisible();
      await settlePage(page);

      await expect(page).toHaveScreenshot(`chart-savings-${name}.png`, { fullPage: true });
    });
  });
}
