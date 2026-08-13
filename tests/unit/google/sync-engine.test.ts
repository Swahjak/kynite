import { describe, expect, it } from 'vitest';
import { createEchoRegistry } from '@/modules/google/domain/echo';
import { syncCalendar } from '@/modules/google/domain/sync-engine';
import { createFakeApi, gone } from './support/fake-api';
import {
  createCallLog,
  createMemoryStore,
  createRecordingEmitter,
  testCalendar,
} from './support/memory-store';
import {
  custodySeries,
  googleEvent,
  importedSeries,
  statusEntry,
  tombstone,
} from './support/fixtures';

/**
 * The incremental sync contract (docs/architecture.md §5 "Incremental sync",
 * milestone M05). No live API: every branch is driven by a scripted transport.
 */

describe('initial full sync', () => {
  it('paginates, stores every event and keeps the final sync token', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const api = createFakeApi({
      listEvents: [
        { items: [googleEvent({ id: 'a' }), googleEvent({ id: 'b' })], nextPageToken: 'page-2' },
        { items: [googleEvent({ id: 'c' })], nextSyncToken: 'token-1' },
      ],
    });

    const result = await syncCalendar({ calendar: testCalendar, api, store, emit });

    expect(result.mode).toBe('initial');
    expect(result.pages).toBe(2);
    expect(result.upserted).toBe(3);
    expect(store.rows.size).toBe(3);
    expect(store.syncTokens.get(testCalendar.id)?.token).toBe('token-1');
    // The sync token only arrives on the last page; the first request carries none.
    expect(api.calls.listEvents[0]).toMatchObject({ syncToken: null, pageToken: null });
    expect(api.calls.listEvents[1]).toMatchObject({ pageToken: 'page-2' });
  });

  it('emits one event.upserted per event plus a terminal sync.status', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const api = createFakeApi({
      listEvents: [{ items: [googleEvent({ id: 'a' })], nextSyncToken: 'token-1' }],
    });

    await syncCalendar({ calendar: testCalendar, api, store, emit });

    expect(emit.emissions.map((e) => e.type)).toEqual(['event.upserted', 'sync.status']);
    expect(emit.emissions.at(-1)).toMatchObject({ patch: { state: 'ok', mode: 'initial' } });
  });

  it('links an override instance to its series master via recurrenceParentId', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const { master, override } = custodySeries();
    // Google does not guarantee ordering: the override arrives first on purpose.
    const api = createFakeApi({
      listEvents: [{ items: [override, master], nextSyncToken: 'token-1' }],
    });

    await syncCalendar({ calendar: testCalendar, api, store, emit });

    const masterRow = store.byGoogleId(master.id)!;
    const overrideRow = store.byGoogleId(override.id)!;
    expect(overrideRow.recurrenceParentId).toBe(masterRow.id);
    expect(masterRow.mapped.exdates).toEqual(['EXDATE;TZID=Europe/Amsterdam:20260817T090000']);
  });
});

describe('status entries', () => {
  it('never stores a working-location entry', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const api = createFakeApi({
      listEvents: [
        {
          items: [statusEntry('workingLocation', 'wl-1'), googleEvent({ id: 'real' })],
          nextSyncToken: 't',
        },
      ],
    });

    const result = await syncCalendar({ calendar: testCalendar, api, store, emit });

    expect(result.upserted).toBe(1);
    expect(store.byGoogleId('wl-1')).toBeUndefined();
    expect(store.byGoogleId('real')).toBeDefined();
  });

  it('tombstones a status entry stored before the filter existed', async () => {
    // The rows `drizzle/0018` forces back into view by clearing every
    // calendar's sync token: a household that synced last month still has
    // "Working location: Kantoor" on its wall until Google hands it back.
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const seeded = store.seed({
      calendarId: testCalendar.id,
      familyId: testCalendar.familyId,
      googleEventId: 'wl-1',
      etag: '"etag-wl-1"',
    });
    const api = createFakeApi({
      listEvents: [{ items: [statusEntry('workingLocation', 'wl-1')], nextSyncToken: 't' }],
    });

    const result = await syncCalendar({ calendar: testCalendar, api, store, emit });

    expect(result.deleted).toBe(1);
    expect(seeded.deletedAt).toBeInstanceOf(Date);
    expect(emit.emissions[0]).toMatchObject({ type: 'event.deleted', entityId: seeded.id });
  });

  it('keeps a birthday, which is an appointment a family cares about', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const api = createFakeApi({
      listEvents: [{ items: [statusEntry('birthday', 'bday-1')], nextSyncToken: 't' }],
    });

    const result = await syncCalendar({ calendar: testCalendar, api, store, emit });

    expect(result.upserted).toBe(1);
    expect(store.byGoogleId('bday-1')).toBeDefined();
  });
});

