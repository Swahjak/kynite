import { createServer } from 'node:http';

/**
 * A fake Google, at the network boundary (M17).
 *
 * The M17 rule is that Google is the *only* mocked boundary and no internal
 * module is mocked. That rules out `vi.mock`, an injected `GoogleCalendarApi`
 * or a Playwright route interception (which fakes the *browser's* network, not
 * the server's) — the app under test is a Next.js server making its own
 * outbound calls, so the only honest place to stand in for Google is a real
 * HTTP server on the other end of them.
 *
 * So this speaks the paths the app actually requests, against the origin
 * `GOOGLE_API_BASE_URL` points at:
 *
 *   GET  /o/oauth2/v2/auth          → 302 straight back to the app's callback
 *   POST /token                     → access + refresh token
 *   GET  /v1/userinfo               → the consenting identity
 *   GET  /calendar/v3/users/me/calendarList
 *   GET  /calendar/v3/calendars/:id/events
 *   POST /calendar/v3/calendars/:id/events/watch
 *   POST /calendar/v3/channels/stop
 *
 * The consent screen is the one thing it deliberately does not imitate: it
 * redirects immediately with a code, because a spec cannot click Google's UI
 * and the thing under test is what our server does with the code afterwards.
 *
 * Everything else is real: real OAuth form POST, real bearer headers, real
 * pagination and `nextSyncToken` shape, real 401-on-stale-token behaviour.
 */

const PORT = Number(process.env.FAKE_GOOGLE_PORT ?? 3102);

/** The one event every sync-smoke spec expects to find on the family's board. */
const EVENT_TITLE = process.env.FAKE_GOOGLE_EVENT_TITLE ?? 'Tandarts (Google)';

const CALENDAR_ID = 'kynite-e2e@group.calendar.google.com';

/** A fixed day so the spec can pin the board to it. */
const EVENT_DATE = process.env.FAKE_GOOGLE_EVENT_DATE ?? '2026-03-11';

function json(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', `http://127.0.0.1:${PORT}`);
  const path = url.pathname;

  // --- OAuth ---------------------------------------------------------------

  if (path === '/o/oauth2/v2/auth') {
    const redirectUri = url.searchParams.get('redirect_uri');
    const state = url.searchParams.get('state') ?? '';
    if (!redirectUri) return json(response, 400, { error: 'invalid_request' });
    const back = new URL(redirectUri);
    back.searchParams.set('code', 'fake-authorization-code');
    back.searchParams.set('state', state);
    back.searchParams.set('scope', url.searchParams.get('scope') ?? '');
    response.writeHead(302, { location: back.toString() });
    return response.end();
  }

  if (path === '/token' && request.method === 'POST') {
    // The body is read and discarded on purpose: asserting on the grant type
    // here would duplicate `tests/unit/google` and make this server a second
    // place to keep in step with the client.
    request.resume();
    return json(response, 200, {
      access_token: 'fake-access-token',
      refresh_token: 'fake-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'openid email profile https://www.googleapis.com/auth/calendar',
    });
  }

  if (path === '/v1/userinfo') {
    if (!(request.headers.authorization ?? '').startsWith('Bearer ')) {
      return json(response, 401, { error: 'unauthorized' });
    }
    return json(response, 200, {
      sub: 'fake-google-user-id',
      email: 'ouder@example.test',
      name: 'Sanne',
    });
  }

  // --- Calendar v3 ---------------------------------------------------------

  if (!path.startsWith('/calendar/v3/')) {
    return json(response, 404, { error: { code: 404, message: 'not found' } });
  }

  if (!(request.headers.authorization ?? '').startsWith('Bearer ')) {
    return json(response, 401, { error: { code: 401, message: 'unauthorized' } });
  }

  if (path === '/calendar/v3/users/me/calendarList') {
    return json(response, 200, {
      items: [
        {
          id: CALENDAR_ID,
          summary: 'Gezinsagenda (Google)',
          backgroundColor: '#5d5fef',
          accessRole: 'owner',
          primary: true,
          timeZone: 'Europe/Amsterdam',
        },
      ],
    });
  }

  const eventsMatch = /^\/calendar\/v3\/calendars\/([^/]+)\/events$/.exec(path);
  if (eventsMatch) {
    return json(response, 200, {
      items: [
        {
          id: 'fake-google-event-1',
          status: 'confirmed',
          summary: EVENT_TITLE,
          location: 'Dorpsstraat 1',
          etag: '"fake-etag-1"',
          updated: `${EVENT_DATE}T08:00:00.000Z`,
          start: { dateTime: `${EVENT_DATE}T14:00:00+01:00`, timeZone: 'Europe/Amsterdam' },
          end: { dateTime: `${EVENT_DATE}T15:00:00+01:00`, timeZone: 'Europe/Amsterdam' },
        },
      ],
      nextSyncToken: 'fake-sync-token-1',
    });
  }

  if (/^\/calendar\/v3\/calendars\/[^/]+\/events\/watch$/.test(path)) {
    request.resume();
    return json(response, 200, {
      kind: 'api#channel',
      id: 'fake-channel-id',
      resourceId: 'fake-resource-id',
      expiration: String(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
  }

  if (path === '/calendar/v3/channels/stop') {
    request.resume();
    response.writeHead(204);
    return response.end();
  }

  return json(response, 404, { error: { code: 404, message: 'not found' } });
});

server.listen(PORT, '127.0.0.1', () => {
  // Playwright's `webServer` waits for this port to accept connections.
  console.log(`[fake-google] listening on http://127.0.0.1:${PORT}`);
});
