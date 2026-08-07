import { pairHub } from '@e2e/fixtures/hub';
import { expect, test } from '@e2e/fixtures/family';
import {
  ownerMemberOf,
  readCompletions,
  readRoutineSteps,
  readStarLedger,
  seedCompletions,
  seedMembers,
  seedRoutines,
  withDb,
} from '@e2e/utils/seed';

/**
 * The routine surfaces end to end (M07).
 *
 * Two things are asserted here that no unit test can reach: that a *tap* on the
 * hub completes a step with no confirmation and no spinner, and that a missed
 * occurrence renders dimmed and carries nothing that reads as a mark.
 *
 * Dates are derived from the browser's own clock rather than pinned, because
 * these specs assert *behaviour*; the visual spec pins its clock instead,
 * because it asserts appearance.
 */

/** `YYYY-MM-DD` in the family's zone, offset by whole days. */
function dateKey(offsetDays = 0): string {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(now);
}

const LONG_AGO = new Date(Date.now() - 60 * 86_400_000).toISOString();

async function seedChildWithRoutines(familyId: string) {
  return withDb(async (client) => {
    const owner = await ownerMemberOf(client, familyId);
    const [mila] = await seedMembers(client, familyId, [
      { displayName: 'Mila', role: 'child', color: 'purple', sortOrder: 1 },
    ]);

    const [morning, homework, missed] = await seedRoutines(client, familyId, [
      {
        title: 'Klaarmaken voor school',
        ownerMemberId: mila.id,
        // Daily at 00:01 so it is always already due when the spec runs.
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '00:01', graceDays: 1 },
        starsPerCompletion: 2,
        createdAt: LONG_AGO,
        steps: [
          { title: 'Bed opmaken' },
          { title: 'Tanden poetsen', timerSeconds: 120 },
          { title: 'Tas inpakken' },
        ],
      },
      {
        title: 'Huiswerk',
        ownerMemberId: mila.id,
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '23:59' },
        createdAt: LONG_AGO,
        steps: [{ title: 'Lezen' }],
      },
      {
        // Yesterday's occurrence, still inside its grace window: the dimmed
        // state, which must carry no mark of any kind.
        title: 'Vitamine',
        ownerMemberId: mila.id,
        schedule: {
          rrule: `FREQ=WEEKLY;BYDAY=${weekdayCodeOf(-1)}`,
          timeOfDay: '08:00',
          graceDays: 3,
        },
        createdAt: LONG_AGO,
        steps: [{ title: 'Vitamine nemen' }],
      },
    ]);

    return { owner, mila, morning, homework, missed };
  });
}

/** RFC-5545 weekday code of the day `offsetDays` from today. */
function weekdayCodeOf(offsetDays: number): string {
  const codes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + offsetDays);
  return codes[day.getUTCDay()];
}

