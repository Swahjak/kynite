import { NextResponse } from 'next/server';
import { loadTimerBoard } from '@/modules/timers';

/**
 * The hub's polling endpoint — **the M09 stand-in for SSE**.
 *
 * `useTimerChannel` reads this every two seconds to learn what is running and,
 * just as importantly, what time the *server* thinks it is: the response's
 * `serverNow` is what every device corrects its own clock against. M10
 * replaces the transport with `/api/sse`; this route can then be deleted, or
 * kept as the reconnect fallback, without touching a component.
 *
 * Authorization is `loadTimerBoard()`'s: it resolves the request principal and
 * returns `null` when there is none, so an unauthenticated poll gets a 401 and
 * a cross-family one is impossible — the read is scoped by the principal's own
 * `familyId`, never by anything in the request.
 */
export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  const board = await loadTimerBoard();

  if (!board) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  return NextResponse.json(board, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
