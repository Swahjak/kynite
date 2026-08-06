/**
 * Public surface of the realtime slice (docs/architecture.md §2).
 *
 * **Server only.** Unlike the feature slices, this barrel deliberately exports
 * no client component: `publish()` is imported by every other slice's Server
 * Actions, so a `'use client'` module in here would drag the whole React
 * client graph into six mutation modules. The browser half of realtime — the
 * single `EventSource`, its per-slice selectors and the offline outbox — lives
 * in `@/components/realtime` instead, next to `@/components/celebration`,
 * which has the same shape and the same reason.
 */

export {
  REALTIME_EVENT_TYPES,
  eventLog,
  type EventLogRow,
  type RealtimeActorSource,
  type RealtimeEvent,
  type RealtimeEventType,
} from './schema';

export {
  MAX_INLINE_NOTIFY_CHARS,
  familyChannel,
  publish,
  type NotifyPayload,
  type PublishInput,
} from './publish';

export {
  MAX_REPLAY_ROWS,
  RETENTION_DAYS,
  decideReplay,
  parseCursor,
  type ReplayDecision,
} from './domain/cursor';

export {
  CONTROL_SSE_EVENT,
  HEARTBEAT_FRAME,
  HEARTBEAT_INTERVAL_MS,
  REALTIME_SSE_EVENT,
  RETRY_HINT_MS,
  SSE_HEADERS,
  controlFrame,
  eventFrame,
  retryFrame,
  type ControlFrame,
} from './domain/frame';

export {
  LISTEN_POOL_MAX,
  MAX_STREAMS_PER_FAMILY,
  StreamCapExceededError,
  closeListenPool,
  getListenPool,
  listenPoolStats,
  subscribe,
  type Subscription,
} from './listen-pool';

export {
  countEventsAfter,
  getEvent,
  latestEventId,
  oldestRetainedEventId,
  replayEvents,
} from './queries';

export { openFamilyStream, planReplay, type FamilyStreamOptions } from './stream';
