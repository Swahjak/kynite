import { expect, test } from '@e2e/fixtures/family';
import { readCompletions, seedMembers, seedRoutines, withDb } from '@e2e/utils/seed';

/**
 * `/today`'s rebuilt tabbed layout (commits 102facd, 3639444).
 *
 * The day board's own combined/columns switcher and the M19 "up next" hero
 * are gone; four tabs — dag, personen, routines, sterren — sit under a
 * compact NU strip instead, remembered per device in `localStorage`
 * (`kynite.today.tab`). `calendar.spec.ts`'s "the today tabs" group already
 * covers the dag/personen split and the reload persistence; this file covers
 * the two new writing surfaces the rebuild adds: the Takenlijst and the star
 * matrix.
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

test.describe('the sterren tab', () => {
  test('ticking a star cell completes the step for that child', async ({ page, family }) => {
    const routine = await withDb(async (client) => {
      const [mila] = await seedMembers(client, family.familyId, [
        { displayName: 'Mila', role: 'child', color: 'purple', sortOrder: 1 },
      ]);
      // Daily at 00:01 so today's occurrence is always already due when the
      // spec runs, the same pattern `routines.spec.ts` uses.
      const [seededRoutine] = await seedRoutines(client, family.familyId, [
        {
          title: 'Klaarmaken voor school',
          ownerMemberId: mila.id,
          schedule: { rrule: 'FREQ=DAILY', timeOfDay: '00:01', graceDays: 1 },
          createdAt: LONG_AGO,
          steps: [{ title: 'Tanden poetsen' }],
        },
      ]);
      return seededRoutine;
    });

    await page.goto('/nl/today');
    const tab = page.getByTestId('pill-tab-sterren');
    await expect(tab).toBeVisible();
    // The pill tablist scrolls sideways on the app viewport and this is the
    // last of the four — off-screen until scrolled to, so it needs a settled
    // position before the click, not just visibility.
    await tab.scrollIntoViewIfNeeded();
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');

    const matrix = page.getByTestId('star-matrix');
    await expect(matrix).toBeVisible();

    const cell = page.getByRole('button', { name: 'Tanden poetsen — Mila' });
    await expect(cell).toHaveAttribute('data-state', 'todo');

    await cell.click();
    await expect(cell).toHaveAttribute('data-state', 'done');

    await expect
      .poll(async () => {
        const rows = await withDb((client) => readCompletions(client, family.familyId));
        return rows.filter((completion) => completion.routine_step_id === routine.stepIds[0])
          .length;
      })
      .toBe(1);
  });
});
