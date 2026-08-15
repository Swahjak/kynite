import { describe, expect, it } from 'vitest';
import { MAX_REPLAY_ROWS, decideReplay, parseCursor } from '@/modules/realtime/domain/cursor';

/**
 * The reconnect rule (docs/architecture.md §4 "Reconnect flow"), as arithmetic.
 *
 * Every branch here decides whether a device that was away gets its history
 * replayed or gets told to reload — which is the difference between a hub that
 * quietly catches up and one that flashes.
 */

describe('parseCursor', () => {
  it('reads a decimal Last-Event-ID as a bigint', () => {
    expect(parseCursor('42')).toBe(42n);
    expect(parseCursor('  7  ')).toBe(7n);
    expect(parseCursor('0')).toBe(0n);
  });

  it('keeps full precision past Number.MAX_SAFE_INTEGER', () => {
    // The one reason this is a bigint. As a number, this id would round to
    // ...992 and replay the wrong rows without any error anywhere.
    const beyondDouble = '9007199254740993';
    expect(parseCursor(beyondDouble)).toBe(9007199254740993n);
    expect(String(parseCursor(beyondDouble))).toBe(beyondDouble);
  });

  it('treats anything else as "no cursor" rather than as an error', () => {
    // A stale or hostile client must degrade to a fresh stream. A 400 here
    // would leave a wall display blank until someone reloads it by hand.
    for (const raw of ['', 'abc', '-1', '1.5', '12e3', '1; DROP TABLE', null, undefined]) {
      expect(parseCursor(raw)).toBeNull();
    }
  });

  it('accepts the maximum int8 — the largest id Postgres could ever hand back', () => {
    expect(parseCursor('9223372036854775807')).toBe(9223372036854775807n);
  });

  it('rejects one past the maximum int8 as "no cursor", not a query that 22003s', () => {
    // `event_log.id` is `bigserial`; a cursor above int8 range would crash the
    // replay query instead of degrading to a fresh stream.
    expect(parseCursor('9223372036854775808')).toBeNull();
  });

  it('rejects 19 nines — inside the regex, outside int8', () => {
    expect(parseCursor('9999999999999999999')).toBeNull();
  });
});

describe('decideReplay', () => {
  it('attaches live when the client has no cursor', () => {
    expect(decideReplay({ cursor: null, pending: 0, oldestRetainedId: 1n })).toEqual({
      kind: 'live',
    });
  });

  it('replays the gap when it is inside the ceiling', () => {
    expect(decideReplay({ cursor: 10n, pending: MAX_REPLAY_ROWS, oldestRetainedId: 1n })).toEqual({
      kind: 'replay',
      cursor: 10n,
    });
  });

  it('resyncs one row past the ceiling — the boundary, not near it', () => {
    expect(
      decideReplay({ cursor: 10n, pending: MAX_REPLAY_ROWS + 1, oldestRetainedId: 1n })
    ).toEqual({ kind: 'resync', reason: 'gap' });
  });

  it('resyncs when retention trimmed rows the client never saw', () => {
    // The client stopped at 5; the oldest surviving row is 9, so 6..8 are gone
    // and no replay can describe them.
    expect(decideReplay({ cursor: 5n, pending: 3, oldestRetainedId: 9n })).toEqual({
      kind: 'resync',
      reason: 'retention',
    });
  });

  it('does not resync when the cursor sits exactly on the retention edge', () => {
    // Oldest retained is 6 and the client saw 5: nothing between them was lost.
    expect(decideReplay({ cursor: 5n, pending: 1, oldestRetainedId: 6n })).toEqual({
      kind: 'replay',
      cursor: 5n,
    });
  });

  it('does not call an empty log a retention failure', () => {
    // A family whose log was trimmed to nothing has no news; forcing a full
    // refetch there would cost a page load to learn that.
    expect(decideReplay({ cursor: 99n, pending: 0, oldestRetainedId: null })).toEqual({
      kind: 'replay',
      cursor: 99n,
    });
  });

  it('prefers the retention reason when both apply', () => {
    // Both true at once: the honest answer is that rows are *missing*, not
    // merely numerous — the client cannot fix the first by replaying harder.
    expect(
      decideReplay({ cursor: 1n, pending: MAX_REPLAY_ROWS + 50, oldestRetainedId: 400n })
    ).toEqual({ kind: 'resync', reason: 'retention' });
  });
});
