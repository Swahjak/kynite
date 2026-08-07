import { pairHub } from '@e2e/fixtures/hub';
import { expect, test } from '@e2e/fixtures/family';
import { idsForPraise } from '@e2e/utils/praise-ids';
import { ownerMemberOf, readCompletions, seedMembers, seedRoutines, withDb } from '@e2e/utils/seed';
import { settlePage } from '@e2e/utils/settle';

/**
 * The celebration end-frame (M17).
 *
 * A confetti burst is the hardest thing in this product to screenshot honestly,
 * and the temptation is to screenshot it badly: catch it mid-flight and every
 * run diffs, or disable it and the baseline proves nothing. Four things make
 * this frame deterministic, and each removes a different source of variance:
 *
 * 1. **A seeded RNG.** `canvas-confetti` draws its particles from
 *    `Math.random()`. An init script replaces it with a fixed-seed mulberry32
 *    before any page script runs, so the burst is identical from run to run.
 *    The seam is the platform's, injected by the harness — no test-only code
 *    exists in the product for this.
 * 2. **A frozen clock.** `?date=&time=` pins the board's own time, so the card
 *    is in its "live routine" treatment rather than whichever treatment the
 *    real time of day would have produced.
 * 3. **Chosen praise, random ids.** The praise line is a hash of
 *    `member:step:date`, so the words follow from the ids. Rather than fixing
 *    the ids (globally unique rows, which collide with a concurrent copy of
 *    this same test) the ids are random and *searched* for one that produces
 *    the line this baseline was taken with — see `utils/praise-ids.ts`.
 * 4. **The end frame, not a middle one.** The shot is taken once the star has
 *    settled (`data-settled="true"`, the star's own end state, not a timeout)
 *    and the confetti canvas has finished and torn itself down. That frame is
 *    the one that has to stay right anyway: it is what a family looks at for
 *    the seconds after the tap, and it is the only frame of the animation that
 *    is defined rather than sampled.
 *
 * The date is *today* rather than a fixed anchor because a tap is a real
 * write: a completion outside its grace window is refused by the server, and
 * the optimistic row would flip back mid-screenshot. The card is shot as an
 * element for the same reason — the board's header carries today's date, and
 * nothing else in the frame does.
 */

/** A deterministic `Math.random`, installed before any page script runs. */
const SEEDED_RANDOM = `
  (() => {
    let seed = 0x9e3779b9;
    Math.random = () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
`;

test.describe('celebration visuals — hub tablet', () => {
  test('the end frame after a completion tap', async ({ page, family }) => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(
      new Date()
    );
    // The first step is the one that gets tapped, so it is the one whose praise
    // has to be pinned.
    const { memberId, routineStepId } = idsForPraise('byYourself', today);

    await page.addInitScript(SEEDED_RANDOM);
    await pairHub(page, family.familyId);

    await withDb(async (client) => {
      await ownerMemberOf(client, family.familyId);
      await seedMembers(client, family.familyId, [
        {
          id: memberId,
          displayName: 'Mila',
          role: 'child',
          color: 'purple',
          sortOrder: 1,
        },
      ]);
      await seedRoutines(client, family.familyId, [
        {
          title: 'Klaarmaken voor school',
          ownerMemberId: memberId,
          icon: 'wb_sunny',
          schedule: { rrule: 'FREQ=DAILY', timeOfDay: '07:30' },
          starsPerCompletion: 2,
          createdAt: '2026-01-05T06:00:00Z',
          steps: [
            { id: routineStepId, title: 'Bed opmaken' },
            { title: 'Tanden poetsen' },
            { title: 'Aankleden' },
          ],
        },
      ]);
    });

    await page.goto(`/nl/hub/routines/${memberId}?date=${today}&time=07:45`);
    await expect(page.getByTestId('routine-board')).toBeVisible();

    const card = page.getByTestId('routine-card').first();
    const first = card.getByTestId('routine-step').first();
    await expect(first).toHaveAttribute('data-state', 'todo');
    await first.getByTestId('step-tap').click();

    // The done treatment is immediate and optimistic (the <100ms NFR); the
    // star's scale-up is the only thing with a duration, and it announces its
    // own completion rather than being waited out.
    await expect(first).toHaveAttribute('data-state', 'done');
    await expect(first.getByTestId('step-praise')).toBeVisible();
    await expect(first.locator('[data-slot="star-pop"]')).toHaveAttribute('data-settled', 'true');

    // The write landed — otherwise the row would flip back to `todo` on
    // revalidation, possibly mid-screenshot. Asserted against the database
    // rather than the rendering, because the rendering is what is being
    // photographed.
    await expect
      .poll(async () => (await withDb((client) => readCompletions(client, family.familyId))).length)
      .toBe(1);

    // The burst is over and has cleaned up after itself. `canvas-confetti`
    // removes its global canvas once the last particle's `ticks` run out, so
    // "no canvas" is the animation's own end condition — and it means the
    // screenshot below cannot contain a half-fallen particle.
    await expect
      .poll(async () => page.evaluate(() => document.querySelectorAll('canvas').length), {
        timeout: 5_000,
      })
      .toBe(0);

    await settlePage(page);

    await expect(card).toHaveScreenshot('celebration-end-frame-tablet.png');
  });
});
