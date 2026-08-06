import { GOOGLE_CALENDAR_API } from './config';
import { GoogleApiError } from './domain/errors';
import type {
  GoogleCalendarApi,
  GoogleCalendarListPage,
  GoogleChannel,
  GoogleEventResource,
  GoogleEventWrite,
  GoogleEventsPage,
  ListEventsParams,
  WatchParams,
} from './domain/types';

/**
 * The Google Calendar v3 HTTP client — the single place the network is touched
 * (docs/architecture.md §9: "Google API is the only mocked boundary").
 *
 * `fetch` and the access-token provider are injected, so this file is thin
 * enough to read in one sitting and the engines are tested against the port,
 * not against HTTP.
 */

export type AccessTokenProvider = (options?: { forceRefresh?: boolean }) => Promise<string>;

export type ClientOptions = {
  getAccessToken: AccessTokenProvider;
  fetchImpl?: typeof fetch;
  /** Push-channel TTL in seconds. Google caps `events.watch` at ~7 days. */
  channelTtlSeconds?: number;
};

const DEFAULT_CHANNEL_TTL_SECONDS = 7 * 24 * 60 * 60;
const PAGE_SIZE = 250;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  etag?: string | null;
};

async function toApiError(response: Response): Promise<GoogleApiError> {
  let message = response.statusText || `HTTP ${response.status}`;
  let reason: string | null = null;

  try {
    const payload = (await response.json()) as {
      error?: { message?: string; errors?: { reason?: string }[] };
    };
    if (payload.error?.message) message = payload.error.message;
    reason = payload.error?.errors?.[0]?.reason ?? null;
  } catch {
    // A non-JSON error body (an HTML 502 from a proxy) is still an error.
  }

  return new GoogleApiError(response.status, message, reason);
}

export function createGoogleCalendarApi({
  getAccessToken,
  fetchImpl = fetch,
  channelTtlSeconds = DEFAULT_CHANNEL_TTL_SECONDS,
}: ClientOptions): GoogleCalendarApi {
  async function request<T>(path: string, options: RequestOptions = {}): Promise<T | null> {
    const url = new URL(`${GOOGLE_CALENDAR_API}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    const send = async (accessToken: string): Promise<Response> =>
      fetchImpl(url, {
        method: options.method ?? 'GET',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
          // `*` would defeat the point; only a concrete etag is a precondition.
          ...(options.etag ? { 'if-match': options.etag } : {}),
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });

    let response = await send(await getAccessToken());

    // One forced refresh on 401: the token may have been revoked or rotated
    // out from under a long-running job.
    if (response.status === 401) {
      response = await send(await getAccessToken({ forceRefresh: true }));
    }

    if (!response.ok) throw await toApiError(response);
    if (response.status === 204) return null;

    const text = await response.text();
    return text === '' ? null : (JSON.parse(text) as T);
  }

  const encode = encodeURIComponent;

  return {
    async listCalendars(pageToken) {
      return (
        (await request<GoogleCalendarListPage>('/users/me/calendarList', {
          query: { maxResults: PAGE_SIZE, showHidden: true, pageToken },
        })) ?? { items: [] }
      );
    },

    async listEvents({ calendarId, syncToken, pageToken }: ListEventsParams) {
      return (
        (await request<GoogleEventsPage>(`/calendars/${encode(calendarId)}/events`, {
          query: {
            maxResults: PAGE_SIZE,
            // §5: never expand server-side — that would destroy the custody
            // recurrence model. Tombstones are required for incremental sync.
            singleEvents: false,
            showDeleted: true,
            syncToken,
            pageToken,
          },
        })) ?? { items: [] }
      );
    },

    async getEvent(calendarId, eventId) {
      const resource = await request<GoogleEventResource>(
        `/calendars/${encode(calendarId)}/events/${encode(eventId)}`
      );
      if (!resource) throw new GoogleApiError(404, 'event not found');
      return resource;
    },

    async insertEvent(calendarId, body: GoogleEventWrite) {
      const resource = await request<GoogleEventResource>(
        `/calendars/${encode(calendarId)}/events`,
        { method: 'POST', body }
      );
      if (!resource) throw new GoogleApiError(500, 'insert returned no event');
      return resource;
    },

    async patchEvent(calendarId, eventId, body, etag) {
      const resource = await request<GoogleEventResource>(
        `/calendars/${encode(calendarId)}/events/${encode(eventId)}`,
        { method: 'PATCH', body, etag }
      );
      if (!resource) throw new GoogleApiError(500, 'patch returned no event');
      return resource;
    },

    async deleteEvent(calendarId, eventId, etag) {
      await request<null>(`/calendars/${encode(calendarId)}/events/${encode(eventId)}`, {
        method: 'DELETE',
        etag,
      });
    },

    async watch({ calendarId, channelId, address, token }: WatchParams) {
      const channel = await request<GoogleChannel>(
        `/calendars/${encode(calendarId)}/events/watch`,
        {
          method: 'POST',
          body: {
            id: channelId,
            type: 'web_hook',
            address,
            token,
            params: { ttl: String(channelTtlSeconds) },
          },
        }
      );
      if (!channel) throw new GoogleApiError(500, 'watch returned no channel');
      return channel;
    },

    async stopChannel(channelId, resourceId) {
      // `/channels/stop` is rooted at the API base, not under /calendars.
      await request<null>('/channels/stop', {
        method: 'POST',
        body: { id: channelId, resourceId },
      });
    },
  };
}
