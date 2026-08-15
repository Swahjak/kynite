'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRealtimeEvents, useRealtimeResync, useRealtimeStatus } from '@/components/realtime';
import { clockOffsetMs } from '../domain/countdown';
import type { TimerBoardData, TimerView } from '../page-data';

/**
 * The hub's live link to the family's timers — now over SSE (M10).
 *
 * M09 shipped this as a 2s poll behind exactly this interface, and the promise
 * then was that "the body of the effect is replaced by a subscription and
 * nothing else in the slice changes". That is what happened: the signature,
 * the return type and every consumer are untouched.
 *
 * **`/api/timers` survives, and deliberately.** It is no longer *polled* — it
 * is the state fetch a `timer.started` / `timer.stopped` event triggers, and
 * the fallback poll for a hub whose stream is down. Deleting it would have
 * meant putting the whole board into every NOTIFY payload (which §4 explicitly
 * does not do — the event is "a hint, not a data transfer") and losing the
 * server-clock echo that every countdown is derived from. So the event says
 * *that* something changed and this endpoint says *what* it is now.
 *
 * `offsetMs` is unchanged in meaning and in why it exists: server clock minus
 * device clock, `null` until measured, so the first client render is
 * byte-identical to the server's and hydration stays quiet.
 */

/** Fallback cadence — used only while the stream is *not* open. */
export const TIMER_POLL_INTERVAL_MS = 2000;

export const TIMER_CHANNEL_ENDPOINT = '/api/timers';

/** The event types that change what is on the timer board. */
const TIMER_EVENT_TYPES = ['timer.started', 'timer.stopped', 'timer.extended'] as const;

export type TimerChannel = {
  timers: TimerView[];
  /** Server clock minus device clock. `null` until the first measurement. */
  offsetMs: number | null;
};

export function useTimerChannel(initial: TimerBoardData): TimerChannel {
  const [timers, setTimers] = useState<TimerView[]>(initial.timers);
  const [offsetMs, setOffsetMs] = useState<number | null>(null);
  const status = useRealtimeStatus();

  // A board rendered at a pinned instant (`?now=`) neither ticks nor listens:
  // leaving `offsetMs` at `null` freezes `useServerNow` on the pinned value,
  // which is what makes a countdown screenshot-testable at all.
  const live = !initial.frozen;

  const inFlight = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    // A hidden kiosk tab is a tab nobody is looking at; the next visible frame
    // re-reads anyway, so there is nothing to catch up on.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    try {
      const response = await fetch(TIMER_CHANNEL_ENDPOINT, {
        signal: controller.signal,
        cache: 'no-store',
      });
      if (!response.ok) return;

      const data = (await response.json()) as TimerBoardData;
      setTimers(data.timers);
      // Re-measured on every response: a device whose clock drifts (or is
      // corrected by NTP mid-countdown) is followed rather than trusted.
      setOffsetMs(clockOffsetMs(data.serverNow, Date.now()));
    } catch {
      // A failed fetch is not an event: the countdown keeps ticking from the
      // last known start time, which is the whole point of deriving it.
    }
  }, []);

  // The server render is already in hand: measure the skew against *it* first
  // — after paint, so the first frame still matches the server HTML.
  useEffect(() => {
    if (!live) return;
    const handle = setTimeout(() => setOffsetMs(clockOffsetMs(initial.serverNow, Date.now())), 0);
    return () => clearTimeout(handle);
  }, [live, initial.serverNow]);

  useRealtimeEvents(TIMER_EVENT_TYPES, () => {
    if (live) void refresh();
  });

  // A resync means the stream gave up on replaying the gap (§4) — the board is
  // exactly the "full refetch" that answers it.
  useRealtimeResync(() => {
    if (live) void refresh();
  });

  // Fallback only. With the stream open this interval never runs: the events
  // are the transport, and polling on top of them would be the poll we just
  // removed, wearing a hat.
  useEffect(() => {
    if (!live || status === 'open') return;

    const handle = setInterval(() => void refresh(), TIMER_POLL_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [live, status, refresh]);

  useEffect(() => () => inFlight.current?.abort(), []);

  return { timers, offsetMs };
}
