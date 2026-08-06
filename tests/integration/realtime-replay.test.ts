import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, lt } from 'drizzle-orm';
import { MAX_REPLAY_ROWS } from '@/modules/realtime/domain/cursor';
import { publish } from '@/modules/realtime/publish';
import { countEventsAfter, replayEvents } from '@/modules/realtime/queries';
import { eventLog } from '@/modules/realtime/schema';
import { planReplay } from '@/modules/realtime/stream';
import {
  createTestDb,
  databaseUrl,
  seedHousehold,
  type Household,
  type TestDb,
} from './support/db';

/**
 * Catch-up over a real log (docs/architecture.md §4 "Reconnect flow").
 *
 * Three things have to be true of a reconnecting client, and only the first is
 * obvious:
 *
 *  1. it gets exactly the rows after its cursor, in id order;
 *  2. it gets **only its own family's** rows — the replay predicate is scoped,
 *     so a second household seeded here must be invisible;
 *  3. when the gap cannot be honestly replayed, it is told to refetch instead
 *     of being handed a partial history that looks complete.
 */

const RUN = databaseUrl ? describe : describe.skip;

RUN('Last-Event-ID replay', () => {
  let db: TestDb;
  let pool: { end: () => Promise<void> };
  let household: Household;
  let neighbour: Household;
  /** Event ids in publication order. */
  let ids: bigint[];

  beforeAll(async () => {
    // `publish()`/`planReplay()` go through the app's own `getDb()`, which
    // validates the whole server env at first use. Same shim the Google
    // integration suites use — the values are never exercised, only parsed.
    process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

    const created = createTestDb();
    db = created.db;
    pool = created.pool;

    household = await seedHousehold(db, 'Replay');
    neighbour = await seedHousehold(db, 'Neighbour');

    ids = [];
    for (let index = 0; index < 6; index += 1) {
      const event = await publish({
        familyId: household.familyId,
        type: 'routine.updated',
        entity: { id: `routine-${index}` },
        actor: { source: 'job' },
        patch: { index },
      });
      ids.push(BigInt(event.id));
    }

    // Interleaved, so an unscoped query would pick it up.
    await publish({
      familyId: neighbour.familyId,
      type: 'routine.updated',
      entity: { id: 'not-ours' },
      actor: { source: 'job' },
    });
  }, 30_000);

  afterAll(async () => {
    await pool?.end();
  });

  it('replays only rows after the cursor, in order', async () => {
    const replayed = await replayEvents(household.familyId, ids[2]);

    expect(replayed.map((event) => BigInt(event.id))).toEqual(ids.slice(3));
    // Ordered, not merely complete: a client applies these in sequence.
    expect(replayed.map((event) => (event.patch as { index: number }).index)).toEqual([3, 4, 5]);
  });

  it('never crosses a family boundary', async () => {
    const replayed = await replayEvents(household.familyId, 0n);

    expect(replayed.every((event) => event.familyId === household.familyId)).toBe(true);
    expect(replayed.map((event) => event.entity.id)).not.toContain('not-ours');
  });

  it('stamps each replayed event with its own log id', async () => {
    // `publish()` writes the payload before the id exists and rewrites it; the
    // replay re-stamps from the column regardless, so a row written by an older
    // build cannot replay as `id: "0"` and reset every client's cursor.
    const replayed = await replayEvents(household.familyId, ids[4]);
    expect(replayed).toHaveLength(1);
    expect(replayed[0].id).toBe(String(ids[5]));
  });

  it('plans a replay for a cursor inside the window', async () => {
    const { decision } = await planReplay(household.familyId, ids[3]);
    expect(decision).toEqual({ kind: 'replay', cursor: ids[3] });
  });

  it('plans a live attach for a client with no cursor', async () => {
    const { decision, head } = await planReplay(household.familyId, null);
    expect(decision).toEqual({ kind: 'live' });
    expect(head).toBe(ids[5]);
  });

  it('counts pending rows only up to the ceiling', async () => {
    // Bounded by construction: the count is only ever compared against 500, so
    // it must never become a full table scan on a busy family.
    const pending = await countEventsAfter(household.familyId, 0n);
    expect(pending).toBe(6);
    expect(pending).toBeLessThanOrEqual(MAX_REPLAY_ROWS + 1);
  });

  it('resyncs when the gap exceeds the replay ceiling', async () => {
    const busy = await seedHousehold(db, 'Busy');

    // One row over the ceiling, on purpose: the boundary is the interesting
    // case, and `MAX_REPLAY_ROWS` exactly must still replay.
    const rows = Array.from({ length: MAX_REPLAY_ROWS + 1 }, (_, index) => ({
      familyId: busy.familyId,
      type: 'routine.updated' as const,
      payload: {
        v: 1 as const,
        id: '0',
        familyId: busy.familyId,
        type: 'routine.updated' as const,
        at: new Date().toISOString(),
        actor: { source: 'job' as const },
        entity: { id: `bulk-${index}` },
      },
    }));
    await db.insert(eventLog).values(rows);

    // `event_log.id` is a single global sequence, so this family's first row is
    // not id 1. The cursor has to sit exactly one before it — otherwise the
    // retention rule fires first and the ceiling is never reached.
    const [first, second] = await db
      .select({ id: eventLog.id })
      .from(eventLog)
      .where(eq(eventLog.familyId, busy.familyId))
      .orderBy(eventLog.id)
      .limit(2);

    const { decision } = await planReplay(busy.familyId, first.id - 1n);
    expect(decision).toEqual({ kind: 'resync', reason: 'gap' });

    // …and one row fewer replays normally, so the ceiling is a ceiling and not
    // a blanket refusal.
    const { decision: narrower } = await planReplay(busy.familyId, first.id);
    expect(narrower).toEqual({ kind: 'replay', cursor: first.id });
    expect(second.id).toBeGreaterThan(first.id);
  }, 30_000);

  it('resyncs when retention trimmed the rows the client missed', async () => {
    const stale = await seedHousehold(db, 'Stale');

    const kept: bigint[] = [];
    for (let index = 0; index < 4; index += 1) {
      const event = await publish({
        familyId: stale.familyId,
        type: 'routine.updated',
        entity: { id: `stale-${index}` },
        actor: { source: 'job' },
      });
      kept.push(BigInt(event.id));
    }

    // The nightly trim, simulated: everything the client had already seen is
    // gone, and so is one row it had not.
    await db
      .delete(eventLog)
      .where(and(eq(eventLog.familyId, stale.familyId), lt(eventLog.id, kept[2])));

    // The client's cursor is the first event — two rows before the oldest one
    // that still exists, so its gap cannot be described.
    const { decision } = await planReplay(stale.familyId, kept[0]);
    expect(decision).toEqual({ kind: 'resync', reason: 'retention' });

    // A client that had already caught up to the retention edge is fine.
    const { decision: caughtUp } = await planReplay(stale.familyId, kept[2]);
    expect(caughtUp).toEqual({ kind: 'replay', cursor: kept[2] });
  }, 30_000);
});
