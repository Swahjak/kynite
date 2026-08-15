import { pairHub } from '@e2e/fixtures/hub';
import { expect, test } from '@e2e/fixtures/family';
import {
  ownerMemberOf,
  readRedemptions,
  readStarBalance,
  seedMembers,
  seedRedemptions,
  seedRewards,
  seedStars,
  withDb,
} from '@e2e/utils/seed';

/**
 * The reward surfaces end to end (M08).
 *
 * Three things are asserted here that no unit or integration test can reach:
 * that a *tap* on the hub store asks for a reward with no confirmation and no
 * spinner, that a double tap produces one request and not two, and that a
 * denial leaves the child's screen carrying nothing that reads as a mark.
 */

async function seedShelf(
  familyId: string,
  options: { horizon?: 'instant' | 'savings'; stars?: number } = {}
) {
  return withDb(async (client) => {
    await ownerMemberOf(client, familyId);

    const [mila] = await seedMembers(client, familyId, [
      {
        displayName: 'Mila',
        role: 'child',
        color: 'purple',
        sortOrder: 1,
        rewardHorizon: options.horizon ?? 'instant',
      },
    ]);

    await seedStars(client, familyId, mila.id, [{ amount: options.stars ?? 10 }]);

    const [story, film, zoo] = await seedRewards(client, familyId, [
      { title: 'Extra verhaaltje', costStars: 3, category: 'privilege', icon: 'menu_book' },
      { title: 'Jij kiest de film', costStars: 8, category: 'privilege', icon: 'movie' },
      { title: 'Naar de dierentuin', costStars: 30, category: 'experience', icon: 'pets' },
    ]);

    return { mila, story, film, zoo };
  });
}

test.describe('the child asks for a reward', () => {
  test('one tap sends the request — no confirmation, no spinner', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const { mila, story } = await seedShelf(family.familyId);

    await page.goto(`/nl/hub/store?member=${mila.id}`);

    const tile = page.locator(`[data-reward-id="${story.id}"]`);
    await expect(tile).toHaveAttribute('data-state', 'affordable');

    await tile.getByTestId('reward-tap').click();

    // The tile flips locally before the server has answered — the optimistic
    // half of the flow. No dialog stood between the tap and this state.
    await expect(tile).toHaveAttribute('data-state', 'requested');
    await expect(tile.getByTestId('reward-requested')).toBeVisible();

    await expect
      .poll(async () => withDb((client) => readRedemptions(client, family.familyId)))
      .toHaveLength(1);

    const [row] = await withDb((client) => readRedemptions(client, family.familyId));
    expect(row.status).toBe('requested');
    expect(row.cost_stars).toBe(3);

    // Asking costs nothing: the balance is untouched until a parent answers.
    const balance = await withDb((client) => readStarBalance(client, mila.id));
    expect(balance).toMatchObject({ earned: 10, spent: 0, available: 10 });
  });

  test('a double tap creates one request, not two', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const { mila, story } = await seedShelf(family.familyId);

    await page.goto(`/nl/hub/store?member=${mila.id}`);

    const tap = page.locator(`[data-reward-id="${story.id}"]`).getByTestId('reward-tap');
    // Two taps as fast as the browser will dispatch them. The second lands on
    // an element the optimistic flip is already removing, so this races on
    // purpose: whichever taps get through, the database absorbs the duplicate.
    await tap.click();
    await page
      .locator(`[data-reward-id="${story.id}"]`)
      .click({ force: true })
      .catch(() => {});

    await expect
      .poll(async () => withDb((client) => readRedemptions(client, family.familyId)))
      .toHaveLength(1);
  });

  test('a reward out of reach is dimmed with a hopeful hint, not a mark', async ({
    page,
    family,
  }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const { mila, zoo } = await seedShelf(family.familyId);

    await page.goto(`/nl/hub/store?member=${mila.id}`);

    const tile = page.locator(`[data-reward-id="${zoo.id}"]`);
    await expect(tile).toHaveAttribute('data-state', 'outOfReach');

    // 30 - 10 = 20 to go, counted up rather than reported as a shortfall.
    await expect(tile.getByTestId('reward-short-hint')).toHaveText(/20/);
    // Not tappable, but not annotated either: no button, no cross, no lock.
    await expect(tile.getByTestId('reward-tap')).toHaveCount(0);
    await expect(tile.locator('[data-icon-name="close"]')).toHaveCount(0);
    await expect(tile.locator('[data-icon-name="block"]')).toHaveCount(0);
  });
});

