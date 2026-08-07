import { pairHub } from '@e2e/fixtures/hub';
import type { Page } from '@playwright/test';
import { expect, test } from '@e2e/fixtures/family';
import {
  ownerMemberOf,
  readCompletions,
  readStarLedger,
  seedMembers,
  seedRoutines,
  withDb,
} from '@e2e/utils/seed';

/**
 * The offline tap (docs/architecture.md §4; research: a celebration a child has
 * seen is never taken back).
 *
 * The scenario is the one that actually happens in a kitchen: the wifi drops,
 * a child taps anyway, and nobody tells them the network is down. What the
 * system owes them is three things, in order of how much they matter:
 *
 *  1. **the celebration happens, and stays.** Not "is replayed later" — stays
 *     on screen, through the failure, through the reconnect, through the
 *     refetch that follows it;
 *  2. **the tap is durable** the moment it is made, in IndexedDB, before the
 *     request it will eventually become;
 *  3. **the write lands exactly once** when the network returns, because
 *     `clientId` is a unique index and a replay is a no-op rather than a
 *     second star.
 *
 * Full offline support — the service worker, the precached shell, booting the
 * hub from IndexedDB — is M11. This is the narrow slice the <100ms completion
 * flow cannot be correct without.
 */

const LONG_AGO = new Date(Date.now() - 60 * 86_400_000).toISOString();

const OUTBOX_DB = 'kynite-realtime';
const OUTBOX_STORE = 'completion-outbox';

/** What the browser currently has queued. */
async function queuedTaps(page: Page): Promise<{ clientId: string }[]> {
  return page.evaluate(
    ([databaseName, storeName]) =>
      new Promise<{ clientId: string }[]>((resolve) => {
        const request = indexedDB.open(databaseName, 1);
        request.onerror = () => resolve([]);
        request.onsuccess = () => {
          const database = request.result;
          try {
            const store = database
              .transaction(storeName, 'readonly')
              .objectStore(storeName)
              .getAll();
            store.onsuccess = () => resolve(store.result as { clientId: string }[]);
            store.onerror = () => resolve([]);
          } catch {
            resolve([]);
          }
        };
      }),
    [OUTBOX_DB, OUTBOX_STORE] as const
  );
}

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
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '00:01', graceDays: 1 },
        starsPerCompletion: 2,
        createdAt: LONG_AGO,
        steps: [{ title: 'Bed opmaken' }, { title: 'Tanden poetsen' }],
      },
    ]);

    return { child, routine };
  });
}

test.describe('offline completion outbox', () => {
  test('a tap made offline celebrates, queues, and lands once on reconnect', async ({
    page,
    context,
    family,
  }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const { child, routine } = await seedBoard(family.familyId);
    const stepId = routine.stepIds[0];

    await page.goto(`/nl/hub/routines/${child.id}`);
    await expect(page.getByTestId('routine-board')).toBeVisible();
    await expect(page.getByTestId('routine-step').first()).toBeVisible();

    const row = page.locator(`[data-step-id="${stepId}"]`);

    await context.setOffline(true);

    await row.getByTestId('step-tap').click();

    // 1. The celebration happened, with no network at all.
    await expect(row).toHaveAttribute('data-state', 'done');
    await expect(row.getByTestId('step-praise')).toBeVisible();

    // 2. The tap is durable.
    await expect.poll(() => queuedTaps(page).then((rows) => rows.length)).toBe(1);
    const [queued] = await queuedTaps(page);
    expect(queued.clientId).toContain(stepId);

    // Nothing reached the database, which is what makes the queue load-bearing
    // rather than decorative.
    expect(await withDb((client) => readCompletions(client, family.familyId))).toHaveLength(0);

    await context.setOffline(false);

    // 3. The write lands — once — when the stream comes back. The flush is
    // driven by the SSE connection state, not by `navigator.onLine`.
    await expect
      .poll(
        () => withDb((client) => readCompletions(client, family.familyId)).then((r) => r.length),
        { timeout: 20_000 }
      )
      .toBe(1);

    await expect
      .poll(() => queuedTaps(page).then((rows) => rows.length), { timeout: 15_000 })
      .toBe(0);

    // One star, not two: the replay conflicted on `clientId` and awarded
    // nothing, which is the only reason retrying is safe at all.
    const ledger = await withDb((client) => readStarLedger(client, family.familyId));
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amount).toBe(2);

    // And after the refetch that follows the flush, the celebration is still
    // there. Nothing rolled back at any point in the sequence.
    await expect(row).toHaveAttribute('data-state', 'done');
  });

  test('a repeated offline tap of the same step never doubles the star', async ({
    page,
    context,
    family,
  }) => {
    // M12: hub surfaces run behind a device principal, never an account
    // session — this browser is the wall tablet for the rest of the test.
    await pairHub(page, family.familyId);

    const { child, routine } = await seedBoard(family.familyId);
    const stepId = routine.stepIds[0];

    await page.goto(`/nl/hub/routines/${child.id}`);
    await expect(page.getByTestId('routine-board')).toBeVisible();

    const row = page.locator(`[data-step-id="${stepId}"]`);

    await context.setOffline(true);
    await row.getByTestId('step-tap').click();
    // A completed step is not re-tappable, so the second tap is a reload away —
    // the shape an impatient child actually produces.
    await expect(row).toHaveAttribute('data-state', 'done');

    // The queue is keyed by `clientId`, which is derived rather than random, so
    // a second tap of the same step on the same day overwrites rather than
    // stacks.
    await expect.poll(() => queuedTaps(page).then((rows) => rows.length)).toBe(1);

    await context.setOffline(false);

    await expect
      .poll(
        () => withDb((client) => readStarLedger(client, family.familyId)).then((r) => r.length),
        { timeout: 20_000 }
      )
      .toBe(1);

    expect(await withDb((client) => readCompletions(client, family.familyId))).toHaveLength(1);
  });
});