test.describe('routine builder', () => {
  test('a parent creates a routine with ordered steps and a schedule', async ({ page, family }) => {
    await withDb(async (client) => {
      await seedMembers(client, family.familyId, [
        { displayName: 'Mila', role: 'child', color: 'purple', sortOrder: 1 },
      ]);
    });

    await page.goto('/nl/routines');
    await expect(page.getByTestId('routines-empty')).toBeVisible();

    await page.getByRole('button', { name: 'Nieuwe routine' }).click();
    await page.getByLabel('Naam').fill('Bedtijd');

    await page.getByTestId('weekday-SA').click();
    await page.getByTestId('weekday-SU').click();
    await page.getByLabel('Tijd').fill('19:30');

    await page.getByLabel('Stap 1', { exact: true }).fill('Pyjama aan');
    await page.getByLabel('Stap 2', { exact: true }).fill('Tanden poetsen');
    await page.getByRole('button', { name: 'Stap toevoegen' }).click();
    await page.getByLabel('Stap 3', { exact: true }).fill('Verhaaltje');

    await page.getByRole('button', { name: 'Opslaan' }).click();

    const row = page.getByTestId('routine-row');
    await expect(row).toBeVisible();
    await expect(row).toContainText('Bedtijd');
    await expect(row.getByTestId('routine-step-name')).toHaveCount(3);

    const steps = await withDb(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `select id from routine where family_id = $1`,
        [family.familyId]
      );
      return readRoutineSteps(client, rows[0].id);
    });

    expect(steps.map((step) => [step.title, step.sort_order])).toEqual([
      ['Pyjama aan', 0],
      ['Tanden poetsen', 1],
      ['Verhaaltje', 2],
    ]);
  });

  test('reordering a step persists its sortOrder', async ({ page, family }) => {
    const { morning } = await seedChildWithRoutines(family.familyId);

    await page.goto('/nl/routines');

    const row = page.getByTestId('routine-row').filter({ hasText: 'Klaarmaken voor school' });
    await row.getByRole('button', { name: 'Bewerken' }).click();

    // Move the third step to the top: two moves, so the assertion cannot pass
    // on an off-by-one swap.
    await page.getByRole('button', { name: 'Stap 3 eerder zetten' }).click();
    await page.getByRole('button', { name: 'Stap 2 eerder zetten' }).click();
    await page.getByRole('button', { name: 'Opslaan' }).click();

    await expect(page.getByRole('dialog')).toBeHidden();

    const steps = await withDb((client) => readRoutineSteps(client, morning.id));
    expect(steps.map((step) => [step.title, step.sort_order])).toEqual([
      ['Tas inpakken', 0],
      ['Bed opmaken', 1],
      ['Tanden poetsen', 2],
    ]);
  });
});