test.describe('the parent answers', () => {
  test('approving spends the stars and leaves earned untouched', async ({ page, family }) => {
    const { mila, film } = await seedShelf(family.familyId);

    await withDb((client) =>
      seedRedemptions(client, family.familyId, mila.id, [
        { rewardId: film.id, costStars: film.costStars },
      ])
    );

    await page.goto('/nl/rewards');
    await expect(page.getByTestId('approval-queue')).toBeVisible();

    await page.getByTestId('approve-redemption').first().click();

    await expect
      .poll(async () => (await withDb((client) => readStarBalance(client, mila.id))).available)
      .toBe(2);

    const balance = await withDb((client) => readStarBalance(client, mila.id));
    // The number that only ever grows did not move.
    expect(balance.earned).toBe(10);
    expect(balance.spent).toBe(8);
  });

  test('denying changes no number and leaves no mark on the hub', async ({ page, family }) => {
    const { mila, film } = await seedShelf(family.familyId);

    await withDb((client) =>
      seedRedemptions(client, family.familyId, mila.id, [
        { rewardId: film.id, costStars: film.costStars },
      ])
    );

    const before = await withDb((client) => readStarBalance(client, mila.id));

    await page.goto('/nl/rewards');
    await page.getByTestId('deny-redemption').first().click();

    await expect
      .poll(
        async () => (await withDb((client) => readRedemptions(client, family.familyId)))[0].status
      )
      .toBe('denied');

    expect(await withDb((client) => readStarBalance(client, mila.id))).toEqual(before);

    // The child's own screen: the tile is an ordinary tile again. No badge, no
    // explanation, no cooldown — and the balance still reads 10.
    //
    // The browser becomes the wall tablet here, after the parent's half of the
    // test: a device cookie outranks the account session (M12), so pairing
    // earlier would have redirected `/nl/rewards` to the board.
    await pairHub(page, family.familyId);
    await page.goto(`/nl/hub/store?member=${mila.id}`);

    const tile = page.locator(`[data-reward-id="${film.id}"]`);
    await expect(tile).toHaveAttribute('data-state', 'affordable');
    await expect(tile.getByTestId('reward-requested')).toHaveCount(0);
    await expect(page.getByTestId('available-stars')).toHaveText('10');

    const text = (await page.getByTestId('reward-store').textContent()) ?? '';
    expect(text).not.toMatch(/[-−]\s*\d/);
    expect(text.toLowerCase()).not.toMatch(/gewei|afgewezen|mislukt|helaas/);
  });
});

test.describe('the star chart', () => {
  test('shows earned as monotonic and available as derived', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const { mila, film } = await seedShelf(family.familyId);

    await withDb(async (client) => {
      const [id] = await seedRedemptions(client, family.familyId, mila.id, [
        { rewardId: film.id, costStars: film.costStars, status: 'approved' },
      ]);
      return id;
    });

    await page.goto(`/nl/hub/stars/${mila.id}`);

    // Earned stayed at 10 through a redemption that moved available to 2.
    await expect(page.getByTestId('earned-stars')).toHaveText('10');
    await expect(page.getByTestId('chart-available-stars')).toHaveText('2');
  });

  test('renders a graduation badge for a faded routine', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const { mila } = await seedShelf(family.familyId);

    await withDb(async (client) => {
      const { seedRoutines } = await import('@e2e/utils/seed');
      await seedRoutines(client, family.familyId, [
        {
          title: 'Tanden poetsen',
          ownerMemberId: mila.id,
          schedule: { rrule: 'FREQ=DAILY', timeOfDay: '07:30' },
          rewardEnabled: false,
          fadedAt: '2026-02-01T00:00:00Z',
          steps: [{ title: 'Poetsen' }],
        },
      ]);
    });

    await page.goto(`/nl/hub/stars/${mila.id}`);

    const badge = page.getByTestId('graduation-badge');
    await expect(badge).toHaveCount(1);
    await expect(badge).toContainText('Tanden poetsen');
  });
});

test.describe('the parent catalogue', () => {
  test('fills an empty shelf from the presets, none of them money', async ({ page, family }) => {
    await withDb(async (client) => {
      await ownerMemberOf(client, family.familyId);
      await seedMembers(client, family.familyId, [
        { displayName: 'Mila', role: 'child', color: 'purple', sortOrder: 1 },
      ]);
    });

    await page.goto('/nl/rewards');
    // The catalogue is the second tab since wave D2; the queue opens first,
    // because it is the only one of the three where somebody is waiting.
    await page.getByTestId('rewards-tab-catalogue').click();
    await expect(page.getByTestId('rewards-empty')).toBeVisible();

    await page.getByTestId('seed-presets').click();

    await expect(page.getByTestId('reward-row').first()).toBeVisible();
    const rows = page.getByTestId('reward-row');
    expect(await rows.count()).toBeGreaterThanOrEqual(6);

    // No currency symbol and no money word reaches the catalogue.
    const text = (await page.getByTestId('rewards-page').textContent()) ?? '';
    expect(text).not.toMatch(/[€$£]/);
    expect(text.toLowerCase()).not.toMatch(/\b(?:geld|zakgeld|euro|money|allowance)\b/);
  });

  test('a parent hands out a surprise star, and cannot take one away', async ({ page, family }) => {
    const { mila } = await seedShelf(family.familyId);

    await page.goto('/nl/rewards');
    await page.getByTestId('award-stars-trigger').click();

    // A stepper, not a number field, and it starts at one: two taps to three.
    await page.getByRole('button', { name: 'Meer sterren' }).click();
    await page.getByRole('button', { name: 'Meer sterren' }).click();
    await page.getByRole('button', { name: /sterren geven aan/i }).click();

    await expect
      .poll(async () => (await withDb((client) => readStarBalance(client, mila.id))).earned)
      .toBe(13);

    // There is no counterpart control anywhere on the page.
    const text = (await page.getByTestId('rewards-page').textContent()) ?? '';
    expect(text.toLowerCase()).not.toMatch(/ster afnemen|ster weghalen|remove star/);
  });
});
