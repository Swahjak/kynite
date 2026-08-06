import { bigserial, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt } from '@/server/db/columns';
import { family } from '@/modules/family/schema';

/** docs/architecture.md §4 "Catch-up: `event_log` + cursor". */

/** The realtime event vocabulary (§4 `RealtimeEvent["type"]`). */
export const REALTIME_EVENT_TYPES = [
  'event.upserted',
  'event.deleted',
  'completion.created',
  'completion.undone',
  'stars.awarded',
  'redemption.requested',
  'redemption.decided',
  'routine.updated',
  'timer.started',
  'timer.stopped',
  'sync.status',
] as const;

export type RealtimeEventType = (typeof REALTIME_EVENT_TYPES)[number];

export type RealtimeActorSource = 'hub' | 'mobile' | 'sync' | 'job';

/** The NOTIFY payload — a hint, not a data transfer (§4). */
export type RealtimeEvent = {
  v: 1;
  /** `event_log.id` — the monotonic cursor, and the SSE `id:` line. */
  id: string;
  familyId: string;
  type: RealtimeEventType;
  at: string;
  actor: { memberId?: string; deviceId?: string; source: RealtimeActorSource };
  entity: { id: string; version?: number };
  patch?: Record<string, unknown>;
};

/**
 * Every published event is inserted here first — in the same transaction as
 * the write — and then NOTIFYed with its id. On reconnect the browser sends
 * `Last-Event-ID` and `/api/sse` replays `id > cursor` before attaching the
 * live listener. Retention is 7 days, trimmed by a nightly job.
 *
 * `id` is `bigserial`, not a uuid: the cursor has to be *ordered*, which is the
 * one place in this schema where a random id would be wrong. Append-only, so
 * no `updatedAt`.
 *
 * `type` is text rather than an enum on purpose: adding a realtime event type
 * is a code change in one slice, not a database migration. The vocabulary is
 * pinned by `REALTIME_EVENT_TYPES` and by the payload type above.
 */
export const eventLog = pgTable(
  'event_log',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    type: text('type').$type<RealtimeEventType>().notNull(),
    payload: jsonb('payload').$type<RealtimeEvent>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    // The replay predicate: one family's log after a cursor, already ordered.
    index('event_log_family_id_id_idx').on(table.familyId, table.id),
    // The retention trim predicate.
    index('event_log_created_at_idx').on(table.createdAt),
  ]
);

export type EventLogRow = typeof eventLog.$inferSelect;
