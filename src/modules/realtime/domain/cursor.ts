/**
 * The reconnect cursor and the resync decision (docs/architecture.md §4
 * "Catch-up: `event_log` + cursor").
 *
 * Pure on purpose: everything here is arithmetic over three numbers the SSE
 * route reads from the database, so the "when does a client have to give up
 * and refetch" rule is testable without a connection, a stream or a clock.
 *
 * `event_log.id` is a `bigserial`, so the cursor is a `bigint` end to end. It
 * crosses the wire as a decimal string (the SSE `id:` line and the
 * `Last-Event-ID` header are both text) and is never widened to `number`: a
 * family that ever passes 2^53 events would silently start replaying the wrong
 * rows, and "silently" is the part that matters.
 */

/**
 * The replay ceiling. Beyond this a reconnecting client is cheaper to reload
 * than to catch up — §4: "a cold hub after a week offline should just reload".
 */
export const MAX_REPLAY_ROWS = 500;

/** §4 retention: the nightly trim keeps seven days of log. */
export const RETENTION_DAYS = 7;

/**
 * A `Last-Event-ID` header (or its `?lastEventId=` fallback for callers that
 * cannot set headers) as a cursor.
 *
 * Anything that is not a non-negative decimal integer is `null` — "start
 * live", not an error. A garbage cursor from a stale client must degrade to a
 * fresh stream, never to a 400 that leaves a hub dark.
 */
/** `event_log.id` is `bigserial` — a Postgres `int8`, capped at 2^63 - 1. */
const INT8_MAX = 2n ** 63n - 1n;

export function parseCursor(raw: string | null | undefined): bigint | null {
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if (!/^\d{1,19}$/.test(trimmed)) return null;

  try {
    const value = BigInt(trimmed);
    // Above int8 range: no real cursor is ever this large, and passing it
    // through would 22003 the query instead of degrading to a fresh stream.
    if (value > INT8_MAX) return null;
    return value;
  } catch {
    return null;
  }
}

export type ReplayDecision =
  /** No cursor: attach live, replay nothing. */
  | { kind: 'live' }
  /** Replay `id > cursor`, in order. */
  | { kind: 'replay'; cursor: bigint }
  /**
   * The gap cannot be replayed. `retention` = rows the client missed have been
   * trimmed away; `gap` = more than `MAX_REPLAY_ROWS` are still there but
   * replaying them is worse than a refetch.
   */
  | { kind: 'resync'; reason: 'retention' | 'gap' };

/**
 * Decide what a reconnecting client gets.
 *
 * `oldestRetainedId` is the smallest `event_log.id` still stored for the
 * family; `pending` is how many rows sit after the cursor (the caller counts at
 * most `MAX_REPLAY_ROWS + 1`, so this stays a bounded query).
 *
 * Retention is checked *first* and by id, not by timestamp: if the row right
 * after the cursor is gone, the client has a hole it cannot know the shape of,
 * and no amount of replaying what survived would close it. `cursor + 1n <
 * oldestRetainedId` is exactly "at least one row between us was trimmed".
 *
 * An empty log (`oldestRetainedId === null`) is not a retention failure: a
 * family whose log was trimmed to nothing has nothing to tell the client, and
 * a resync there would be a full refetch for zero news.
 */
export function decideReplay(input: {
  cursor: bigint | null;
  pending: number;
  oldestRetainedId: bigint | null;
}): ReplayDecision {
  const { cursor, pending, oldestRetainedId } = input;

  if (cursor === null) return { kind: 'live' };

  if (oldestRetainedId !== null && cursor + 1n < oldestRetainedId) {
    return { kind: 'resync', reason: 'retention' };
  }

  if (pending > MAX_REPLAY_ROWS) return { kind: 'resync', reason: 'gap' };

  return { kind: 'replay', cursor };
}