describe('imported recurring series', () => {
  it('stores the master once and the override once, with the slot it replaces', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const { master, override } = importedSeries();
    const api = createFakeApi({ listEvents: [{ items: [master, override], nextSyncToken: 't' }] });

    const result = await syncCalendar({ calendar: testCalendar, api, store, emit });

    // Two rows, not four: `singleEvents=false` means Google hands back the
    // series plus its exceptions, never the expanded instances.
    expect(result.upserted).toBe(2);
    expect(store.rows.size).toBe(2);

    const masterRow = store.byGoogleId(master.id)!;
    const overrideRow = store.byGoogleId(override.id)!;
    expect(masterRow.mapped.rrule).toBe('FREQ=WEEKLY;BYDAY=MO');
    expect(overrideRow.recurrenceParentId).toBe(masterRow.id);
    // The master carries no EXDATE — Google does not write one — so this is the
    // only record of the occurrence the child supersedes. Losing it is what
    // rendered every recurring event twice.
    expect(masterRow.mapped.exdates).toEqual([]);
    expect(overrideRow.mapped.recurrenceOriginalStart?.toISOString()).toBe(
      '2026-03-09T07:30:00.000Z'
    );
  });
});

describe('incremental sync', () => {
  it('sends the stored sync token and stores the new one', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const api = createFakeApi({
      listEvents: [
        { items: [googleEvent({ id: 'a', etag: '"etag-2"' })], nextSyncToken: 'token-2' },
      ],
    });

    const result = await syncCalendar({
      calendar: { ...testCalendar, syncToken: 'token-1' },
      api,
      store,
      emit,
    });

    expect(result.mode).toBe('incremental');
    expect(result.resynced).toBe(false);
    expect(api.calls.listEvents[0].syncToken).toBe('token-1');
    expect(store.syncTokens.get(testCalendar.id)?.token).toBe('token-2');
  });
});

describe('410 GONE', () => {
  it('drops the token, emits sync.status and completes a full resync', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const api = createFakeApi({
      listEvents: [gone(), { items: [googleEvent({ id: 'a' })], nextSyncToken: 'token-fresh' }],
    });

    const result = await syncCalendar({
      calendar: { ...testCalendar, syncToken: 'expired' },
      api,
      store,
      emit,
    });

    expect(result.resynced).toBe(true);
    expect(result.mode).toBe('initial');
    // The expired token is cleared *before* the retry, so a crash mid-resync
    // cannot leave a token Google has already rejected.
    expect(emit.emissions[0]).toMatchObject({
      type: 'sync.status',
      patch: { state: 'resyncing', reason: 'sync_token_expired' },
    });
    expect(api.calls.listEvents[1].syncToken).toBeNull();
    expect(store.syncTokens.get(testCalendar.id)?.token).toBe('token-fresh');
  });

  it('clears the sync token before issuing the resync listEvents call (ordering, not just presence)', async () => {
    // B3a (review fix): a vacuous version of this test would only assert that
    // `setSyncToken(calendarId, null, null)` happened *somewhere* — which
    // would still pass if the clear were moved to run after the resync
    // `collect()`. A shared, chronologically-ordered call log across both
    // ports (store + api) is what lets the assertion below tell "before" from
    // "after" and "at all".
    const log = createCallLog();
    const store = createMemoryStore(log);
    const emit = createRecordingEmitter();
    const api = createFakeApi(
      { listEvents: [gone(), { items: [googleEvent({ id: 'a' })], nextSyncToken: 'token-fresh' }] },
      log
    );

    await syncCalendar({ calendar: { ...testCalendar, syncToken: 'expired' }, api, store, emit });

    const clearIndex = log.findIndex(
      (call) =>
        call.name === 'setSyncToken' &&
        call.args[0] === testCalendar.id &&
        call.args[1] === null &&
        call.args[2] === null
    );
    const resyncListEventsIndex = log.findIndex(
      (call) =>
        call.name === 'listEvents' && (call.args[0] as { syncToken: unknown }).syncToken === null
    );

    expect(clearIndex).toBeGreaterThanOrEqual(0);
    expect(resyncListEventsIndex).toBeGreaterThanOrEqual(0);
    expect(clearIndex).toBeLessThan(resyncListEventsIndex);
  });

  it('does not swallow other API failures', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const api = createFakeApi({ listEvents: [new Error('network down')] });

    await expect(syncCalendar({ calendar: testCalendar, api, store, emit })).rejects.toThrow(
      'network down'
    );
  });
});

