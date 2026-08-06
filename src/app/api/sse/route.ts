import type { NextRequest } from 'next/server';
import { getPrincipal } from '@/modules/family';
import {
  SSE_HEADERS,
  StreamCapExceededError,
  openFamilyStream,
  parseCursor,
} from '@/modules/realtime';

/**
 * `GET /api/sse` — the family's realtime stream (docs/architecture.md §4).
 *
 * **Authorization is the family scope.** The principal is resolved from the
 * session, and the stream is opened for *that* principal's `familyId`. There
 * is no family id in the URL, the header or the body, so there is nothing a
 * client could forge to listen to another household: cross-family leakage is
 * not filtered out here, it is unrepresentable.
 *
 * The cursor comes from `Last-Event-ID`, which EventSource sets by itself on
 * every reconnect. `?lastEventId=` is the fallback for callers that cannot set
 * a header (a test harness, a native shell); a malformed value in either is
 * treated as "no cursor" rather than as an error — a hub must never sit blank
 * because it sent a stale id.
 */

// A stream is the opposite of a cached response; nothing here may be
// prerendered or reused between requests.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** Never let the platform's function timeout cut a long-lived stream short. */
export const maxDuration = 3600;

export async function GET(request: NextRequest): Promise<Response> {
  const principal = await getPrincipal();

  if (!principal) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const cursor =
    parseCursor(request.headers.get('last-event-id')) ??
    parseCursor(new URL(request.url).searchParams.get('lastEventId'));

  try {
    const stream = await openFamilyStream({
      familyId: principal.familyId,
      cursor,
      signal: request.signal,
    });

    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    if (error instanceof StreamCapExceededError) {
      // The 21st stream is refused rather than swapping out a live wall
      // display (`MAX_STREAMS_PER_FAMILY`). `Retry-After` makes the refusal
      // actionable instead of a dead end.
      return Response.json(
        { error: 'too_many_streams' },
        { status: 429, headers: { 'Retry-After': '5', 'Cache-Control': 'no-store' } }
      );
    }
    throw error;
  }
}
