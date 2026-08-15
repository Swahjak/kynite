import 'server-only';
import { decideReplay, MAX_REPLAY_ROWS, type ReplayDecision } from './domain/cursor';
import {
  controlFrame,
  eventFrame,
  HEARTBEAT_FRAME,
  HEARTBEAT_INTERVAL_MS,
  retryFrame,
} from './domain/frame';
import { CHANNEL_CLOSED, subscribe } from './listen-pool';
import type { NotifyPayload } from './publish';
import {
  countEventsAfter,
  getEvent,
  latestEventId,
  oldestRetainedEventId,
  replayEvents,
} from './queries';
import type { RealtimeEvent } from './schema';

/**
 * One family's SSE stream (docs/architecture.md §4 "SSE endpoint").
 *
 * The ordering below is the whole design, and it is not the obvious one:
 *
 *   1. **Listen first, replay second.** Subscribing before reading the log
 *      means an event published *during* the replay is buffered rather than
 *      lost. The other order has a hole exactly one query wide, which is the
 *      kind of race that shows up as "the hub missed one tap, once".
 *   2. **Subscribe before the response exists.** The per-family cap has to be
 *      answerable with a status code, and a `ReadableStream` that has already
 *      been handed to `new Response()` can only fail as a broken stream. So
 *      this function is `async`: it takes the connection first and throws
 *      `StreamCapExceededError` *before* the route commits to 200.
 *   3. **The cursor only ever moves forward.** `deliveredUpTo` is the last id
 *      written to the socket and the client's next `Last-Event-ID`; nothing is
 *      emitted with a lower id, whatever order it arrived in.
 *
 * Cleanup is unconditional: aborting the request, cancelling the stream, a
 * dead listen connection and a stream that is never read at all all run the
 * same teardown — unsubscribe, free the family's slot, clear the heartbeat.
 */

export type FamilyStreamOptions = {
  familyId: string;
  /** `null` = a fresh client; otherwise the `Last-Event-ID` it reconnected with. */
  cursor: bigint | null;
  /** The route's `request.signal` — the browser going away. */
  signal: AbortSignal;
  /** Overridable so tests do not have to wait 25 real seconds. */
  heartbeatIntervalMs?: number;
  /**
   * The device id this stream belongs to, if the principal that opened it is
   * a paired kiosk — `undefined` for a member's stream, which has no device
   * to watch for.
   *
   * Non-blocking review finding 3: a revoked device's own stream used to keep
   * its `LISTEN` fan-out slot and connection for up to an hour (the
   * heartbeat's only teardown trigger was the browser disconnecting), even
   * though `device.revoked` for its own id already travelled across the very
   * channel it was subscribed to. `DeviceSessionWatcher` reacts to that event
   * client-side and refreshes; this is the server-side mirror — the stream
   * that carried the news closes itself and frees the slot the moment it has
   * delivered it, rather than waiting for the client to act on it and cancel.
   */
  selfDeviceId?: string;
};

function parsePayload(raw: string): NotifyPayload | null {
  try {
    return JSON.parse(raw) as NotifyPayload;
  } catch {
    return null;
  }
}

/**
 * Decide what this connection owes the client before any bytes are written.
 * Split out so the resync/replay rule can be exercised against a real log
 * without opening a stream.
 */
export async function planReplay(
  familyId: string,
  cursor: bigint | null
): Promise<{ decision: ReplayDecision; head: bigint | null }> {
  const head = await latestEventId(familyId);

  if (cursor === null) return { decision: { kind: 'live' }, head };

  const [pending, oldest] = await Promise.all([
    countEventsAfter(familyId, cursor),
    oldestRetainedEventId(familyId),
  ]);

  return { decision: decideReplay({ cursor, pending, oldestRetainedId: oldest }), head };
}

