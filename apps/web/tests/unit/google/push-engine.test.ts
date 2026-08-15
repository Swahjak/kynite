import { describe, expect, it } from 'vitest';
import { createEchoRegistry } from '@/modules/google/domain/echo';
import { GoogleApiError } from '@/modules/google/domain/errors';
import { googleEventIdFor } from '@/modules/google/domain/ids';
import { pushEvent, type PushableEvent } from '@/modules/google/domain/push-engine';
import { createFakeApi, duplicate, preconditionFailed } from './support/fake-api';
import { createMemoryStore, createRecordingEmitter, testCalendar } from './support/memory-store';
import { googleEvent } from './support/fixtures';

/**
 * The two-way write path (docs/architecture.md §5 "Write path (2-way)",
 * milestone M05): `If-Match` on every mutation, `412` → last-write-wins by
 * `updated` with ties to Google, and an insert that cannot duplicate.
 */

function pushable(overrides: Partial<PushableEvent> = {}): PushableEvent {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    googleEventId: null,
    etag: null,
    updatedAt: new Date('2026-08-02T12:00:00Z'),
    deletedAt: null,
    title: 'Tandarts Fenna',
    description: null,
    location: null,
    startsAt: new Date('2026-08-05T08:00:00Z'),
    endsAt: new Date('2026-08-05T09:00:00Z'),
    allDay: false,
    tz: 'Europe/Amsterdam',
    rrule: null,
    rdates: [],
    exdates: [],
    ...overrides,
  };
}

/** Seeds the memory store with a row the push engine can claim against. */
function seedLocal(store: ReturnType<typeof createMemoryStore>, event: PushableEvent) {
  const row = store.seed({
    calendarId: testCalendar.id,
    familyId: testCalendar.familyId,
    googleEventId: event.googleEventId,
    etag: event.etag,
    updatedAt: event.updatedAt,
  });
  store.rows.delete(row.id);
  row.id = event.id;
  store.rows.set(event.id, row);
  return row;
}

describe('insert', () => {
  it('claims a caller-assigned id before the call, so a retry cannot duplicate', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const event = pushable();
    const row = seedLocal(store, event);
    const expectedId = googleEventIdFor(event.id);

    const api = createFakeApi({
      insertEvent: [
        googleEvent({ id: expectedId, etag: '"etag-new"', updated: '2026-08-02T12:00:01.000Z' }),
      ],
    });

    const result = await pushEvent({ event, calendar: testCalendar, api, store, emit });

    expect(api.calls.insertEvent[0].body.id).toBe(expectedId);
    expect(result).toMatchObject({ outcome: 'inserted', googleEventId: expectedId });
    expect(row.googleEventId).toBe(expectedId);
    expect(row.etag).toBe('"etag-new"');
  });

  it('treats a 409 on our own id as the earlier attempt having landed', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const event = pushable();
    seedLocal(store, event);
    const expectedId = googleEventIdFor(event.id);

    const api = createFakeApi({
      insertEvent: [duplicate()],
      getEvent: [googleEvent({ id: expectedId, etag: '"etag-existing"' })],
    });

    const result = await pushEvent({ event, calendar: testCalendar, api, store, emit });

    expect(result.outcome).toBe('inserted');
    expect(result.etag).toBe('"etag-existing"');
    // Exactly one insert attempt, and no second event created.
    expect(api.calls.insertEvent).toHaveLength(1);
    expect(api.calls.getEvent).toHaveLength(1);
  });

  it('records the returned etag as our own so the webhook echo is suppressed', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const echo = createEchoRegistry();
    const event = pushable();
    seedLocal(store, event);

    const api = createFakeApi({
      insertEvent: [googleEvent({ id: googleEventIdFor(event.id), etag: '"etag-ours"' })],
    });

    await pushEvent({ event, calendar: testCalendar, api, store, emit, echo });

    expect(echo.isOwn('"etag-ours"')).toBe(true);
    // Our own write is never re-broadcast (§5 echo suppression).
    expect(emit.emissions).toHaveLength(0);
  });
});

