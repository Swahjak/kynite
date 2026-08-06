import { Client } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { familyChannel, publish } from '@/modules/realtime/publish';
import { eventLog } from '@/modules/realtime/schema';
import {
  createTestDb,
  databaseUrl,
  seedHousehold,
  type Household,
  type TestDb,
} from './support/db';

/**
 * `publish()` against a real Postgres (M10).
 *
 * The criterion is transactional: "`publish()` inserts into `event_log` and
 * calls `pg_notify` inside the caller's transaction; a rolled-back write emits
 * no notification". M09 left this untested, and the test that existed was
 * vacuous — it forged an id, which was refused *before* a transaction ever
 * opened, so nothing about rollback was exercised at all.
 *
 * So the rollback here is forced from inside: the caller opens a transaction,
 * writes a row, publishes, and *then* throws. That is the only shape in which
 * "the notification escaped even though the write did not" can be observed —
 * and it is the shape a real failure takes (a constraint violation on a second
 * statement, a crash mid-action).
 *
 * A dedicated `LISTEN` client is attached throughout, because "no notification"
 * is not provable from the database's own tables: `pg_notify` leaves no trace
 * anywhere except in the connections that were listening at the time.
 */

const RUN = databaseUrl ? describe : describe.skip;

/** Long enough for a committed NOTIFY to have arrived; short enough to be a test. */
const DELIVERY_WINDOW_MS = 400;

RUN('publish() is transactional', () => {
  let db: TestDb;
  let pool: { end: () => Promise<void> };
  let listener: Client;
  let household: Household;
  let received: string[];

  beforeAll(async () => {
    // `publish()` goes through the app's own `getDb()`, which validates the
    // whole server env at first use. Same shim the Google integration suites
    // use — the values are never exercised, only parsed.
    process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

    const created = createTestDb();
    db = created.db;
    pool = created.pool;

    household = await seedHousehold(db, 'Publish');

    listener = new Client({ connectionString: databaseUrl });
    await listener.connect();
    received = [];
    listener.on('notification', (message) => {
      if (message.payload) received.push(message.payload);
    });
    await listener.query(`LISTEN ${familyChannel(household.familyId)}`);
  });

  afterEach(() => {
    received.length = 0;
  });

  afterAll(async () => {
    await listener?.end();
    await pool?.end();
  });

  async function settle(): Promise<void> {
    // NOTIFY is delivered on commit, asynchronously. A round trip on the
    // listening connection is what forces the client to read what is waiting.
    await listener.query('SELECT 1');
    await new Promise((resolve) => setTimeout(resolve, DELIVERY_WINDOW_MS));
    await listener.query('SELECT 1');
  }

  it('delivers the event on commit, with the row it wrote', async () => {
    const event = await db.transaction((tx) =>
      publish(
        {
          familyId: household.familyId,
          type: 'completion.created',
          entity: { id: 'entity-1' },
          actor: { memberId: household.childId, clientId: 'tap-commit', source: 'hub' },
          patch: { stars: 1 },
        },
        tx
      )
    );

    await settle();

    expect(received).toHaveLength(1);
    const delivered = JSON.parse(received[0]);
    expect(delivered.id).toBe(event.id);
    expect(delivered.type).toBe('completion.created');
    // The idempotency key rides along, which is what makes echo suppression
    // possible on the device that tapped (§4).
    expect(delivered.actor.clientId).toBe('tap-commit');

    const rows = await db
      .select({ id: eventLog.id })
      .from(eventLog)
      .where(sql`${eventLog.id} = ${BigInt(event.id)}`);
    expect(rows).toHaveLength(1);
  });

  it('emits nothing when the caller’s transaction rolls back', async () => {
    const before = await db
      .select({ count: sql<string>`count(*)` })
      .from(eventLog)
      .where(sql`${eventLog.familyId} = ${household.familyId}`);

    await expect(
      db.transaction(async (tx) => {
        await publish(
          {
            familyId: household.familyId,
            type: 'timer.started',
            entity: { id: 'entity-rollback' },
            actor: { memberId: household.parentId, source: 'mobile' },
          },
          tx
        );

        // The failure a real action hits *after* it has published: a constraint
        // violation, a bug, a crash. Everything in this transaction — the
        // event_log row and the notification alike — must go with it.
        throw new Error('forced rollback after publish');
      })
    ).rejects.toThrow('forced rollback after publish');

    await settle();

    // No notification escaped…
    expect(received).toEqual([]);

    // …and no row survived either.
    const after = await db
      .select({ count: sql<string>`count(*)` })
      .from(eventLog)
      .where(sql`${eventLog.familyId} = ${household.familyId}`);
    expect(Number(after[0].count)).toBe(Number(before[0].count));

    const orphan = await db
      .select({ id: eventLog.id })
      .from(eventLog)
      .where(
        // Scoped to this household: the suite shares a database with every
        // other integration file, and an unscoped predicate would fail on
        // somebody else's perfectly good timer.
        sql`${eventLog.familyId} = ${household.familyId} and ${eventLog.payload} ->> 'type' = 'timer.started'`
      );
    expect(orphan).toEqual([]);
  });

  it('still delivers after a rollback — the channel is not poisoned', async () => {
    // A failed publish must not leave the listener deaf: the very next
    // successful write has to arrive normally.
    await publish({
      familyId: household.familyId,
      type: 'routine.updated',
      entity: { id: 'entity-after' },
      actor: { memberId: household.parentId, source: 'mobile' },
    });

    await settle();

    expect(received).toHaveLength(1);
    expect(JSON.parse(received[0]).type).toBe('routine.updated');
  });

  it('notifies by reference when the payload would exceed the NOTIFY cap', async () => {
    // Postgres refuses a payload over 8000 bytes — and refusing it would roll
    // the caller's write back. An oversized event travels as `{ref}` instead.
    const event = await publish({
      familyId: household.familyId,
      type: 'event.upserted',
      entity: { id: 'entity-big' },
      actor: { source: 'sync' },
      patch: { description: 'x'.repeat(6000) },
    });

    await settle();

    expect(received).toHaveLength(1);
    expect(JSON.parse(received[0])).toEqual({ ref: event.id });

    // The full event is still in the log, which is where the stream reads it.
    const [row] = await db
      .select({ payload: eventLog.payload })
      .from(eventLog)
      .where(sql`${eventLog.id} = ${BigInt(event.id)}`);
    expect((row.payload.patch as { description: string }).description).toHaveLength(6000);
  });
});
