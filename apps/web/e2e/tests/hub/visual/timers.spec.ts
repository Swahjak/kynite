import { pairHub } from '@e2e/fixtures/hub';
import { expect, test } from '@e2e/fixtures/family';
import { ownerMemberOf, seedMembers, seedTimers, withDb } from '@e2e/utils/seed';
import { settlePage } from '@e2e/utils/settle';

/**
 * Visual regression for the hub timer board, at the hub tablet viewport
 * (1280×800) — the six-foot legibility claim in one artefact: Display-scale
 * tabular digits, a neutral overrun state, and a transition warning in board
 * voice.
 *
 * Determinism comes from `?now=`, which pins the instant the board renders
 * *and* stops it ticking (`page-data.resolveNow`), the same trick the routine
 * board's `?date=&time=` uses. Without it a countdown screenshot would differ
 * on every run by construction.
 *
 * Update deliberately with `pnpm e2e:visual:update`.
 */

const VIEWPORT = { width: 1280, height: 800 };

/** The pinned instant, and the timers seeded relative to it. */
const NOW_MS = Date.UTC(2026, 2, 11, 7, 45, 0);

const ID = (suffix: string) => `00000000-0000-4000-8000-0000000e${suffix}`;

test.describe('timer visuals — tablet', { tag: '@visual' }, () => {
  test.use({ viewport: VIEWPORT });

  test('hub timer board', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    await withDb(async (client) => {
      await ownerMemberOf(client, family.familyId);
      // Fixed ids are globally unique rows, so a re-run (or a retry) would
      // collide with its own previous attempt. Timers are cleared explicitly:
      // only the ones owned by a seeded member would go with the member.
      await client.query(`delete from timer where id::text like $1`, [
        '00000000-0000-4000-8000-0000000e%',
      ]);
      await client.query(`delete from member where id::text like $1`, [
        '00000000-0000-4000-8000-0000000e%',
      ]);
      const [mila] = await seedMembers(client, family.familyId, [
        {
          id: ID('0001'),
          displayName: 'Mila',
          role: 'child',
          color: 'purple',
          sortOrder: 1,
        },
      ]);

      // Absolute starts, relative to the pinned instant the page renders at.
      // Deriving them from the real clock instead put the remaining time a
      // fraction either side of a second boundary and flipped the last digit
      // between runs — a genuinely flaky baseline.
      const startedAt = (secondsBefore: number) =>
        new Date(NOW_MS - secondsBefore * 1000).toISOString();

      await seedTimers(client, family.familyId, [
        // Mid-countdown: 4:30 left of ten minutes, no warning yet.
        {
          id: ID('1001'),
          label: 'Tanden poetsen',
          durationSeconds: 600,
          startedAt: startedAt(330),
          memberId: mila.id,
          warningLeadSeconds: 60,
        },
        // Inside its warning lead: the transition line is in the shot.
        {
          id: ID('1002'),
          label: 'Schoenen aan',
          durationSeconds: 300,
          startedAt: startedAt(120),
          memberId: mila.id,
          warningLeadSeconds: 300,
        },
        // Over, and calm about it.
        {
          id: ID('1003'),
          label: 'Opruimen',
          durationSeconds: 120,
          startedAt: startedAt(200),
          warningLeadSeconds: null,
        },
      ]);
    });

    await page.goto(`/nl/hub/timers?now=${NOW_MS}`);
    await expect(page.getByTestId('timer-board')).toBeVisible();
    await expect(page.getByTestId('timer-tile')).toHaveCount(3);
    await settlePage(page);

    await expect(page).toHaveScreenshot('hub-timers-tablet.png', { fullPage: true });
  });
});