describe('tombstones', () => {
  it('soft-deletes a cancelled event and broadcasts the deletion', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const seeded = store.seed({
      calendarId: testCalendar.id,
      familyId: testCalendar.familyId,
      googleEventId: 'a',
      etag: '"etag-1"',
    });
    const api = createFakeApi({ listEvents: [{ items: [tombstone('a')], nextSyncToken: 't' }] });

    const result = await syncCalendar({ calendar: testCalendar, api, store, emit });

    expect(result.deleted).toBe(1);
    expect(seeded.deletedAt).toBeInstanceOf(Date);
    expect(seeded.version).toBe(1);
    expect(emit.emissions[0]).toMatchObject({ type: 'event.deleted', entityId: seeded.id });
  });

  it('ignores a tombstone for an event we never had', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const api = createFakeApi({
      listEvents: [{ items: [tombstone('never-seen')], nextSyncToken: 't' }],
    });

    const result = await syncCalendar({ calendar: testCalendar, api, store, emit });

    expect(result.deleted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(emit.emissions.filter((e) => e.type === 'event.deleted')).toHaveLength(0);
  });

  it('does not re-delete (or re-broadcast) an already tombstoned event', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    store.seed({
      calendarId: testCalendar.id,
      familyId: testCalendar.familyId,
      googleEventId: 'a',
      deletedAt: new Date('2026-08-01T00:00:00Z'),
    });
    const api = createFakeApi({ listEvents: [{ items: [tombstone('a')], nextSyncToken: 't' }] });

    const result = await syncCalendar({ calendar: testCalendar, api, store, emit });

    expect(result.deleted).toBe(0);
    expect(emit.emissions.filter((e) => e.type === 'event.deleted')).toHaveLength(0);
  });
});

describe('echo suppression', () => {
  it('skips an event whose etag already matches the stored row', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    store.seed({
      calendarId: testCalendar.id,
      familyId: testCalendar.familyId,
      googleEventId: 'a',
      etag: '"etag-1"',
    });
    const api = createFakeApi({
      listEvents: [{ items: [googleEvent({ id: 'a', etag: '"etag-1"' })], nextSyncToken: 't' }],
    });

    const result = await syncCalendar({ calendar: testCalendar, api, store, emit });

    expect(result.upserted).toBe(0);
    expect(result.skipped).toBe(1);
    expect(emit.emissions.filter((e) => e.type === 'event.upserted')).toHaveLength(0);
  });

  it('skips an etag we ourselves just wrote, before the row is even readable', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const echo = createEchoRegistry();
    // The race §5 guards against: our push response landed, the webhook fired,
    // and the local UPDATE has not been committed yet.
    echo.record('"etag-mine"');
    const api = createFakeApi({
      listEvents: [{ items: [googleEvent({ id: 'a', etag: '"etag-mine"' })], nextSyncToken: 't' }],
    });

    const result = await syncCalendar({ calendar: testCalendar, api, store, emit, echo });

    expect(result.skipped).toBe(1);
    expect(store.rows.size).toBe(0);
    expect(emit.emissions.filter((e) => e.type === 'event.upserted')).toHaveLength(0);
  });

  it('still applies a foreign change to an event we wrote earlier', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const echo = createEchoRegistry();
    echo.record('"etag-mine"');
    store.seed({
      calendarId: testCalendar.id,
      familyId: testCalendar.familyId,
      googleEventId: 'a',
      etag: '"etag-mine"',
    });
    const api = createFakeApi({
      listEvents: [
        { items: [googleEvent({ id: 'a', etag: '"etag-theirs"' })], nextSyncToken: 't' },
      ],
    });

    const result = await syncCalendar({ calendar: testCalendar, api, store, emit, echo });

    expect(result.upserted).toBe(1);
    expect(emit.emissions[0].type).toBe('event.upserted');
  });
});
