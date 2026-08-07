/**
 * The browser half of realtime (docs/architecture.md §4).
 *
 * Lives here rather than in `modules/realtime/ui` for the reason spelled out
 * in that slice's barrel: `publish()` is `server-only` and is imported by six
 * Server Action modules, so the slice's public surface cannot also carry
 * `'use client'` code. Same shape and same reason as `@/components/celebration`.
 */

export {
  REALTIME_ENDPOINT,
  RealtimeProvider,
  useRealtime,
  useCompletionOutbox,
  useRealtimeEvents,
  useRealtimeResync,
  useRealtimeStatus,
  type RealtimeApi,
  type RealtimeStatus,
} from './realtime-provider';

export { OWN_CLIENT_ID_MEMORY, OwnClientIds, isOwnEcho } from './echo';

export {
  OUTBOX_DB_NAME,
  OUTBOX_RETRY_INTERVAL_MS,
  dropCompletion,
  enqueueCompletion,
  flushCompletions,
  listQueuedCompletions,
  type FlushResult,
  type PendingCompletion,
  type OutboxCompletion,
} from './outbox';
