import { newAnonymousContext } from '@e2e/utils/context';
import { pairHub } from '@e2e/fixtures/hub';
import { expect, test } from '@e2e/fixtures/family';
import { ownerMemberOf, readTimers, seedTimers, withDb } from '@e2e/utils/seed';

/**
 * Timers end to end (M09).
 *
 * The acceptance criterion that matters is the one a family feels: **a hub
 * reloaded mid-countdown resumes on the right second.** That only holds
 * because the row stores a start time rather than a remaining time, so the
 * test reads the seeded `started_at` back from the database and checks the
 * digits against it — the same derivation the client does, computed
 * independently here.
 *
 * The second spec runs the same page against a device clock set to 2020 and
 * asserts the countdown is still right, which is the whole reason the server
 * echoes its own `now`.
 */

const DURATION = 600;
const STARTED_AGO = 30;

/** `4:30` → 270. */
function toSeconds(digits: string): number {
  const parts = digits.trim().split(':').map(Number);
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
}

async function seedRunningTimer(familyId: string, label: string) {
  return withDb(async (client) => {
    await ownerMemberOf(client, familyId);
    await seedTimers(client, familyId, [
      { label, durationSeconds: DURATION, startedSecondsAgo: STARTED_AGO },
    ]);
    const rows = await readTimers(client, familyId);
    return rows[0] as { id: string; started_at: Date; duration_seconds: number };
  });
}

/** What the countdown *should* say right now, derived from the stored start. */
function expectedRemaining(row: { started_at: Date; duration_seconds: number }): number {
  const elapsed = (Date.now() - new Date(row.started_at).getTime()) / 1000;
  return row.duration_seconds - elapsed;
}

/**
 * Slack added either side of the bracket, in whole seconds (review finding 5).
 *
 * `±1` covers the `Math.ceil` rounding alone, on the assumption that "sample
 * the clock" and "read the rendered digits" are effectively simultaneous. They
 * are not: `page.getByTestId(...).innerText()` is a round trip to the browser,
 * and under a loaded CI runner or four parallel `next dev` workers the server
 * can take real, variable time to render the response between the `before`
 * sample and the moment the digits actually reach the page — time during
 * which the *true* remaining seconds keep ticking down independently of when
 * this test happens to observe them. A margin sized only for rounding treats
 * that render latency as zero and fails on exactly the runs where the
 * machine was slow, which says nothing about whether the countdown is
 * correct. Two seconds of slack is generous next to typical render latency
 * without being wide enough to hide a countdown that is actually wrong by a
 * meaningful amount.
 */
const RENDER_LATENCY_SLACK_S = 2;

/**
 * Read the digits, bracketed by the clock either side of the read.
 *
 * The digits are `Math.ceil` of the remaining time (the last second is shown
 * for the whole of it), so the honest expectation is not "equals now, ±slack"
 * but "lies inside the interval that elapsed while we were reading, ±slack for
 * rounding and render latency". Comparing against a single instant sampled
 * *after* the read was the M09 shape and it flaked: the page renders from
 * `serverNow` at hydration, the expectation is computed one round-trip later,
 * and under parallel workers that gap is comfortably more than a second — a
 * test that failed by exactly one, in a way that said nothing about timers.
 */
async function readCountdown(
  page: import('@playwright/test').Page,
  row: { started_at: Date; duration_seconds: number }
): Promise<number> {
  const before = expectedRemaining(row);
  const shown = toSeconds(await page.getByTestId('timer-digits').innerText());
  const after = expectedRemaining(row);

  expect(shown, 'the countdown is behind the clock').toBeLessThanOrEqual(
    Math.ceil(before) + RENDER_LATENCY_SLACK_S
  );
  expect(shown, 'the countdown is ahead of the clock').toBeGreaterThanOrEqual(
    Math.ceil(after) - RENDER_LATENCY_SLACK_S
  );

  return shown;
}

