import { expect, test } from '../../fixtures/family';
import {
  ownerMemberOf,
  seedCompletions,
  seedMembers,
  seedRoutines,
  withDb,
} from '../../utils/seed';
import { settlePage } from '../../utils/settle';

/**
 * Visual regression for the routine surfaces, at the hub tablet (1280×800) and
 * a phone (390×844).
 *
 * Determinism comes from pinning the board's clock with `?date=&time=`, exactly
 * as the calendar visuals pin `?date=`. Every state the board can render is in
 * the shot on purpose: an expanded live routine with a completed step (praise
 * headline + secondary star), a finished routine's calm collapse, an upcoming
 * routine with its countdown chip, and a grace-day routine in the dimmed
 * treatment. If the praise ever stops leading, this snapshot changes.
 *
 * Update deliberately with `pnpm e2e:visual:update`.
 */

const VIEWPORTS = {
  tablet: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
} as const;

/** A fixed Wednesday, rendered at 07:45 local. */
const ANCHOR = '2026-03-11';
const ANCHOR_TIME = '07:45';
/** DTSTART well before the anchor, so every occurrence below exists. */
const SERIES_START = '2026-01-05T06:00:00Z';

/**
 * Fixed ids. The praise line a completed step shows is seeded from
 * `member:step:occurrenceDate` (`domain/praise.ts`) — deterministic per
 * completion, which means random ids would give a different line on every run
 * and make this snapshot flap. Pinning the ids pins the words.
 */
const ID = (scope: string, suffix: string) => `00000000-0000-4000-8000-000000${scope}${suffix}`;

async function seedBoard(familyId: string, scope: string) {
  return withDb(async (client) => {
    await ownerMemberOf(client, familyId);
    // Fixed ids are globally unique rows, so a retry of this same test would
    // otherwise collide with its own previous attempt. Each test owns a
    // `scope`, which is what keeps parallel workers from colliding too.
    await client.query(`delete from member where id::text like $1`, [
      `00000000-0000-4000-8000-000000${scope}%`,
    ]);
    const [mila] = await seedMembers(client, familyId, [
      { id: ID(scope, '00001'), displayName: 'Mila', role: 'child', color: 'purple', sortOrder: 1 },
    ]);

    const [morning, vitamins, homework, bedtime] = await seedRoutines(client, familyId, [
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

    return { mila, morning, vitamins, homework, bedtime };
  });
}

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`routine visuals — ${name}`, () => {
    test.use({ viewport });

    test('hub routine board', async ({ page, family }) => {
      const { mila } = await seedBoard(family.familyId, name === 'tablet' ? 'a' : 'b');

      await page.goto(`/nl/hub/routines/${mila.id}?date=${ANCHOR}&time=${ANCHOR_TIME}`);
      await expect(page.getByTestId('routine-board')).toBeVisible();
      await settlePage(page);

      await expect(page).toHaveScreenshot(`hub-routines-${name}.png`, { fullPage: true });
    });

    test('routine builder', async ({ page, family }) => {
      await seedBoard(family.familyId, name === 'tablet' ? 'c' : 'd');

      await page.goto('/nl/routines');
      await expect(page.getByTestId('routine-row').first()).toBeVisible();
      await settlePage(page);

      await expect(page).toHaveScreenshot(`routines-builder-${name}.png`, { fullPage: true });
    });
  });
}
