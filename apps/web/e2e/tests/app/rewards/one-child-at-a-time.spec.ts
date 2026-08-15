import { pairHub } from '@e2e/fixtures/hub';
import { type Page } from '@playwright/test';
import { expect, test } from '@e2e/fixtures/family';
import {
  ownerMemberOf,
  seedMembers,
  seedRewards,
  seedRoutines,
  seedStars,
  withDb,
} from '@e2e/utils/seed';

/**
 * Research §Decisions 3, enforced on the rendered DOM: **no screen renders more
 * than one child's totals together.**
 *
 * This is the assertion that cannot be replaced by a code review or a type. A
 * sibling comparison does not arrive as a component called `<Leaderboard>`; it
 * arrives as somebody rendering a per-member map that was already in scope, on
 * a page that used to show one child. So the check is: visit every surface that
 * touches stars, extract every star-shaped number the page renders, and assert
 * that at most one child's totals appear.
 *
 * Two children are seeded with *distinct, unmistakable* balances (7 and 41),
 * so "both totals are on screen" is a substring question with no arithmetic
 * coincidences: neither number is a prefix, suffix or sum of the other, and
 * neither equals any reward price on the shelf.
 *
 * The selector chips are explicitly allowed and explicitly tested: switching
 * between children is navigation, and a chip carries a name and a face and no
 * numbers at all.
 */

const MILA_STARS = 7;
const DAAN_STARS = 41;

async function seedTwoChildren(familyId: string) {
  return withDb(async (client) => {
    await ownerMemberOf(client, familyId);

    const [mila, daan] = await seedMembers(client, familyId, [
      { displayName: 'Mila', role: 'child', color: 'purple', sortOrder: 1 },
      { displayName: 'Daan', role: 'child', color: 'orange', sortOrder: 2 },
    ]);

    await seedStars(client, familyId, mila.id, [{ amount: MILA_STARS }]);
    await seedStars(client, familyId, daan.id, [{ amount: DAAN_STARS }]);

    // Prices chosen to collide with neither balance.
    const rewards = await seedRewards(client, familyId, [
      { title: 'Extra verhaaltje', costStars: 3, category: 'privilege', icon: 'menu_book' },
      { title: 'Naar de dierentuin', costStars: 30, category: 'experience', icon: 'pets' },
    ]);

    await seedRoutines(client, familyId, [
      {
        title: 'Tanden poetsen',
        ownerMemberId: mila.id,
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '07:30' },
        steps: [{ title: 'Poetsen' }],
      },
    ]);

    return { mila, daan, rewards };
  });
}

/**
 * Every "big number" the page renders as a star total.
 *
 * Read from the data-testids the reward surfaces expose for exactly this
 * purpose rather than by scraping all text: a reward's *price* is a star number
 * too, and a shelf legitimately shows several of those at once.
 */
async function renderedTotals(page: Page): Promise<string[]> {
  const totals = page.locator(
    '[data-testid="available-stars"], [data-testid="earned-stars"], [data-testid="chart-available-stars"], [data-testid="week-total"]'
  );

  return totals.allTextContents();
}

const SURFACES = [
  { name: 'hub store', path: (ids: { mila: string }) => `/nl/hub/store?member=${ids.mila}` },
  { name: 'hub star chart', path: (ids: { mila: string }) => `/nl/hub/stars/${ids.mila}` },
];

test.describe('no screen renders two children together', () => {
  for (const surface of SURFACES) {
    test(`${surface.name} shows one child's totals only`, async ({ page, family }) => {
      // M12: both surfaces are hub surfaces, and the hub runs behind a device
      // principal. The path is built from `surface.path()`, so this is the one
      // hub test in the suite whose URL is not visible as a literal.
      await pairHub(page, family.familyId);

      // The sibling exists and has a balance; the surface is addressed to Mila.
      const { mila } = await seedTwoChildren(family.familyId);

      await page.goto(surface.path({ mila: mila.id }));
      await expect(page.locator('main')).toBeVisible();

      const totals = (await renderedTotals(page)).join(' ');

      expect(totals, 'the addressed child is missing entirely').toContain(String(MILA_STARS));
      expect(totals, "the sibling's total is on screen").not.toContain(String(DAAN_STARS));

      // The sibling's *name* may appear — the chips are navigation — but their
      // numbers must not, on any element, anywhere on the page.
      const body = (await page.locator('main').textContent()) ?? '';
      // Counted before it is read: the chips exist on the store and not on the
      // chart, and `textContent()` on an absent locator would wait out the
      // whole test timeout rather than report "no chips here".
      const chips = page.getByTestId('store-chips');
      if ((await chips.count()) > 0) {
        expect(await chips.textContent(), 'a selector chip is carrying a number').not.toMatch(/\d/);
      }
      expect(
        body.split(String(DAAN_STARS)).length - 1,
        "the sibling's total leaked into the page"
      ).toBe(0);
    });
  }

  test('the store chips switch between shelves rather than combining them', async ({
    page,
    family,
  }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const { mila, daan } = await seedTwoChildren(family.familyId);

    await page.goto(`/nl/hub/store?member=${mila.id}`);
    await expect(page.getByTestId('available-stars')).toHaveText(String(MILA_STARS));
    await expect(page.getByTestId('star-balance')).toHaveAttribute('data-member-id', mila.id);

    await page.getByTestId('store-chip').filter({ hasText: 'Daan' }).click();

    await expect(page.getByTestId('available-stars')).toHaveText(String(DAAN_STARS));
    await expect(page.getByTestId('star-balance')).toHaveAttribute('data-member-id', daan.id);

    // Exactly one balance element exists at a time, on either shelf.
    await expect(page.getByTestId('available-stars')).toHaveCount(1);
  });

  test('the star chart has no index that lists everyone', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    await seedTwoChildren(family.familyId);

    // There is no `/hub/stars` route: the member id is the whole screen, not a
    // filter over a shared one.
    const response = await page.goto('/nl/hub/stars');
    expect(response?.status()).toBe(404);
  });

  test('the parent catalogue is a shelf, not a scoreboard', async ({ page, family }) => {
    await seedTwoChildren(family.familyId);

    await page.goto('/nl/rewards');
    await expect(page.getByTestId('rewards-page')).toBeVisible();

    // The parent surface renders no child's star total at all — balances live
    // on each child's own chart. `loadRewardsPage` has the map; nothing puts it
    // on screen.
    expect(await renderedTotals(page)).toEqual([]);

    const body = (await page.getByTestId('rewards-page').textContent()) ?? '';
    for (const total of [MILA_STARS, DAAN_STARS]) {
      expect(body).not.toMatch(new RegExp(`\\b${total}\\s*(?:sterren|ster)\\b`));
    }
  });

  test('the routine builder still shows no completion or star totals', async ({ page, family }) => {
    await seedTwoChildren(family.familyId);

    await page.goto('/nl/routines');
    await expect(page.getByTestId('routines-page')).toBeVisible();

    expect(await renderedTotals(page)).toEqual([]);
  });
});