describe('update', () => {
  it('patches with If-Match and stores the new etag', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const event = pushable({ googleEventId: 'kn-existing', etag: '"etag-1"' });
    const row = seedLocal(store, event);

    const api = createFakeApi({
      patchEvent: [googleEvent({ id: 'kn-existing', etag: '"etag-2"' })],
    });

    const result = await pushEvent({ event, calendar: testCalendar, api, store, emit });

    expect(api.calls.patchEvent[0].etag).toBe('"etag-1"');
    expect(result.outcome).toBe('updated');
    expect(row.etag).toBe('"etag-2"');
  });

  it('recreates an event that was deleted remotely mid-edit', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const event = pushable({ googleEventId: 'kn-existing', etag: '"etag-1"' });
    seedLocal(store, event);

    const api = createFakeApi({
      patchEvent: [new GoogleApiError(404, 'Not Found')],
      insertEvent: [googleEvent({ id: 'kn-existing', etag: '"etag-3"' })],
    });

    const result = await pushEvent({ event, calendar: testCalendar, api, store, emit });

    expect(result.outcome).toBe('inserted');
    expect(api.calls.insertEvent[0].body.id).toBe('kn-existing');
  });

  it('N11: adopts on a 409 re-insert after a 404, the same way a plain insert adopts a duplicate', async () => {
    // Same race as "treats a 409 on our own id as the earlier attempt having
    // landed" above, but reached through the 404-recreate branch: the patch
    // 404s (deleted remotely mid-edit), the recreate races an earlier retry's
    // recreate and gets a 409, and this must adopt — not throw — because the
    // id is ours by construction either way.
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const event = pushable({ googleEventId: 'kn-existing', etag: '"etag-1"' });
    seedLocal(store, event);

    const api = createFakeApi({
      patchEvent: [new GoogleApiError(404, 'Not Found')],
      insertEvent: [duplicate()],
      getEvent: [googleEvent({ id: 'kn-existing', etag: '"etag-recreated"' })],
    });

    const result = await pushEvent({ event, calendar: testCalendar, api, store, emit });

    expect(result).toMatchObject({ outcome: 'inserted', googleEventId: 'kn-existing' });
    expect(result.etag).toBe('"etag-recreated"');
    expect(api.calls.insertEvent).toHaveLength(1);
    expect(api.calls.getEvent).toHaveLength(1);
  });
});

describe('412 → last-write-wins', () => {
  const localEvent = pushable({
    googleEventId: 'kn-existing',
    etag: '"stale"',
    updatedAt: new Date('2026-08-02T12:00:00Z'),
  });

  it('keeps our write when we are newer, retrying against the fresh etag', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const event = { ...localEvent };
    const row = seedLocal(store, event);

    const api = createFakeApi({
      patchEvent: [preconditionFailed(), googleEvent({ id: 'kn-existing', etag: '"etag-final"' })],
      getEvent: [
        googleEvent({
          id: 'kn-existing',
          etag: '"etag-remote"',
          // Older than our local write.
          updated: '2026-08-02T11:00:00.000Z',
        }),
      ],
    });

    const result = await pushEvent({ event, calendar: testCalendar, api, store, emit });

    expect(result.outcome).toBe('updated');
    expect(api.calls.patchEvent[1].etag).toBe('"etag-remote"');
    expect(row.etag).toBe('"etag-final"');
    expect(emit.emissions).toHaveLength(0);
  });

  it('takes the remote copy when Google is newer', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const event = { ...localEvent };
    const row = seedLocal(store, event);

    const api = createFakeApi({
      patchEvent: [preconditionFailed()],
      getEvent: [
        googleEvent({
          id: 'kn-existing',
          summary: 'Verzet door mama',
          etag: '"etag-remote"',
          updated: '2026-08-02T13:00:00.000Z',
        }),
      ],
    });

    const result = await pushEvent({ event, calendar: testCalendar, api, store, emit });

    expect(result.outcome).toBe('remote-wins');
    expect(row.mapped.title).toBe('Verzet door mama');
    // A remote win *is* news for every other device, so it is broadcast.
    expect(emit.emissions).toEqual([
      expect.objectContaining({ type: 'event.upserted', entityId: row.id }),
    ]);
    // Only one patch attempt: we lost, so we do not force our version through.
    expect(api.calls.patchEvent).toHaveLength(1);
  });

  it('breaks an exact tie toward Google', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const event = { ...localEvent };
    const row = seedLocal(store, event);

    const api = createFakeApi({
      patchEvent: [preconditionFailed()],
      getEvent: [
        googleEvent({
          id: 'kn-existing',
          summary: 'Gelijktijdige bewerking',
          etag: '"etag-remote"',
          // Exactly our local `updatedAt`.
          updated: '2026-08-02T12:00:00.000Z',
        }),
      ],
    });

    const result = await pushEvent({ event, calendar: testCalendar, api, store, emit });

    expect(result.outcome).toBe('remote-wins');
    expect(row.mapped.title).toBe('Gelijktijdige bewerking');
  });
});

