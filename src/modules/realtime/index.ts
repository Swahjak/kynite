/**
 * Public surface of the realtime slice (docs/architecture.md §2).
 * The SSE endpoint and cursor replay land in M10; M05 needs the publisher.
 */

export {
  REALTIME_EVENT_TYPES,
  eventLog,
  type EventLogRow,
  type RealtimeActorSource,
  type RealtimeEvent,
  type RealtimeEventType,
} from './schema';

export { familyChannel, publish, type PublishInput } from './publish';
