'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeEvent, RealtimeEventType } from '@/modules/realtime';
import { OwnClientIds, isOwnEcho } from './echo';
import {
  OUTBOX_RETRY_INTERVAL_MS,
  flushCompletions,
  listQueuedCompletions,
  type OutboxCompletion,
} from './outbox';

/**
 * The browser half of realtime (docs/architecture.md §4).
 *
 * **One `EventSource` per surface, not per slice.** Every consumer — the timer
 * board, the routine board, the calendar — subscribes to this one stream and
 * selects the event types it cares about. A stream per component would burn
 * the family's connection budget (`MAX_STREAMS_PER_FAMILY`) on a single hub.
 *
 * The provider does three things and delegates the rest:
 *
 *  - **holds the connection**, including reconnection. `EventSource` retries
 *    by itself after a dropped stream and resends `Last-Event-ID`, which is
 *    the entire reason §4 chose SSE. It does *not* retry after a non-200
 *    (a 401 after a sign-out, a 429 at the per-family cap) — the spec closes
 *    the object instead — so those get an explicit backoff here.
 *  - **exposes connection state**, so an offline indicator can derive from the
 *    stream rather than from `navigator.onLine`. A tablet on a wifi network
 *    with no route to the internet reports itself as online; the stream knows
 *    better. M11 renders this; M10 only has to be honest about it.
 *  - **drops this device's own echoes** (`isOwnEcho`).
 */

export const REALTIME_ENDPOINT = '/api/sse';

/** Named SSE events, mirroring `modules/realtime/domain/frame.ts`. */
const EVENT_NAME = 'kynite';
const CONTROL_NAME = 'control';

/** Backoff for the failures `EventSource` will not retry on its own. */
const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30_000;

export type RealtimeStatus = 'connecting' | 'open' | 'offline';

type EventListener = (event: RealtimeEvent) => void;
type ResyncListener = () => void;

export type RealtimeApi = {
  status: RealtimeStatus;
  /** Every event this family produces, minus this device's own echoes. */
  subscribe: (listener: EventListener) => () => void;
  /** The server could not replay the gap; the client must refetch (§4). */
  subscribeResync: (listener: ResyncListener) => () => void;
  /** Remember a `clientId` this device just wrote, so its echo is ignored. */
  markOwn: (clientId: string) => void;
};

const noop = () => () => {};

/**
 * The default is a *disconnected* API rather than `null`: a component rendered
 * outside a provider (a unit test, a marketing page) keeps working and simply
 * never receives an event, instead of throwing on a context read.
 */
const RealtimeContext = createContext<RealtimeApi>({
  status: 'offline',
  subscribe: noop,
  subscribeResync: noop,
  markOwn: () => {},
});

export function RealtimeProvider({
  children,
  enabled = true,
  endpoint = REALTIME_ENDPOINT,
}: {
  children: React.ReactNode;
  /** `false` for surfaces that must not stream (a frozen visual snapshot). */
  enabled?: boolean;
  endpoint?: string;
}) {
  const [status, setStatus] = useState<RealtimeStatus>(enabled ? 'connecting' : 'offline');

  const listeners = useRef<Set<EventListener>>(new Set());
  const resyncListeners = useRef<Set<ResyncListener>>(new Set());
  const ownIds = useRef<OwnClientIds>(new OwnClientIds());

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return;

    let source: EventSource | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let backoff = RECONNECT_MIN_MS;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      setStatus('connecting');
      source = new EventSource(endpoint);

      source.onopen = () => {
        backoff = RECONNECT_MIN_MS;
        setStatus('open');
      };

      source.addEventListener(EVENT_NAME, (message) => {
        let event: RealtimeEvent;
        try {
          event = JSON.parse((message as MessageEvent<string>).data) as RealtimeEvent;
        } catch {
          return;
        }
        if (isOwnEcho(event, ownIds.current)) return;
        for (const listener of [...listeners.current]) listener(event);
      });

      source.addEventListener(CONTROL_NAME, (message) => {
        let frame: { type?: string };
        try {
          frame = JSON.parse((message as MessageEvent<string>).data) as { type?: string };
        } catch {
          return;
        }
        if (frame.type === 'hello') setStatus('open');
        if (frame.type === 'resync') {
          for (const listener of [...resyncListeners.current]) listener();
        }
      });

      source.onerror = () => {
        setStatus('offline');
        // `CLOSED` means the browser has given up (a non-200, a bad content
        // type). `CONNECTING` means it is already retrying by itself, with the
        // `Last-Event-ID` it remembers — leave it alone.
        if (source?.readyState !== EventSource.CLOSED) return;
        source.close();
        retryTimer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, RECONNECT_MAX_MS);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [enabled, endpoint]);

  const api = useMemo<RealtimeApi>(
    () => ({
      status,
      subscribe: (listener) => {
        listeners.current.add(listener);
        return () => listeners.current.delete(listener) as unknown as void;
      },
      subscribeResync: (listener) => {
        resyncListeners.current.add(listener);
        return () => resyncListeners.current.delete(listener) as unknown as void;
      },
      markOwn: (clientId) => ownIds.current.remember(clientId),
    }),
    [status]
  );

  return <RealtimeContext.Provider value={api}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeApi {
  return useContext(RealtimeContext);
}