test.describe('the hub routine screen', () => {
  test('one tap completes a step — no dialog, no spinner', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const { mila, morning } = await seedChildWithRoutines(family.familyId);

    await page.goto(`/nl/hub/routines/${mila.id}`);

    const card = page.getByTestId('routine-card').filter({ hasText: 'Klaarmaken voor school' });
    await expect(card).toHaveAttribute('data-expanded', 'true');

    const first = card.getByTestId('routine-step').first();
    await expect(first).toHaveAttribute('data-state', 'todo');

    await first.getByTestId('step-tap').click();

    // Done immediately, with the praise as the visible headline. No dialog was
    // ever shown and no progress indicator exists to wait for.
    await expect(first).toHaveAttribute('data-state', 'done');
    await expect(first.getByTestId('step-praise')).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('progressbar')).toHaveCount(0);

    await expect
      .poll(async () => (await withDb((client) => readCompletions(client, family.familyId))).length)
      .toBe(1);

    const completions = await withDb((client) => readCompletions(client, family.familyId));
    expect(completions[0].routine_step_id).toBe(morning.stepIds[0]);
    expect(completions[0].occurrence_date).toBeTruthy();

    const ledger = await withDb((client) => readStarLedger(client, family.familyId));
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amount).toBe(2);
  });

  test('the praise is the headline and the star follows it', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const { mila } = await seedChildWithRoutines(family.familyId);

    await page.goto(`/nl/hub/routines/${mila.id}`);

    const first = page.getByTestId('routine-step').first();
    await first.getByTestId('step-tap').click();
    await expect(first).toHaveAttribute('data-state', 'done');

    // Order in the rendered document, and relative type size.
    const order = await first.evaluate((row) => {
      const praise = row.querySelector('[data-testid="step-praise"]')!;
      const star = row.querySelector('[data-testid="step-star"]')!;
      return {
        praiseFirst: Boolean(
          praise.compareDocumentPosition(star) & Node.DOCUMENT_POSITION_FOLLOWING
        ),
        praiseSize: Number.parseFloat(getComputedStyle(praise).fontSize),
        starSize: Number.parseFloat(getComputedStyle(star.firstElementChild!).fontSize),
      };
    });

    expect(order.praiseFirst).toBe(true);
    expect(order.praiseSize).toBeGreaterThan(order.starSize);
  });

  test('a finished routine collapses to a calm success state', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const { mila, homework } = await seedChildWithRoutines(family.familyId);

    await withDb((client) =>
      seedCompletions(client, family.familyId, mila.id, [
        {
          routineId: homework.id,
          routineStepId: homework.stepIds[0],
          occurrenceDate: dateKey(),
        },
      ])
    );

    await page.goto(`/nl/hub/routines/${mila.id}`);

    const card = page.getByTestId('routine-card').filter({ hasText: 'Huiswerk' });
    await expect(card).toHaveAttribute('data-complete', 'true');
    await expect(card).toHaveAttribute('data-expanded', 'false');
    await expect(card.getByTestId('routine-done-line')).toBeVisible();
    // Collapsed: the step rows are gone, so a finished routine stops competing
    // for attention with the one that has not started.
    await expect(card.getByTestId('routine-step')).toHaveCount(0);
  });

  test('a missed occurrence is dimmed and carries no mark at all', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const { mila } = await seedChildWithRoutines(family.familyId);

    await page.goto(`/nl/hub/routines/${mila.id}`);

    const card = page.getByTestId('routine-card').filter({ hasText: 'Vitamine' });
    await expect(card).toHaveAttribute('data-state', 'grace');

    // Dimmed — one opacity, nothing else.
    const opacity = await card.evaluate((node) => Number(getComputedStyle(node).opacity));
    expect(opacity).toBeLessThan(1);
    expect(opacity).toBeGreaterThan(0.3);

    // No red anywhere in the card, and no failure glyph.
    const marks = await card.evaluate((node) => {
      const isRed = (value: string) => {
        const match = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(value);
        if (!match) return false;
        const [r, g, b] = match.slice(1).map(Number);
        return r > 150 && g < 110 && b < 110;
      };

      const elements = [node, ...node.querySelectorAll('*')] as HTMLElement[];
      return {
        red: elements.filter((element) => {
          const style = getComputedStyle(element);
          return isRed(style.color) || isRed(style.backgroundColor) || isRed(style.borderTopColor);
        }).length,
        badIcons: elements.filter((element) =>
          ['close', 'cancel', 'error', 'warning', 'block'].includes(
            element.getAttribute('data-icon-name') ?? ''
          )
        ).length,
        text: node.textContent ?? '',
      };
    });

    expect(marks.red).toBe(0);
    expect(marks.badIcons).toBe(0);
    expect(marks.text).not.toMatch(/gemist|te laat|verloren|kwijt|mislukt/i);
  });

  test('shows one child only — no combined surface exists', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const { mila } = await seedChildWithRoutines(family.familyId);

    const daan = await withDb(async (client) => {
      const [seeded] = await seedMembers(client, family.familyId, [
        { displayName: 'Daan', role: 'child', color: 'orange', sortOrder: 2 },
      ]);
      await seedRoutines(client, family.familyId, [
        {
          title: 'Daan zijn routine',
          ownerMemberId: seeded.id,
          schedule: { rrule: 'FREQ=DAILY', timeOfDay: '00:01' },
          createdAt: LONG_AGO,
          steps: [{ title: 'Speelgoed opruimen' }],
        },
      ]);
      return seeded;
    });

    await page.goto(`/nl/hub/routines/${mila.id}`);

    await expect(page.getByTestId('hub-routines')).toContainText('Mila');
    await expect(page.getByTestId('routine-board')).not.toContainText('Daan');

    await page.goto(`/nl/hub/routines/${daan.id}`);
    await expect(page.getByTestId('routine-board')).not.toContainText('Mila');
  });

  test('a member from another family renders nothing rather than leaking', async ({
    page,
    family,
  }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    await page.goto('/nl/hub/routines/00000000-0000-4000-8000-000000000000');
    await expect(page.getByTestId('hub-routines')).toHaveCount(0);
  });
});
