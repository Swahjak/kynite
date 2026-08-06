'use client';

import { useEffect, useState } from 'react';
import { clockOffsetMs } from '../domain/countdown';
import type { TimerBoardData, TimerView } from '../page-data';

/**
 * The hub's live link to the family's timers — **a polling stub with an SSE
 * shape** (M09 scope: "stubbed with polling until M10").
 *
 * Everything that consumes timers goes through this hook and sees only
 * `{ timers, offsetMs }`. When M10 lands `/api/sse`, the body of the effect
 * below is replaced by an `EventSource` subscription and nothing else in the
 * slice changes: the transport is the only thing this file exposes.
 *
 * `offsetMs` is the second half of the contract and the reason the hook
 * returns it rather than a `now`: every response carries the *server's* clock,
 * and the difference from the device's own clock is what every countdown is
 * rendered through. It starts `null` — meaning "not measured yet" — so the
 * first client render is byte-identical to the server's and hydration is
 * quiet; the real offset lands a tick later.
 */

export const TIMER_POLL_INTERVAL_MS = 2000;

export const TIMER_CHANNEL_ENDPOINT = '/api/timers';

export type TimerChannel = {
  timers: TimerView[];
  /** Server clock minus device clock. `null` until the first measurement. */
  offsetMs: number | null;
};

export function useTimerChannel(initial: TimerBoardData): TimerChannel {
  const [timers, setTimers] = useState<TimerView[]>(initial.timers);
  const [offsetMs, setOffsetMs] = useState<number | null>(null);

  // A board rendered at a pinned instant (`?now=`) neither ticks nor polls:
  // leaving `offsetMs` at `null` freezes `useServerNow` on the pinned value,
  // which is what makes a countdown screenshot-testable at all.
  const live = !initial.frozen;

  useEffect(() => {
    if (!live) return;

    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout>;

    const poll = async () => {
      // A hidden kiosk tab is a tab nobody is looking at; the next visible
      // frame re-reads anyway, so there is nothing to catch up on.
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        try {
          const response = await fetch(TIMER_CHANNEL_ENDPOINT, {
            signal: controller.signal,
            cache: 'no-store',
          });
          if (response.ok) {
            const data = (await response.json()) as TimerBoardData;
            setTimers(data.timers);
            // Re-measured on every response: a device whose clock drifts (or is
            // corrected by NTP mid-countdown) is followed rather than trusted.
            setOffsetMs(clockOffsetMs(data.serverNow, Date.now()));
          }
        } catch {
          // A failed poll is not an event: the countdown keeps ticking from the
          // last known start time, which is the whole point of deriving it.
        }
      }
      if (!controller.signal.aborted) timeout = setTimeout(poll, TIMER_POLL_INTERVAL_MS);
    };

    // The server render is already in hand: measure the skew against *it*
    // first — after paint, so the first frame still matches the server HTML —
    // and only then start polling. Without this the countdown would sit on the
    // server's instant for two seconds before catching up.
    timeout = setTimeout(() => {
      setOffsetMs(clockOffsetMs(initial.serverNow, Date.now()));
      timeout = setTimeout(poll, TIMER_POLL_INTERVAL_MS);
    }, 0);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [live, initial.serverNow]);

  return { timers, offsetMs };
}
