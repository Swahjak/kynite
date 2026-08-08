import { pairHub } from '@e2e/fixtures/hub';
import { expect, test } from '@e2e/fixtures/family';
import { readCompletions, readStarLedger, seedMembers, withDb } from '@e2e/utils/seed';

/**
 * One-off chores, from the builder to the hub and back off it (M20).
 *
 * "Clean the garage Saturday, 10 stars" is a whole product feature in one
 * sentence, and the only place all of it is true at once is the browser: a
 * parent picks a date instead of weekdays, the chore lands in the band its time
 * of day names on the child's own board, one tap pays the stars, and then it is
 * *gone* — not ticked off, not archived behind a filter, absent.
 *
 * The date is derived from the clock rather than pinned, like the rest of
 * `routines.spec.ts`: this asserts behaviour, and the visual suite is where
 * appearance is pinned.
 */

/** `YYYY-MM-DD` in the family's zone. Never `toISOString().slice(0, 10)`. */
function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
}

test('a parent schedules a one-off chore, the child taps it, and it leaves the board', async ({
  page,
  family,
}) => {
  const [mila] = await withDb((client) =>
    seedMembers(client, family.familyId, [
      { displayName: 'Mila', role: 'child', color: 'purple', sortOrder: 1 },
    ])
  );

  // ---- the builder -------------------------------------------------------
  await page.goto('/nl/routines');
  await page.getByRole('button', { name: 'Nieuwe routine' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Naam').fill('Garage opruimen');

  // Whose it is (FR9 — a routine is never unowned).
  await dialog.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Mila' }).click();

  // The toggle: a single date instead of a weekly rhythm. The weekday picker
  // goes away with it — a schedule is one thing or the other.
  await expect(dialog.getByTestId('weekday-MO')).toBeVisible();
  await dialog.getByTestId('schedule-kind-once').click();
  await expect(dialog.getByTestId('weekday-MO')).toBeHidden();

  await dialog.getByLabel('Datum').fill(todayKey());
  // 00:01 so the chore is already due whenever this spec runs; it also puts it
  // in the morning band, which the board assertion below relies on.
  await dialog.getByLabel('Tijd').fill('00:01');
  await dialog.getByLabel('Sterren per stap').fill('10');
  await dialog.getByLabel('Stap 1', { exact: true }).fill('Dozen naar de kringloop');
  await dialog.getByLabel('Stap 2', { exact: true }).fill('Bezem erover');

  await page.getByRole('button', { name: 'Opslaan' }).click();
  await expect(dialog).toBeHidden();

  const row = page.getByTestId('routine-row').filter({ hasText: 'Garage opruimen' });
  await expect(row).toBeVisible();
  // The roster says the day, not a weekday set.
  await expect(row.getByTestId('routine-schedule-badge')).toContainText('Eén keer op');

  // ---- the child's board -------------------------------------------------
  // M12: hub surfaces run behind a device principal, never the parent session.
  await pairHub(page, family.familyId);
  await page.goto(`/nl/hub/routines/${mila.id}`);

  const morning = page.getByTestId('routine-section-morning');
  const card = morning.getByTestId('routine-card').filter({ hasText: 'Garage opruimen' });
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-expanded', 'true');

  const first = card.getByTestId('routine-step').first();
  await expect(first).toHaveAttribute('data-state', 'todo');
  await first.getByTestId('step-tap').click();

  // Praise first, immediately, with no dialog and no spinner — the ordinary
  // completion path, unchanged.
  await expect(first).toHaveAttribute('data-state', 'done');
  await expect(first.getByTestId('step-praise')).toBeVisible();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);

  await card.getByTestId('routine-step').nth(1).getByTestId('step-tap').click();

  // Finished, and *still on screen*: a card is never pulled out from under the
  // celebration that is playing on it.
  await expect(card).toHaveAttribute('data-complete', 'true');
  await expect(card.getByTestId('routine-done-line')).toBeVisible();

  await expect
    .poll(async () => (await withDb((client) => readStarLedger(client, family.familyId))).length)
    .toBe(2);

  const ledger = await withDb((client) => readStarLedger(client, family.familyId));
  expect(ledger.map((entry) => entry.amount)).toEqual([10, 10]);
  const completions = await withDb((client) => readCompletions(client, family.familyId));
  expect(completions).toHaveLength(2);
  expect(completions[0].occurrence_date).toBeTruthy();

  // ---- and then it is done with ------------------------------------------
  // Not ticked off and not archived behind a filter: gone, the same way an
  // out-of-window occurrence is gone. Nothing marks it, because nothing
  // happened that needs marking.
  await page.reload();
  await expect(page.getByTestId('routine-card')).toHaveCount(0);
  await expect(page.getByTestId('routine-board-empty')).toBeVisible();
});
