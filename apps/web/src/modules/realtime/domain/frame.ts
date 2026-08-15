import type { RealtimeEvent } from '../schema';

/**
 * The SSE wire format (docs/architecture.md §4 "SSE endpoint").
 *
 * Pure string building, kept out of the stream so the bytes a browser receives
 * can be asserted character for character — including the parts that are easy
 * to get subtly wrong: the blank line that terminates a frame, the `id:` line
 * that becomes the next `Last-Event-ID`, and the comment frame that is a
 * heartbeat rather than an event.
 *
 * The type import is erased at build time, so this module stays free of
 * drizzle, `server-only` and the database — the §2 rule for `domain/`.
 */

/** §4: "25s heartbeat comment (`: ping`) to defeat idle timeouts." */
export const HEARTBEAT_INTERVAL_MS = 25_000;

/**
 * A comment frame. EventSource ignores it entirely — which is the point: it
 * keeps proxies and load balancers from closing an idle connection without
 * costing the client a single `onmessage`.
 */
export const HEARTBEAT_FRAME = ': ping\n\n';

/** The named SSE event every `RealtimeEvent` arrives under. */
export const REALTIME_SSE_EVENT = 'kynite';

/**
 * The control channel: frames that are *about* the stream rather than about
 * the family's data. They deliberately do not carry an `id:` line — a client
 * must never adopt a control frame as its replay cursor.
 */
export const CONTROL_SSE_EVENT = 'control';

export type ControlFrame =
  /**
   * Sent once, first, on every connection. `cursor` is the log head at the
   * moment the stream attached, and `serverNow` is what devices correct their
   * clocks against (the same echo `/api/timers` provides).
   */
  | { type: 'hello'; cursor: string; serverNow: string }
  /**
   * §4: "If the gap exceeds retention or 500 rows, the server emits
   * `{type:"resync"}` and the client does a full refetch."
   */
  | { type: 'resync'; reason: 'retention' | 'gap'; cursor: string };

/**
 * Response headers for the stream (§4). `X-Accel-Buffering: no` is the one
 * that is invisible until it bites: nginx buffers proxied responses by
 * default, which turns a live stream into a page that arrives all at once,
 * minutes late.
 */
export const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-store',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

/**
 * Serialise one line of `data:`. JSON never contains a raw newline, so a
 * single `data:` line is always enough — but the split is kept explicit so a
 * future multi-line payload cannot silently truncate a frame.
 */
function dataLines(value: unknown): string {
  return JSON.stringify(value)
    .split('\n')
    .map((line) => `data: ${line}`)
    .join('\n');
}

/** One realtime event as a frame, carrying its `event_log.id` as the SSE id. */
export function eventFrame(event: RealtimeEvent): string {
  return `id: ${event.id}\nevent: ${REALTIME_SSE_EVENT}\n${dataLines(event)}\n\n`;
}

/** A control frame — no `id:` line, by design (see `ControlFrame`). */
export function controlFrame(frame: ControlFrame): string {
  return `event: ${CONTROL_SSE_EVENT}\n${dataLines(frame)}\n\n`;
}

/**
 * `retry:` tells EventSource how long to wait before reconnecting. Browsers
 * default to ~3s; 1s is the right floor for a wall display that must not sit
 * blank, and the browser still backs off on repeated failure.
 */
export const RETRY_HINT_MS = 1000;

export function retryFrame(ms: number = RETRY_HINT_MS): string {
  return `retry: ${ms}\n\n`;
}
