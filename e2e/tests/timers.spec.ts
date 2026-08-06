import { expect, test } from '../fixtures/family';
import { ownerMemberOf, readTimers, seedTimers, withDb } from '../utils/seed';

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
 * The ±1s acceptance check, in the units the board actually shows.
 *
 * The digits are `Math.ceil` of the remaining time (the last second is shown
 * for the whole of it), and this expectation is computed one round-trip after
 * the digits were read — so the comparison is against the *displayed* second,
 * one either way, rather than against a real number.
 */
function expectWithinOneSecond(shown: number, expected: number): void {
  expect(shown).toBeGreaterThanOrEqual(Math.ceil(expected) - 1);
  expect(shown).toBeLessThanOrEqual(Math.ceil(expected) + 1);
}

test.describe('hub timers', () => {
  test('resumes at the correct remaining time across a reload', async ({ page, family }) => {
    const row = await seedRunningTimer(family.familyId, 'Schoenen aan');

    await page.goto('/nl/hub/timers');
    await expect(page.getByTestId('timer-tile')).toBeVisible();

    const first = toSeconds(await page.getByTestId('timer-digits').innerText());
    expectWithinOneSecond(first, expectedRemaining(row));
    // It resumed mid-countdown rather than starting over.
    expect(first).toBeLessThan(DURATION);

    // Let real time pass, then reload: the countdown must pick up where the
    // clock is, not where the page left off.
    await page.waitForTimeout(3000);
    await page.reload();
    await expect(page.getByTestId('timer-tile')).toBeVisible();

    const second = toSeconds(await page.getByTestId('timer-digits').innerText());
    expectWithinOneSecond(second, expectedRemaining(row));
    expect(second).toBeLessThan(first);
  });

  test('shows the right countdown on a device whose clock is years out', async ({
    page,
    family,
  }) => {
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
    await seedRunningTimer(family.familyId, 'Jassen aan');

    await page.goto('/nl/hub');

    await expect(page.getByTestId('ambient-timers')).toBeVisible();
    await expect(page.getByTestId('timer-label')).toHaveText('Jassen aan');
  });

  test('states the time is up without marking anything', async ({ page, family }) => {
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

    const hub = await context.newPage();
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

    await hub.close();
  });
});