export async function openFamilyStream(
  options: FamilyStreamOptions
): Promise<ReadableStream<Uint8Array>> {
  const { familyId, cursor, signal, selfDeviceId } = options;
  const heartbeatMs = options.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
  const encoder = new TextEncoder();

  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  /** The last id written to the socket — and the client's next cursor. */
  let deliveredUpTo = cursor ?? 0n;
  /** Non-null while the replay is still running: everything live is queued. */
  let buffer: RealtimeEvent[] | null = [];
  /** Set once `start()` runs; before that there is nowhere to write. */
  let write: ((frame: string) => void) | undefined;
  let endStream: (() => void) | undefined;

  const emit = (event: RealtimeEvent): void => {
    const id = BigInt(event.id);
    if (id <= deliveredUpTo) return;
    deliveredUpTo = id;
    write?.(eventFrame(event));

    // The event just written is this very stream's own revocation: deliver
    // it (above), then close rather than linger for up to an hour holding a
    // `LISTEN` fan-out slot for a credential that no longer exists.
    if (selfDeviceId && event.type === 'device.revoked' && event.entity.id === selfDeviceId) {
      void teardown().then(() => endStream?.());
    }
  };

  const deliver = (event: RealtimeEvent): void => {
    if (buffer) buffer.push(event);
    else emit(event);
  };

  const onNotify = (payload: string): void => {
    if (payload === CHANNEL_CLOSED) {
      // The listen connection died. End the stream; EventSource reconnects
      // with `Last-Event-ID` and replays the gap — the same mechanism a closed
      // laptop lid already relies on.
      void teardown().then(() => endStream?.());
      return;
    }

    const parsed = parsePayload(payload);
    if (!parsed) return;

    if ('ref' in parsed) {
      // Oversized event: only its id travelled (`MAX_INLINE_NOTIFY_CHARS`).
      void getEvent(familyId, BigInt(parsed.ref))
        .then((event) => {
          if (event) deliver(event);
        })
        .catch(() => {
          // A transient DB error here drops one frame; the next notification
          // (or the client's own reconnect/replay) recovers it. Crashing the
          // stream over one lookup would be worse than the miss.
        });
      return;
    }

    // Belt and braces on the channel name: a stream only ever writes events
    // stamped with its own family.
    if (parsed.familyId !== familyId) return;
    deliver(parsed);
  };

  // 1. Take the connection first — this is what can be refused (429).
  const subscription = await subscribe(familyId, onNotify);

  const teardown = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    if (heartbeat) clearInterval(heartbeat);
    signal.removeEventListener('abort', onAbort);
    await subscription.unsubscribe();
  };

  function onAbort(): void {
    void teardown().then(() => endStream?.());
  }

  signal.addEventListener('abort', onAbort, { once: true });
  // Already gone before we finished connecting: release immediately rather
  // than leaving a slot held by a request that no longer exists.
  if (signal.aborted) await teardown();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      endStream = () => {
        try {
          controller.close();
        } catch {
          // Already closed by the runtime.
        }
      };

      write = (frame: string): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(frame));
        } catch {
          // The consumer went away between the abort and this write.
          void teardown();
        }
      };

      if (closed) {
        endStream();
        return;
      }

      // 2. Open the conversation: the reconnect hint, then where we are.
      write(retryFrame());

      const { decision, head } = await planReplay(familyId, cursor);

      write(
        controlFrame({
          type: 'hello',
          cursor: String(head ?? 0n),
          serverNow: new Date().toISOString(),
        })
      );

      if (decision.kind === 'resync') {
        // §4: the gap is unreplayable, so the client refetches instead. The
        // cursor jumps to the head — everything before it is the refetch's job.
        if (head !== null) deliveredUpTo = head;
        write(
          controlFrame({ type: 'resync', reason: decision.reason, cursor: String(head ?? 0n) })
        );
      } else if (decision.kind === 'replay') {
        for (const event of await replayEvents(familyId, decision.cursor, MAX_REPLAY_ROWS)) {
          emit(event);
        }
      }

      // 3. Flush whatever arrived during the replay, in id order, then go live.
      const pending = buffer ?? [];
      buffer = null;
      pending.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
      for (const event of pending) emit(event);

      // 4. §4's 25s comment frame. Teardown may have already run while we were
      // awaiting the replay above (an abort mid-replay) — starting the
      // interval after that would leak it past `clearInterval` in `teardown`.
      if (closed) return;
      heartbeat = setInterval(() => write?.(HEARTBEAT_FRAME), heartbeatMs);
      // Node keeps the process alive for a pending timer; a heartbeat must not.
      heartbeat.unref?.();
    },

    async cancel() {
      await teardown();
    },
  });
}
