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
  // M12. Not a data change: it tells a wall tablet that its own credential is
  // gone, so it can drop to the pair screen without waiting for somebody to
  // touch it (§7 "revocation drops the hub to a pair screen on the next
  // request or SSE tick"). `entity.id` is the revoked device id.
  'device.revoked',
  // M16. Also not a data change: a parent changed something about how the
  // household's shared surfaces are configured — the hub's default board, a
  // calendar's colour or visibility, the family's locale or timezone — and
  // every wall display has to pick it up on its own. FR28's criterion is
  // "takes effect on the hub **without re-pairing**", and a tablet nobody
  // touches for weeks would otherwise keep rendering the old settings until
  // something else happened to refresh it. `entity.id` is the family id: the
  // subject of this event is the household, not a row.
  'settings.updated',
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
  /**
   * `clientId` extends §4's actor shape by exactly one optional field, and it
   * is §4 itself that forces it: "the originating device ignores echoes of its
   * own `clientId`" is unimplementable unless the echo carries the id. It is
   * the same idempotency key the write used, so nothing new is invented — the
   * value already crossed the wire on the way in.
   */
  actor: {
    memberId?: string;
    deviceId?: string;
    clientId?: string;
    source: RealtimeActorSource;
  };
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
