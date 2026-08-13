import { pairHub } from '@e2e/fixtures/hub';
import { expect, test } from '@e2e/fixtures/family';
import { ownerMemberOf, readCompletions, seedMembers, seedRoutines, withDb } from '@e2e/utils/seed';

/**
 * The <100ms NFR, guarded (PRD; docs/architecture.md §4 "Optimistic completion
 * flow").
 *
 * **This test fails the build on regression, and that is its whole job.** The
 * budget is not a nice-to-have: the research is unambiguous that a tap which
 * does not answer instantly stops feeling like the child did it. A regression
 * here — an `await` sneaking in before the state flip, a spinner, a
 * `router.refresh()` moved ahead of the optimistic update — would be invisible
 * in every other test in this repo, because everything would still *work*.
 *
 * Three things make the number trustworthy rather than flaky:
 *
 * 1. **It measures the DOM, not the network.** The clock starts on the click
 *    and stops when the row's `data-state` reads `done`. The Server Action is
 *    still in flight at that point, and deliberately so — that is the flip
 *    being optimistic.
 * 2. **It measures in the page.** `performance.now()` on both sides of the
 *    click, inside one `page.evaluate`, so no CDP round trip is counted.
 * 3. **It takes the median of three taps.** One sample on a loaded CI box
 *    measures the box; the median of three measures the code.
 */

const BUDGET_MS = 100;
// This companion test installs a `page.route` interceptor (below) so every
// matching request round-trips through CDP — that interception cost lands
// inside the measured window, which the primary test above deliberately
// avoids (see doc comment point 2). So this is not held to BUDGET_MS: its
// job is proving the flip does not await the 2000ms-held server, not
// re-proving the 100ms budget (the primary median-of-three test above owns
// that). 500ms is proof-of-optimism — still 4x under the 2000ms hold, so an
// `await` sneaking in before the flip still fails it, without the
// interceptor's own overhead making the assertion flaky.
const COMPANION_BUDGET_MS = 500;
const LONG_AGO = new Date(Date.now() - 60 * 86_400_000).toISOString();

async function seedBoard(familyId: string) {
  return withDb(async (client) => {
    await ownerMemberOf(client, familyId);
    const [child] = await seedMembers(client, familyId, [
      { displayName: 'Mila', role: 'child', color: 'purple', sortOrder: 1 },
    ]);

    const [routine] = await seedRoutines(client, familyId, [
      {
        title: 'Klaarmaken voor school',
        ownerMemberId: child.id,
        // Due from one minute past midnight, so it is always live when the
        // spec runs, whatever the hour.
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '00:01', graceDays: 1 },
        starsPerCompletion: 2,
        createdAt: LONG_AGO,
        steps: [
          { title: 'Bed opmaken' },
          { title: 'Tanden poetsen' },
          { title: 'Tas inpakken' },
          { title: 'Jas aan' },
        ],
      },
    ]);

    return { child, routine };
  });
}

/**
 * Tap one step and return the milliseconds until its row reads `done`.
 *
 * `requestAnimationFrame` rather than a `MutationObserver`: the number that
 * matters is when the change is *painted*, not when React committed it.
 */
async function tapAndMeasure(
  page: import('@playwright/test').Page,
  stepId: string
): Promise<number> {
  return page.evaluate(async (id) => {
    const row = document.querySelector<HTMLElement>(`[data-step-id="${id}"]`);
    const button = row?.querySelector<HTMLButtonElement>('[data-testid="step-tap"]');
    if (!row || !button) throw new Error(`step ${id} not on the board`);

    const start = performance.now();
    button.click();

    while (row.getAttribute('data-state') !== 'done') {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (performance.now() - start > 3000) throw new Error(`step ${id} never flipped to done`);
    }

    return performance.now() - start;
  }, stepId);
}

test.describe('completion performance guard', { tag: '@heavy' }, () => {
  test('tap → visual done stays under 100ms', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const { child, routine } = await seedBoard(family.familyId);

    await page.goto(`/nl/hub/routines/${child.id}`);
    await expect(page.getByTestId('routine-board')).toBeVisible();
    await expect(page.getByTestId('routine-step').first()).toBeVisible();

    const samples: number[] = [];
    // Three separate steps, not one step three times: a completed step is not
    // re-tappable, and the second tap of a routine must cost the same as the
    // first.
    for (const stepId of routine.stepIds.slice(0, 3)) {
      samples.push(await tapAndMeasure(page, stepId));
    }

    const median = [...samples].sort((a, b) => a - b)[1];

    expect(
      median,
      `Optimistic completion took ${median.toFixed(1)}ms (samples: ${samples
        .map((sample) => sample.toFixed(1))
        .join(
          ', '
        )}ms). The <100ms budget is a hard NFR — something now awaits before the state flip.`
    ).toBeLessThan(BUDGET_MS);

    // The measurement is only meaningful if the writes actually landed: a board
    // that flipped instantly and wrote nothing would pass the timing and fail
    // the family.
    await expect
      .poll(() =>
        withDb((client) => readCompletions(client, family.familyId)).then((r) => r.length)
      )
      .toBe(3);
  });

  test('the flip happens before the server answers, not after', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const { child, routine } = await seedBoard(family.familyId);

    await page.goto(`/nl/hub/routines/${child.id}`);
    await expect(page.getByTestId('routine-board')).toBeVisible();

    // Hold every Server Action for two seconds. If the UI waited on the
    // response, the flip could not possibly happen inside the budget — so this
    // is the same assertion as above with the network taken hostage, which is
    // what proves the first one is not passing by being fast.
    await page.route('**/nl/hub/routines/**', async (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return route.fallback();
    });

    const elapsed = await tapAndMeasure(page, routine.stepIds[0]);
    expect(elapsed).toBeLessThan(COMPANION_BUDGET_MS);

    // The celebration is on screen while the write is still in the air.
    await expect(
      page.locator(`[data-step-id="${routine.stepIds[0]}"] [data-testid="step-praise"]`)
    ).toBeVisible();
  });
});
