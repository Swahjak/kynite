import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { syncCalendar } from '@/modules/google/domain/sync-engine';
import { pushEvent, type PushableEvent } from '@/modules/google/domain/push-engine';
import { googleEventIdFor } from '@/modules/google/domain/ids';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';
import { createFakeApi, duplicate } from '../unit/google/support/fake-api';
import { googleEvent, tombstone } from '../unit/google/support/fixtures';

/**
 * The sync and push engines against a *real* Postgres, through the drizzle
 * store (docs/architecture.md §9 "Module integration"). The unit suite proves
 * the algorithms; this proves the SQL they run on — the upsert target, the
 * version bump, and above all the M04 carry-forward that
 * `unique(calendarId, googleEventId)` is NULLS DISTINCT, so a local row with no
 * Google id is *not* protected against a duplicate push.
 *
 * `store.ts` is imported dynamically: it pulls in `@/server/db`, which reads
 * `DATABASE_URL` on first use, and this file must stay importable without one.
 */
describe.skipIf(!databaseUrl)('google sync (integration)', () => {
  const { pool, db } = createTestDb();

  let household: Household;
  let accountId: string;
  let calendarId: string;
  let store: typeof import('@/modules/google/store');

  const calendarState = () => ({
    id: calendarId,
    familyId: household.familyId,
    googleCalendarId: 'family@group.calendar.google.com',
    syncToken: null as string | null,
  });

  const emit = async () => {};

  beforeAll(async () => {
    // `@/server/env` validates the whole contract on first read, so the two
    // unrelated required variables must be present even though this suite only
    // exercises the database.
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
    store = await import('@/modules/google/store');

    household = await seedHousehold(db, 'GoogleSync');

    const [account] = await db
      .insert(schema.googleAccount)
      .values({
        familyId: household.familyId,
        ownerMemberId: household.parentId,
        googleUserId: `google-${randomUUID()}`,
        email: 'parent@example.test',
      })
      .returning();
    accountId = account.id;

    const [calendar] = await db
      .insert(schema.calendar)
      .values({
        familyId: household.familyId,
        googleAccountId: accountId,
        googleCalendarId: 'family@group.calendar.google.com',
        summary: 'Gezin',
      })
      .returning();
    calendarId = calendar.id;
  });

  afterAll(async () => {
    await db.delete(schema.family).where(eq(schema.family.id, household.familyId));
    await pool.end();
  });

  async function eventsInCalendar(): Promise<(typeof schema.event.$inferSelect)[]> {
    return db.select().from(schema.event).where(eq(schema.event.calendarId, calendarId));
  }

  it('writes an initial full sync, then applies an incremental change and a tombstone', async () => {
    const api = createFakeApi({
      listEvents: [
        {
          items: [googleEvent({ id: 'a' }), googleEvent({ id: 'b', summary: 'Voetbal' })],
          nextSyncToken: 'token-1',
        },
      ],
    });

    const initial = await syncCalendar({
      calendar: calendarState(),
      api,
      store: store.syncStore,
      emit,
    });

    expect(initial.upserted).toBe(2);
    const [calendarRow] = await db
      .select()
      .from(schema.calendar)
      .where(eq(schema.calendar.id, calendarId));
    expect(calendarRow.syncToken).toBe('token-1');
    expect(calendarRow.syncedAt).toBeInstanceOf(Date);

    // Incremental: one edit, one deletion.
    const incrementalApi = createFakeApi({
      listEvents: [
        {
          items: [
            googleEvent({ id: 'a', summary: 'Zwemles verzet', etag: '"etag-2"' }),
            tombstone('b'),
          ],
          nextSyncToken: 'token-2',
        },
      ],
    });

    const incremental = await syncCalendar({
      calendar: { ...calendarState(), syncToken: 'token-1' },
      api: incrementalApi,
      store: store.syncStore,
      emit,
    });

    expect(incremental).toMatchObject({ mode: 'incremental', upserted: 1, deleted: 1 });
    expect(incrementalApi.calls.listEvents[0].syncToken).toBe('token-1');

    const rows = await eventsInCalendar();
    const a = rows.find((row) => row.googleEventId === 'a')!;
    const b = rows.find((row) => row.googleEventId === 'b')!;

    expect(a.title).toBe('Zwemles verzet');
    // The upsert bumps `version` — the reconciliation input for realtime (§4).
    expect(a.version).toBe(1);
    expect(b.deletedAt).toBeInstanceOf(Date);
    expect(b.version).toBe(1);
  });

  it('is idempotent when the same tombstone arrives twice — real store, no re-broadcast, unchanged deletedAt', async () => {
    // B3b (review fix): the unit suite (tests/unit/google/sync-engine.test.ts)
    // proves the *engine* skips a re-delete. This proves it against the real
    // drizzle `syncStore.tombstone`, whose `isNull(event.deletedAt)` predicate
    // (src/modules/google/store.ts) is what actually makes the second UPDATE
    // a no-op — a mock of our own store would not exercise that SQL at all.
    const beforeLog = await db
      .select()
      .from(schema.eventLog)
      .where(eq(schema.eventLog.familyId, household.familyId))
      // `before`/`after` are diffed by slicing on length below, which is only
      // sound with a deterministic row order — a plain SELECT has none.
      .orderBy(schema.eventLog.id);

    const firstPass = await syncCalendar({
      calendar: { ...calendarState(), syncToken: 'token-4' },
      api: createFakeApi({
        listEvents: [{ items: [googleEvent({ id: 'twice' })], nextSyncToken: 'token-5' }],
      }),
      store: store.syncStore,
      emit: store.publishEmitter,
    });
    expect(firstPass.upserted).toBe(1);

    const deleted = await syncCalendar({
      calendar: { ...calendarState(), syncToken: 'token-5' },
      api: createFakeApi({
        listEvents: [{ items: [tombstone('twice')], nextSyncToken: 'token-6' }],
      }),
      store: store.syncStore,
      emit: store.publishEmitter,
    });
    expect(deleted.deleted).toBe(1);

    const [rowAfterFirstDelete] = await db
      .select()
      .from(schema.event)
      .where(and(eq(schema.event.calendarId, calendarId), eq(schema.event.googleEventId, 'twice')));
    expect(rowAfterFirstDelete.deletedAt).toBeInstanceOf(Date);
    const deletedAtAfterFirst = rowAfterFirstDelete.deletedAt;
    const versionAfterFirst = rowAfterFirstDelete.version;

    const logAfterFirstDelete = await db
      .select()
      .from(schema.eventLog)
      .where(eq(schema.eventLog.familyId, household.familyId))
      // `before`/`after` are diffed by slicing on length below, which is only
      // sound with a deterministic row order — a plain SELECT has none.
      .orderBy(schema.eventLog.id);

    // The same tombstone, again — e.g. a redelivered webhook driving another
    // incremental pass that still carries it.
    const deletedAgain = await syncCalendar({
      calendar: { ...calendarState(), syncToken: 'token-6' },
      api: createFakeApi({
        listEvents: [{ items: [tombstone('twice')], nextSyncToken: 'token-7' }],
      }),
      store: store.syncStore,
      emit: store.publishEmitter,
    });

    // The engine counts it as skipped, not deleted, on the second pass.
    expect(deletedAgain.deleted).toBe(0);
    expect(deletedAgain.skipped).toBe(1);

    const [rowAfterSecondDelete] = await db
      .select()
      .from(schema.event)
      .where(and(eq(schema.event.calendarId, calendarId), eq(schema.event.googleEventId, 'twice')));
    // No-op at the row level: deletedAt and version are byte-for-byte unchanged.
    expect(rowAfterSecondDelete.deletedAt).toEqual(deletedAtAfterFirst);
    expect(rowAfterSecondDelete.version).toBe(versionAfterFirst);

    const logAfterSecondDelete = await db
      .select()
      .from(schema.eventLog)
      .where(eq(schema.eventLog.familyId, household.familyId))
      // `before`/`after` are diffed by slicing on length below, which is only
      // sound with a deterministic row order — a plain SELECT has none.
      .orderBy(schema.eventLog.id);

    // No re-broadcast: the second pass adds a sync.status row (the sync always
    // emits one), but never a second event.deleted for this event.
    const newRows = logAfterSecondDelete.slice(logAfterFirstDelete.length);
    expect(newRows.filter((row) => row.type === 'event.deleted')).toHaveLength(0);

    // Sanity: the first tombstone *did* broadcast, so the assertion above is
    // discriminating and not vacuously true because nothing ever broadcasts.
    const firstDeleteBroadcasts = logAfterFirstDelete
      .slice(beforeLog.length)
      .filter((row) => row.type === 'event.deleted');
    expect(firstDeleteBroadcasts).toHaveLength(1);
  });

  it('stores a recurring series with its override child linked by recurrenceParentId', async () => {
    const master = googleEvent({
      id: 'series-master',
      recurrence: [
        'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
        'EXDATE;TZID=Europe/Amsterdam:20260817T090000',
      ],
    });
    const override = googleEvent({ id: 'series-override', recurringEventId: 'series-master' });

    await syncCalendar({
      calendar: { ...calendarState(), syncToken: 'token-2' },
      api: createFakeApi({ listEvents: [{ items: [override, master], nextSyncToken: 'token-3' }] }),
      store: store.syncStore,
      emit,
    });

    const rows = await eventsInCalendar();
    const masterRow = rows.find((row) => row.googleEventId === 'series-master')!;
    const overrideRow = rows.find((row) => row.googleEventId === 'series-override')!;

    expect(masterRow.rrule).toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO');
    expect(masterRow.exdates).toEqual(['EXDATE;TZID=Europe/Amsterdam:20260817T090000']);
    expect(overrideRow.recurrenceParentId).toBe(masterRow.id);
  });

  it('publishes sync.status and event.upserted into event_log', async () => {
    const before = await db
      .select()
      .from(schema.eventLog)
      .where(eq(schema.eventLog.familyId, household.familyId))
      // `before`/`after` are diffed by slicing on length below, which is only
      // sound with a deterministic row order — a plain SELECT has none.
      .orderBy(schema.eventLog.id);

    await syncCalendar({
      calendar: { ...calendarState(), syncToken: 'token-3' },
      api: createFakeApi({
        listEvents: [{ items: [googleEvent({ id: 'log-1' })], nextSyncToken: 'token-4' }],
      }),
      store: store.syncStore,
      emit: store.publishEmitter,
    });

    const after = await db
      .select()
      .from(schema.eventLog)
      .where(eq(schema.eventLog.familyId, household.familyId))
      // `before`/`after` are diffed by slicing on length below, which is only
      // sound with a deterministic row order — a plain SELECT has none.
      .orderBy(schema.eventLog.id);

    const added = after.slice(before.length);
    expect(added.map((row) => row.type)).toEqual(['event.upserted', 'sync.status']);
    // The payload carries its own log id — the SSE cursor (§4).
    expect(added[0].payload.id).toBe(String(added[0].id));
    expect(added[1].payload.patch).toMatchObject({ state: 'ok' });
  });

  describe('push: NULLS DISTINCT duplicate protection (M04 carry-forward)', () => {
    async function insertLocalEvent(title: string): Promise<typeof schema.event.$inferSelect> {
      const [row] = await db
        .insert(schema.event)
        .values({
          familyId: household.familyId,
          calendarId,
          title,
          startsAt: new Date('2026-09-01T08:00:00Z'),
          endsAt: new Date('2026-09-01T09:00:00Z'),
        })
        .returning();
      return row;
    }

    function pushable(row: typeof schema.event.$inferSelect): PushableEvent {
      return {
        id: row.id,
        googleEventId: row.googleEventId,
        etag: row.etag,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
        title: row.title,
        description: row.description,
        location: row.location,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        allDay: row.allDay,
        tz: row.tz,
        rrule: row.rrule,
        rdates: row.rdates,
        exdates: row.exdates,
      };
    }

    it('lets two unpushed local rows coexist with NULL google_event_id', async () => {
      const first = await insertLocalEvent('Lokaal 1');
      const second = await insertLocalEvent('Lokaal 2');

      // The unique index is NULLS DISTINCT: both rows are legal, which is
      // precisely why the push path cannot rely on it for idempotence.
      expect(first.googleEventId).toBeNull();
      expect(second.googleEventId).toBeNull();
    });

    it('claims a deterministic id before inserting, and a retried push creates no duplicate', async () => {
      const row = await insertLocalEvent('Tandarts');
      const expectedId = googleEventIdFor(row.id);

      const api = createFakeApi({
        insertEvent: [
          googleEvent({ id: expectedId, etag: '"etag-1"', updated: '2026-08-05T10:00:00.000Z' }),
        ],
      });

      const first = await pushEvent({
        event: pushable(row),
        calendar: calendarState(),
        api,
        store: store.pushStore,
        emit,
      });

      expect(first).toMatchObject({ outcome: 'inserted', googleEventId: expectedId });

      const [afterFirst] = await db.select().from(schema.event).where(eq(schema.event.id, row.id));
      expect(afterFirst.googleEventId).toBe(expectedId);
      expect(afterFirst.etag).toBe('"etag-1"');

      // The retry: a job re-runs from the *original* (pre-claim) row state,
      // exactly as a pg-boss retry would after a lost response.
      const retryApi = createFakeApi({
        insertEvent: [duplicate()],
        getEvent: [googleEvent({ id: expectedId, etag: '"etag-1"' })],
      });

      const retried = await pushEvent({
        event: pushable(row),
        calendar: calendarState(),
        api: retryApi,
        store: store.pushStore,
        emit,
      });

      expect(retried.googleEventId).toBe(expectedId);
      // One id, one Google event, one local row — no duplicate anywhere.
      expect(retryApi.calls.insertEvent).toHaveLength(1);
      const matching = await db
        .select()
        .from(schema.event)
        .where(
          and(eq(schema.event.calendarId, calendarId), eq(schema.event.googleEventId, expectedId))
        );
      expect(matching).toHaveLength(1);
    });

    it('adopts the id an earlier attempt already claimed rather than minting a second', async () => {
      const row = await insertLocalEvent('Al geclaimd');
      const claimed = await store.pushStore.claimGoogleEventId(row.id, googleEventIdFor(row.id));
      const again = await store.pushStore.claimGoogleEventId(row.id, 'knsomethingelse');

      expect(again).toBe(claimed);
    });
  });
});