/** The connection state, for an offline indicator (M11) or a fallback poll. */
export function useRealtimeStatus(): RealtimeStatus {
  return useRealtime().status;
}

/**
 * Per-slice selector: run `handler` for the event types this component cares
 * about. The handler is held in a ref, so a fresh closure on every render does
 * not tear the subscription down and build it back up.
 */
export function useRealtimeEvents(
  types: readonly RealtimeEventType[],
  handler: (event: RealtimeEvent) => void
): void {
  const { subscribe } = useRealtime();
  // Held in a ref and updated in an effect (never during render): the
  // subscription must survive a fresh closure on every parent re-render.
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // The type list is almost always a literal array, so identity changes every
  // render; the *contents* are what the subscription depends on.
  const key = [...types].sort().join(',');

  useEffect(() => {
    const wanted = new Set(key.split(',').filter(Boolean));
    return subscribe((event) => {
      if (wanted.size > 0 && !wanted.has(event.type)) return;
      handlerRef.current(event);
    });
  }, [subscribe, key]);
}

/** Run `handler` when the server says the gap was too big to replay (§4). */
export function useRealtimeResync(handler: () => void): void {
  const { subscribeResync } = useRealtime();
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => subscribeResync(() => handlerRef.current()), [subscribeResync]);
}

/**
 * Drain the completion outbox whenever draining it might work.
 *
 * Three triggers, in decreasing order of how much they are trusted:
 *
 *  - **the stream opening** — the only signal that actually means "the server
 *    is reachable from this device right now" (M11's offline indicator derives
 *    from the same state, and for the same reason);
 *  - **the browser's `online` event** — worth acting on, not worth believing;
 *    a device can be "online" and still unable to reach anything.
 *  - **a slow interval** — the floor under both. A tab whose socket survived a
 *    dead network never sees an `open` transition, and a queued tap must not
 *    wait for the next tap to be noticed.
 */
export function useCompletionOutbox(
  send: (entry: OutboxCompletion) => Promise<boolean>,
  onFlushed?: (sent: number) => void
): void {
  const status = useRealtimeStatus();

  const sendRef = useRef(send);
  const flushedRef = useRef(onFlushed);
  useEffect(() => {
    sendRef.current = send;
    flushedRef.current = onFlushed;
  }, [send, onFlushed]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const attempt = async (): Promise<void> => {
      if (cancelled) return;

      const queued = await listQueuedCompletions();
      if (queued.length > 0) {
        const result = await flushCompletions((entry) => sendRef.current(entry));
        if (!cancelled && result.sent > 0) flushedRef.current?.(result.sent);
      }

      if (!cancelled) timer = setTimeout(() => void attempt(), OUTBOX_RETRY_INTERVAL_MS);
    };

    void attempt();

    const onOnline = () => void attempt();
    window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', onOnline);
    };
    // `status` is a dependency so a reconnect re-arms the loop immediately
    // rather than waiting out the interval.
  }, [status]);
}
