import 'server-only';
import { sql } from 'drizzle-orm';
import { getDb, type Database } from '@/server/db';
import {
  eventLog,
  type RealtimeActorSource,
  type RealtimeEvent,
  type RealtimeEventType,
} from './schema';

/**
 * The realtime publisher (docs/architecture.md §4 "Publisher").
 *
 * Every published event is inserted into `event_log` first and NOTIFYed with
 * its id, in one transaction — if the write rolls back, no notification
 * escapes. The SSE endpoint and the reconnect/replay path land in M10; the
 * publisher exists now because M05's sync engine must emit `sync.status` and
 * `event.upserted` the moment it lands.
 *
 * Two call shapes, two guarantees:
 *
 *   - **Bare** (`publish(input)`, no `executor`) — this function opens its
 *     own transaction around its own INSERT + UPDATE + `pg_notify`, so
 *     *those three statements* commit or roll back together. No partial
 *     `event_log` row with `payload.id === '0'` can ever be observable. This
 *     is what every current caller (`src/modules/google/store.ts`'s
 *     `publishEmitter`) uses; the Google sync/push engines commit their own
 *     row writes (`upsertEvent`/`tombstone`) *before* calling `emit`, so
 *     "the engine's write and its broadcast happen atomically together" is
 *     NOT a guarantee bare `publish()` provides — only "the broadcast row
 *     itself is never torn" is.
 *   - **Threaded** (`publish(input, tx)`) — the caller already holds a
 *     transaction (e.g. one that also performs the entity write) and wants
 *     `publish`'s statements folded into it, giving the stronger
 *     write-and-broadcast atomicity. No current call site does this yet
 *     (M05's engines write, then emit, as two separate steps); the plumbing
 *     is here for whichever caller needs it first.
 */

/** §4: one Postgres channel per family, `kynite_family_<uuid-no-dashes>`. */
export function familyChannel(familyId: string): string {
  return `kynite_family_${familyId.replace(/-/g, '')}`;
}

/**
 * NOTIFY payloads are capped at 8000 bytes by Postgres, and exceeding the cap
 * is an *error* — it would roll the caller's write back. So an oversized event
 * is notified by reference instead: `{"ref":"<event_log.id>"}`, which the
 * listener resolves by reading the row it already stored. Below the cap the
 * full event travels inline and no read is needed at all.
 *
 * The threshold is deliberately under 8000: the cap counts bytes, JSON is
 * measured here in UTF-16 code units, and a payload of emoji-heavy step titles
 * can be twice its `.length` in bytes.
 */
export const MAX_INLINE_NOTIFY_CHARS = 3500;

/** What a `LISTEN` client receives: either the event, or a pointer to it. */
export type NotifyPayload = RealtimeEvent | { ref: string };

export type PublishInput = {
  familyId: string;
  type: RealtimeEventType;
  entity: { id: string; version?: number };
  actor?: {
    memberId?: string;
    deviceId?: string;
    /** The write's idempotency key, so the originating device can drop its own echo. */
    clientId?: string;
    source: RealtimeActorSource;
  };
  patch?: Record<string, unknown>;
};

type Executor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

export async function publish(input: PublishInput, executor?: Executor): Promise<RealtimeEvent> {
  // No executor given: run our own three statements in their own transaction
  // rather than against the bare pool, so a partial `event_log` row can never
  // persist (see the guarantee note above).
  if (!executor) return getDb().transaction((tx) => publish(input, tx));

  const runner = executor;

  const [row] = await runner
    .insert(eventLog)
    .values({
      familyId: input.familyId,
      type: input.type,
      // The payload is rewritten below with the id the insert assigned; the
      // column is NOT NULL, so it is seeded with the id-less shape first.
      payload: {
        v: 1,
        id: '0',
        familyId: input.familyId,
        type: input.type,
        at: new Date().toISOString(),
        actor: input.actor ?? { source: 'job' },
        entity: input.entity,
        ...(input.patch ? { patch: input.patch } : {}),
      } satisfies RealtimeEvent,
    })
    .returning({ id: eventLog.id, payload: eventLog.payload });

  const event: RealtimeEvent = { ...row.payload, id: String(row.id) };

  await runner
    .update(eventLog)
    .set({ payload: event })
    .where(sql`${eventLog.id} = ${row.id}`);

  const inline = JSON.stringify(event);
  const payload =
    inline.length <= MAX_INLINE_NOTIFY_CHARS ? inline : JSON.stringify({ ref: event.id });

  // Same transaction as the INSERT above — and, when `executor` is the
  // caller's `tx`, as the caller's own write. A rollback takes the notification
  // with it: `pg_notify` only delivers on commit.
  await runner.execute(sql`SELECT pg_notify(${familyChannel(input.familyId)}, ${payload})`);

  return event;
}
