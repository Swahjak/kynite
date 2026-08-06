import { GoogleApiError } from '@/modules/google/domain/errors';
import type {
  GoogleCalendarApi,
  GoogleCalendarListPage,
  GoogleChannel,
  GoogleEventResource,
  GoogleEventWrite,
  GoogleEventsPage,
  ListEventsParams,
} from '@/modules/google/domain/types';
import type { CallLog } from './memory-store';

/**
 * A scripted stand-in for the Google Calendar API — the only boundary the
 * suite mocks (docs/architecture.md §9). Responses are queued per method, so a
 * test reads as the conversation it is asserting: "first page, then a page with
 * a sync token", "a 412, then the refetched resource".
 */

export type ListEventsCall = ListEventsParams;

export type FakeApiScript = {
  listEvents?: (GoogleEventsPage | Error)[];
  listCalendars?: (GoogleCalendarListPage | Error)[];
  getEvent?: (GoogleEventResource | Error)[];
  insertEvent?: (GoogleEventResource | Error)[];
  patchEvent?: (GoogleEventResource | Error)[];
  deleteEvent?: (null | Error)[];
  watch?: (GoogleChannel | Error)[];
};

export type FakeApi = GoogleCalendarApi & {
  calls: {
    listEvents: ListEventsCall[];
    listCalendars: (string | null | undefined)[];
    getEvent: { calendarId: string; eventId: string }[];
    insertEvent: { calendarId: string; body: GoogleEventWrite }[];
    patchEvent: {
      calendarId: string;
      eventId: string;
      body: GoogleEventWrite;
      etag: string | null | undefined;
    }[];
    deleteEvent: { calendarId: string; eventId: string; etag: string | null | undefined }[];
    watch: { calendarId: string; channelId: string; token: string }[];
    stopChannel: { channelId: string; resourceId: string }[];
  };
};

function next<T>(queue: (T | Error)[] | undefined, method: string): T {
  if (!queue || queue.length === 0) {
    throw new Error(`fake api: no scripted response left for ${method}()`);
  }
  const value = queue.shift()!;
  if (value instanceof Error) throw value;
  return value;
}

export function gone(): GoogleApiError {
  return new GoogleApiError(410, 'Sync token is no longer valid', 'fullSyncRequired');
}

export function preconditionFailed(): GoogleApiError {
  return new GoogleApiError(412, 'Precondition Failed', 'conditionNotMet');
}

export function duplicate(): GoogleApiError {
  return new GoogleApiError(409, 'The requested identifier already exists', 'duplicate');
}

/**
 * `log`: pass the same `CallLog` array given to `createMemoryStore(log)` to
 * interleave api and store calls in one true chronological order — see
 * `memory-store.ts` for why a shared array is sound here.
 */
export function createFakeApi(script: FakeApiScript = {}, log: CallLog = []): FakeApi {
  const queues: FakeApiScript = {
    listEvents: [...(script.listEvents ?? [])],
    listCalendars: [...(script.listCalendars ?? [])],
    getEvent: [...(script.getEvent ?? [])],
    insertEvent: [...(script.insertEvent ?? [])],
    patchEvent: [...(script.patchEvent ?? [])],
    deleteEvent: [...(script.deleteEvent ?? [])],
    watch: [...(script.watch ?? [])],
  };

  const calls: FakeApi['calls'] = {
    listEvents: [],
    listCalendars: [],
    getEvent: [],
    insertEvent: [],
    patchEvent: [],
    deleteEvent: [],
    watch: [],
    stopChannel: [],
  };

  return {
    calls,

    async listCalendars(pageToken) {
      calls.listCalendars.push(pageToken);
      return next(queues.listCalendars, 'listCalendars');
    },

    async listEvents(params) {
      calls.listEvents.push({ ...params });
      log.push({ name: 'listEvents', args: [{ ...params }] });
      return next(queues.listEvents, 'listEvents');
    },

    async getEvent(calendarId, eventId) {
      calls.getEvent.push({ calendarId, eventId });
      return next(queues.getEvent, 'getEvent');
    },

    async insertEvent(calendarId, body) {
      calls.insertEvent.push({ calendarId, body });
      return next(queues.insertEvent, 'insertEvent');
    },

    async patchEvent(calendarId, eventId, body, etag) {
      calls.patchEvent.push({ calendarId, eventId, body, etag });
      return next(queues.patchEvent, 'patchEvent');
    },

    async deleteEvent(calendarId, eventId, etag) {
      calls.deleteEvent.push({ calendarId, eventId, etag });
      next(queues.deleteEvent, 'deleteEvent');
    },

    async watch({ calendarId, channelId, token }) {
      calls.watch.push({ calendarId, channelId, token });
      return next(queues.watch, 'watch');
    },

    async stopChannel(channelId, resourceId) {
      calls.stopChannel.push({ channelId, resourceId });
    },
  };
}
