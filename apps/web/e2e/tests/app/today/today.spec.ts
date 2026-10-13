import { expect, test } from '@e2e/fixtures/family';
import { pairHub } from '@e2e/fixtures/hub';
import { readStarBalance, seedMembers, seedRoutines, withDb } from '@e2e/utils/seed';

/**
 * `/today`'s writing surfaces: the Takenlijst, and the star counts a child's
 * ticked steps leave on `/stars/<memberId>` and `/store`.
 */

test.describe('the takenlijst', () => {
  test('quick-adds a task and toggles it done', async ({ page }) => {
    await page.goto('/nl/today');

    const list = page.getByTestId('today-tasklist');
    await expect(list).toBeVisible();

    // "Taak erbij" moved off the list's own pill and onto the speed dial
    // (`TodayFab`) — open it, then its "add task" action.
    await page.getByRole('button', { name: 'Snelle acties' }).click();
    await page.getByTestId('fab-action-add-task').click();
    const form = page.getByTestId('today-task-add');
    await expect(form).toBeVisible();

    const title = `Hond uitlaten ${Date.now()}`;
    await form.getByPlaceholder('Wat moet er gebeuren?').fill(title);
    await form.getByRole('button', { name: 'Opslaan' }).click();

    const row = page.getByTestId('today-task').filter({ hasText: title });
    await expect(row).toHaveAttribute('data-state', 'open');

    await row.getByRole('button', { name: `${title} afvinken` }).click();
    await expect(row).toHaveAttribute('data-state', 'done');
  });
});

/** Occurrence generation is anchored to `routine.createdAt`, so a routine
 * created "now" has no due occurrence yet — the same reason
 * `routines.spec.ts` backdates its fixtures. */
const LONG_AGO = new Date(Date.now() - 60 * 86_400_000).toISOString();

test.describe('star counts per child', () => {
  // The old `/today` sterren tab (`StarMatrix`) is gone (D22); the stars live on
  // `/stars/<memberId>` and `/store`. A step ticked on one child's board must
  // pay out on that child's chart and on nobody else's. Tick → completion →
  // ledger row itself is covered in `routines.spec.ts`.
  test("ticking a child's steps pays that child's chart only", async ({ page, family }) => {
    // Hub surfaces run behind a device principal, never an account session.
    await pairHub(page, family.familyId);

    const { mila, daan } = await withDb(async (client) => {
      const [mila, daan] = await seedMembers(client, family.familyId, [
        { displayName: 'Mila', role: 'child', color: 'orchid', sortOrder: 1 },
        { displayName: 'Daan', role: 'child', color: 'terracotta', sortOrder: 2 },
      ]);
      // Daily at 00:01 so today's occurrence is always already due when the
      // spec runs, the same pattern `routines.spec.ts` uses.
      await seedRoutines(client, family.familyId, [
        {
          title: 'Klaarmaken voor school',
          ownerMemberId: mila.id,
          schedule: { rrule: 'FREQ=DAILY', timeOfDay: '00:01', graceDays: 1 },
          starsPerCompletion: 2,
          createdAt: LONG_AGO,
          steps: [{ title: 'Tanden poetsen' }, { title: 'Tas inpakken' }],
        },
        {
          title: 'Kamer opruimen',
          ownerMemberId: daan.id,
          schedule: { rrule: 'FREQ=DAILY', timeOfDay: '00:01', graceDays: 1 },
          createdAt: LONG_AGO,
          steps: [{ title: 'Speelgoed opruimen' }],
        },
      ]);
      return { mila, daan };
    });

    await page.goto(`/nl/routines/${mila.id}`);
    const steps = page.getByTestId('routine-step');
    await expect(steps).toHaveCount(2);
    const first = steps.filter({ hasText: 'Tanden poetsen' });
    await first.getByTestId('step-tap').click();
    await expect(first).toHaveAttribute('data-state', 'done');
    // The last tap collapses the finished routine into its success state, so
    // there is no done row left to assert on — the ledger below is the check.
    await steps.filter({ hasText: 'Tas inpakken' }).getByTestId('step-tap').click();

    // Two steps at two stars each: payout is per step, not per routine.
    await expect
      .poll(async () => (await withDb((client) => readStarBalance(client, mila.id))).earned)
      .toBe(4);

    await page.goto(`/nl/stars/${mila.id}`);
    await expect(page.getByTestId('earned-stars')).toHaveText('4');

    await page.goto(`/nl/stars/${daan.id}`);
    await expect(page.getByTestId('earned-stars')).toHaveText('0');

    await page.goto(`/nl/store?member=${mila.id}`);
    await expect(page.getByTestId('available-stars')).toContainText('4');
  });
});