test.describe('hub timers', () => {
  test('resumes at the correct remaining time across a reload', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const row = await seedRunningTimer(family.familyId, 'Schoenen aan');

    await page.goto('/nl/hub/timers');
    await expect(page.getByTestId('timer-tile')).toBeVisible();

    const first = await readCountdown(page, row);
    // It resumed mid-countdown rather than starting over.
    expect(first).toBeLessThan(DURATION);

    // Let real time pass, then reload: the countdown must pick up where the
    // clock is, not where the page left off.
    await page.waitForTimeout(3000);
    await page.reload();
    await expect(page.getByTestId('timer-tile')).toBeVisible();

    const second = await readCountdown(page, row);
    expect(second).toBeLessThan(first);
  });

  test('shows the right countdown on a device whose clock is years out', async ({
    page,
    family,
  }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const row = await seedRunningTimer(family.familyId, 'Tanden poetsen');

    // A wall tablet that lost its clock. `setFixedTime` leaves timers running
    // but makes `Date.now()` nonsense — exactly the case the server-time echo
    // and `clockOffsetMs` exist for.
    await page.clock.setFixedTime(new Date('2020-01-01T00:00:00Z'));

    await page.goto('/nl/hub/timers');
    await expect(page.getByTestId('timer-tile')).toBeVisible();

    const shown = toSeconds(await page.getByTestId('timer-digits').innerText());

    // Three seconds of slack rather than one: with `Date.now()` frozen the
    // local tick cannot advance at all, so the digits are only as fresh as the
    // measurement taken at mount. The point of the assertion is that the
    // display follows the *server's* clock — trusting the device would have
    // shown 0:00.
    expect(Math.abs(shown - expectedRemaining(row))).toBeLessThanOrEqual(3);
    expect(shown).toBeGreaterThan(0);
  });

  test('renders an active timer on the ambient board without navigation', async ({
    page,
    family,
  }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    await seedRunningTimer(family.familyId, 'Jassen aan');

    await page.goto('/nl/hub');

    await expect(page.getByTestId('ambient-timers')).toBeVisible();
    await expect(page.getByTestId('timer-label')).toHaveText('Jassen aan');
  });

  test('states the time is up without marking anything', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    await withDb(async (client) => {
      await ownerMemberOf(client, family.familyId);
      await seedTimers(client, family.familyId, [
        { label: 'Opruimen', durationSeconds: 60, startedSecondsAgo: 90 },
      ]);
    });

    await page.goto('/nl/hub/timers');

    const tile = page.getByTestId('timer-tile');
    await expect(tile).toHaveAttribute('data-phase', 'overrun');
    await expect(page.getByTestId('timer-overrun')).toHaveText('De tijd is om.');
    // Neutral to the end: the digits rest at zero, and nothing turns red.
    await expect(page.getByTestId('timer-digits')).toHaveText('0:00');
    await expect(tile).not.toHaveClass(/destructive|red/);
  });

  test('announces a transition in board voice, never as a command', async ({ page, family }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    await withDb(async (client) => {
      await ownerMemberOf(client, family.familyId);
      await seedTimers(client, family.familyId, [
        // 20s into a 5-minute timer whose warning lead is the whole duration:
        // the warning is live the moment the board loads.
        {
          label: 'Schoenen aan',
          durationSeconds: 300,
          startedSecondsAgo: 20,
          warningLeadSeconds: 300,
        },
      ]);
    });

    await page.goto('/nl/hub/timers');

    const warning = page.getByTestId('timer-warning');
    await expect(warning).toBeVisible();
    // Unanchored: the line carries a leading icon glyph as well as the copy.
    await expect(warning).toHaveText(/Schoenen aan over \d+ minu(?:ut|ten)/);
    // FR30: the board states the transition; it never addresses the child.
    await expect(warning).not.toHaveText(/\b(?:je|jij|jouw|jullie)\b/i);
  });
});

test.describe('controller → hub', () => {
  test('a timer started on the Controller appears on the hub, and stopping removes it', async ({
    page,
    context,
    family,
  }) => {
    await withDb(async (client) => {
      await ownerMemberOf(client, family.familyId);
    });

    // Two *contexts*, not two pages in one: this test drives the Controller as
    // a parent and the board as a kiosk simultaneously, and since M12 a device
    // cookie outranks the account session for every request the browser makes
    // (`modules/family/principal.ts`). Cookies are per context, so the wall
    // tablet needs its own — which is also what the real arrangement looks
    // like: a phone in a hand and a tablet on a wall.
    const kiosk = await newAnonymousContext(context.browser()!, { locale: 'nl-NL' });
    const hub = await kiosk.newPage();
    await hub.goto('/nl/hub/pair');
    await pairHub(hub, family.familyId);

    await hub.goto('/nl/hub/timers');
    await expect(hub.getByTestId('timer-board-empty')).toBeVisible();

    await page.goto('/nl/timers');

    // A warm-up round first, on a generous budget. The e2e server is
    // `next dev`, so the very first Server Action of a route pays for
    // compiling it — which has nothing to do with the propagation budget the
    // next round measures, and is the whole difference between this spec
    // passing alone and failing under four parallel workers.
    await page.getByTestId('timer-label-input').fill('Opwarmen');
    await page.getByTestId('timer-preset-300').click();
    await expect(hub.getByTestId('timer-tile')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('timer-stop').first().click();
    await expect(hub.getByTestId('timer-board-empty')).toBeVisible({ timeout: 15_000 });

    // The measured round. M10's <2s budget, over SSE — the PRD number itself,
    // not a poll interval in disguise: the Controller's write publishes
    // `timer.started` inside its own transaction, the hub's stream delivers it,
    // and the board refetches. M09 allowed 6s here because the transport was a
    // 2s poll.
    await page.getByTestId('timer-label-input').fill('Schoenen aan');
    await page.getByTestId('timer-preset-300').click();

    await expect(hub.getByTestId('timer-tile')).toBeVisible({ timeout: 2000 });
    await expect(hub.getByTestId('timer-label')).toHaveText('Schoenen aan');

    await page.getByTestId('timer-stop').first().click();

    await expect(hub.getByTestId('timer-board-empty')).toBeVisible({ timeout: 2000 });

    const rows = await withDb((client) => readTimers(client, family.familyId));
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.stopped_at !== null)).toBe(true);

    await kiosk.close();
  });
});
