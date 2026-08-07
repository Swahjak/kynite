import { expect, test } from '@e2e/fixtures/exclusive';
import { ownerMemberOf, seedCompletions, seedMembers, seedRoutines, withDb } from '@e2e/utils/seed';
import { settlePage } from '@e2e/utils/settle';

/**
 * Visual regression for the routine builder (`/nl/routines`), at the parent
 * app's phone (390×844) and a tablet (1280×800).
 *
 * Moved out of `hub/visual/routines.spec.ts` (M17 review): the builder is a
 * signed-in owner surface reached from the parent app, not the wall display —
 * it belongs on the `app` project, on the `app` storage state, next to the
 * rest of the account-session visuals, not next to the kiosk board it used to
 * share a file with. `pairHub` was never called for this test even before the
 * move; the `family` fixture signs up its own fresh account session
 * regardless of which project's baseline storage state it starts from (see
 * `e2e/fixtures/family.ts`), so the builder rendered correctly under the hub
 * project's device-paired baseline by accident, not by design.
 *
 * Determinism and the fixed-id scheme are carried over unchanged from the
 * hub visual spec this was split from — see that file's doc comment for why.
 *
 * Update deliberately with `pnpm e2e:visual:update`.
 */

const VIEWPORTS = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 1280, height: 800 },
} as const;

/** A fixed Wednesday — carried over from the hub visual spec's ANCHOR, only
 *  used here as the completions' occurrence date; the builder page renders no
 *  clock-pinned board, so it does not otherwise need a fixed "now". */
const ANCHOR = '2026-03-11';
/** DTSTART well before the anchor, so every occurrence below exists. */
const SERIES_START = '2026-01-05T06:00:00Z';

/**
 * Fixed ids, scoped `c`/`d` — hex digits, unlike a stray `g`/`h` (invalid in a
 * uuid column and caught immediately by the insert). Distinct from the `a`,
 * `b`, `e`, `f` scopes the hub visual spec this was split from still uses (the
 * `c`/`d` scopes it used for this same builder test are free since the move),
 * so the two files' fixed rows can never collide even if a run happens to
 * overlap them against the same database.
 */
const ID = (scope: string, suffix: string) => `00000000-0000-4000-8000-000000${scope}${suffix}`;

async function seedBoard(familyId: string, scope: string) {
  return withDb(async (client) => {
    await ownerMemberOf(client, familyId);
    // Fixed ids are globally unique rows, so a retry of this same test would
    // otherwise collide with its own previous attempt. Each viewport owns a
    // `scope`, which is what keeps parallel workers from colliding too.
    await client.query(`delete from member where id::text like $1`, [
      `00000000-0000-4000-8000-000000${scope}%`,
    ]);
    const [mila] = await seedMembers(client, familyId, [
      { id: ID(scope, '00001'), displayName: 'Mila', role: 'child', color: 'purple', sortOrder: 1 },
    ]);

    const [morning, , homework] = await seedRoutines(client, familyId, [
      {
        id: ID(scope, '01000'),
        title: 'Klaarmaken voor school',
        ownerMemberId: mila.id,
        icon: 'wb_sunny',
        schedule: { rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', timeOfDay: '07:30' },
        starsPerCompletion: 2,
        createdAt: SERIES_START,
        steps: [
          { id: ID(scope, '01001'), title: 'Bed opmaken' },
          { id: ID(scope, '01002'), title: 'Tanden poetsen', timerSeconds: 120 },
          { id: ID(scope, '01003'), title: 'Aankleden' },
          { id: ID(scope, '01004'), title: 'Tas inpakken' },
        ],
      },
      {
        // Tuesday's occurrence, still inside a three-day grace window on
        // Wednesday: the dimmed, unmarked treatment.
        id: ID(scope, '02000'),
        title: 'Vitamine',
        ownerMemberId: mila.id,
        icon: 'star',
        schedule: { rrule: 'FREQ=WEEKLY;BYDAY=TU', timeOfDay: '08:00', graceDays: 3 },
        createdAt: SERIES_START,
        steps: [{ id: ID(scope, '02001'), title: 'Vitamine nemen' }],
      },
      {
        id: ID(scope, '03000'),
        title: 'Huiswerk',
        ownerMemberId: mila.id,
        icon: 'checklist',
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '16:00' },
        createdAt: SERIES_START,
        steps: [
          { id: ID(scope, '03001'), title: 'Lezen' },
          { id: ID(scope, '03002'), title: 'Rekenen' },
        ],
      },
      {
        // Graduated: pays no stars and wears the badge instead.
        id: ID(scope, '04000'),
        title: 'Bedtijd',
        ownerMemberId: mila.id,
        icon: 'dark_mode',
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '19:30' },
        rewardEnabled: false,
        fadedAt: '2026-02-01T00:00:00Z',
        createdAt: SERIES_START,
        steps: [
          { id: ID(scope, '04001'), title: 'Pyjama aan' },
          { id: ID(scope, '04002'), title: 'Verhaaltje' },
        ],
      },
    ]);

    await seedCompletions(client, familyId, mila.id, [
      // One step of the live routine done: the praise headline is in the shot.
      { routineId: morning.id, routineStepId: morning.stepIds[0], occurrenceDate: ANCHOR },
      // The whole afternoon routine done: the calm collapsed state.
      { routineId: homework.id, routineStepId: homework.stepIds[0], occurrenceDate: ANCHOR },
      { routineId: homework.id, routineStepId: homework.stepIds[1], occurrenceDate: ANCHOR },
    ]);
  });
}

type ViewportName = keyof typeof VIEWPORTS;

for (const [name, viewport] of Object.entries(VIEWPORTS) as [
  ViewportName,
  (typeof VIEWPORTS)[ViewportName],
][]) {
  test.describe(`routine builder visuals — ${name}`, () => {
    test.use({ viewport });

    test('routine builder', async ({ page, family }) => {
      await seedBoard(family.familyId, name === 'tablet' ? 'c' : 'd');

      await page.goto('/nl/routines');
      await expect(page.getByTestId('routine-row').first()).toBeVisible();
      await settlePage(page);

      await expect(page).toHaveScreenshot(`routines-builder-${name}.png`, { fullPage: true });
    });
  });
}
