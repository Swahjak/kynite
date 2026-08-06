import { randomUUID } from 'node:crypto';
import type { PushStore } from '@/modules/google/domain/push-engine';
import type {
  CalendarSyncState,
  Emitter,
  MappedEvent,
  StoredEvent,
  SyncEmission,
  SyncStore,
} from '@/modules/google/domain/types';

/**
 * In-memory doubles for the two persistence ports.
 *
 * Not a mock of *our* modules (docs/architecture.md §9 forbids that): the
 * engines are exercised for real, against a store that behaves like the
 * drizzle one — including the two behaviours the invariants depend on,
 * `version` bumping on every write and a tombstone being a no-op the second
 * time.
 */

export type MemoryRow = StoredEvent & {
  calendarId: string;
  familyId: string;
  mapped: MappedEvent;
  recurrenceParentId: string | null;
};

/** One entry per port call, in the exact order it happened — see `CallLog` below. */
export type LoggedCall = { name: string; args: unknown[] };

/**
 * Shared, chronologically-ordered log of port calls (docs/architecture.md §9:
 * "no mocking our own modules" — this instruments the real fakes instead).
 *
 * A single array passed to both `createMemoryStore(log)` and
 * `createFakeApi(script, log)` interleaves calls from *both* ports in true
 * call order, because the engine `await`s each call before making the next —
 * so a shared array is a faithful ordering, not just a per-port one. This is
 * what lets a test prove a call on the store happened-before a call on the
 * api (e.g. `setSyncToken` clearing the token before the resync `listEvents`).
 */
export type CallLog = LoggedCall[];

export function createCallLog(): CallLog {
  return [];
}

export type MemoryStore = SyncStore &
  PushStore & {
    rows: Map<string, MemoryRow>;
    syncTokens: Map<string, { token: string | null; syncedAt: Date | null }>;
    /** Seed a row as if a previous sync had written it. */
    seed(row: {
      calendarId: string;
      familyId: string;
      googleEventId: string | null;
      etag?: string | null;
      updatedAtRemote?: Date | null;
      updatedAt?: Date;
      deletedAt?: Date | null;
    }): MemoryRow;
    byGoogleId(googleEventId: string): MemoryRow | undefined;
  };

const emptyMapped = (googleEventId: string): MappedEvent => ({
  googleEventId,
  title: 'seeded',
  description: null,
  location: null,
  startsAt: new Date(0),
  endsAt: new Date(0),
  allDay: false,
  tz: 'Europe/Amsterdam',
  rrule: null,
  rdates: [],
  exdates: [],
  recurringEventId: null,
  etag: null,
  updatedAtRemote: null,
});

export function createMemoryStore(log: CallLog = []): MemoryStore {
  const rows = new Map<string, MemoryRow>();
  const syncTokens = new Map<string, { token: string | null; syncedAt: Date | null }>();
  const record = (name: string, ...args: unknown[]): void => {
    log.push({ name, args });
  };

  const findRow = (calendarId: string, googleEventId: string): MemoryRow | undefined =>
    [...rows.values()].find(
      (row) => row.calendarId === calendarId && row.googleEventId === googleEventId
    );

  const store: MemoryStore = {
    rows,
    syncTokens,

    seed(input) {
      const row: MemoryRow = {
        id: randomUUID(),
        calendarId: input.calendarId,
        familyId: input.familyId,
        googleEventId: input.googleEventId,
        etag: input.etag ?? null,
        updatedAtRemote: input.updatedAtRemote ?? null,
        updatedAt: input.updatedAt ?? new Date(0),
        version: 0,
        deletedAt: input.deletedAt ?? null,
        mapped: emptyMapped(input.googleEventId ?? ''),
        recurrenceParentId: null,
      };
      rows.set(row.id, row);
      return row;
    },

    byGoogleId(googleEventId) {
      return [...rows.values()].find((row) => row.googleEventId === googleEventId);
    },

    async findByGoogleIds(calendarId, googleEventIds) {
      record('findByGoogleIds', calendarId, googleEventIds);
      const found = new Map<string, StoredEvent>();
      for (const googleEventId of googleEventIds) {
        const row = findRow(calendarId, googleEventId);
        if (row) found.set(googleEventId, row);
      }
      return found;
    },

    async upsertEvent(calendar, input, recurrenceParentId) {
      record('upsertEvent', calendar.id, input.googleEventId, recurrenceParentId);
      const existing = findRow(calendar.id, input.googleEventId);

      if (existing) {
        existing.mapped = input;
        existing.etag = input.etag;
        existing.updatedAtRemote = input.updatedAtRemote;
        existing.deletedAt = null;
        existing.version += 1;
        existing.recurrenceParentId = recurrenceParentId ?? existing.recurrenceParentId;
        return { id: existing.id, version: existing.version };
      }

      const row: MemoryRow = {
        id: randomUUID(),
        calendarId: calendar.id,
        familyId: calendar.familyId,
        googleEventId: input.googleEventId,
        etag: input.etag,
        updatedAtRemote: input.updatedAtRemote,
        updatedAt: new Date(),
        version: 0,
        deletedAt: null,
        mapped: input,
        recurrenceParentId,
      };
      rows.set(row.id, row);
      return { id: row.id, version: row.version };
    },

    async tombstone(calendar, googleEventId, at) {
      record('tombstone', calendar.id, googleEventId, at);
      const row = findRow(calendar.id, googleEventId);
      // Unknown, or already tombstoned: nothing changed, nothing to broadcast.
      if (!row || row.deletedAt) return null;

      row.deletedAt = at;
      row.version += 1;
      return { id: row.id, version: row.version };
    },

    async setSyncToken(calendarId, token, syncedAt) {
      record('setSyncToken', calendarId, token, syncedAt);
      syncTokens.set(calendarId, { token, syncedAt });
    },

    async claimGoogleEventId(eventId, googleEventId) {
      record('claimGoogleEventId', eventId, googleEventId);
      const row = rows.get(eventId);
      if (!row) throw new Error(`memory store: no row ${eventId}`);
      row.googleEventId ??= googleEventId;
      return row.googleEventId;
    },

    async recordPush(eventId, patch) {
      record('recordPush', eventId, patch);
      const row = rows.get(eventId);
      if (!row) throw new Error(`memory store: no row ${eventId}`);
      if (patch.googleEventId) row.googleEventId = patch.googleEventId;
      row.etag = patch.etag;
      row.updatedAtRemote = patch.updatedAtRemote;
    },

    async applyRemote(calendar, input) {
      record('applyRemote', calendar.id, input.googleEventId);
      return store.upsertEvent(calendar, input, null);
    },
  };

  return store;
}

export type RecordingEmitter = Emitter & { emissions: SyncEmission[] };

export function createRecordingEmitter(): RecordingEmitter {
  const emissions: SyncEmission[] = [];
  const emit = ((emission: SyncEmission) => {
    emissions.push(emission);
  }) as RecordingEmitter;
  emit.emissions = emissions;
  return emit;
}

export const testCalendar: CalendarSyncState = {
  id: '11111111-1111-4111-8111-111111111111',
  familyId: '22222222-2222-4222-8222-222222222222',
  googleCalendarId: 'family@group.calendar.google.com',
  syncToken: null,
};