describe('delete', () => {
  it('deletes with If-Match and clears the etag', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const event = pushable({
      googleEventId: 'kn-existing',
      etag: '"etag-1"',
      deletedAt: new Date('2026-08-03T10:00:00Z'),
    });
    const row = seedLocal(store, event);

    const api = createFakeApi({ deleteEvent: [null] });

    const result = await pushEvent({ event, calendar: testCalendar, api, store, emit });

    expect(api.calls.deleteEvent[0]).toMatchObject({ eventId: 'kn-existing', etag: '"etag-1"' });
    expect(result.outcome).toBe('deleted');
    expect(row.etag).toBeNull();
  });

  it('is a no-op for a local event that never reached Google', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const event = pushable({ deletedAt: new Date() });
    seedLocal(store, event);

    const api = createFakeApi();
    const result = await pushEvent({ event, calendar: testCalendar, api, store, emit });

    expect(result.outcome).toBe('noop');
    expect(api.calls.deleteEvent).toHaveLength(0);
  });

  it('accepts an already-deleted remote event as success', async () => {
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const event = pushable({
      googleEventId: 'kn-existing',
      etag: '"etag-1"',
      deletedAt: new Date(),
    });
    seedLocal(store, event);

    const api = createFakeApi({
      deleteEvent: [new GoogleApiError(410, 'Resource has been deleted')],
    });

    const result = await pushEvent({ event, calendar: testCalendar, api, store, emit });

    expect(result.outcome).toBe('deleted');
  });

  it('N12: does not record the pre-delete etag as an echo — deletion suppression runs on the tombstone marker, not etag matching', async () => {
    // Google's cancellation notification carries no etag to match against,
    // and the pre-delete etag no longer identifies anything once the event
    // is gone — recording it would be dead weight at best. Idempotency for a
    // redelivered/duplicate tombstone comes from `store.tombstone`'s
    // `deletedAt IS NOT NULL` guard instead (see
    // tests/integration/google-sync.test.ts).
    const store = createMemoryStore();
    const emit = createRecordingEmitter();
    const echo = createEchoRegistry();
    const event = pushable({
      googleEventId: 'kn-existing',
      etag: '"etag-before-delete"',
      deletedAt: new Date('2026-08-03T10:00:00Z'),
    });
    seedLocal(store, event);

    const api = createFakeApi({ deleteEvent: [null] });

    await pushEvent({ event, calendar: testCalendar, api, store, emit, echo });

    expect(echo.isOwn('"etag-before-delete"')).toBe(false);
    expect(echo.size).toBe(0);
  });
});
