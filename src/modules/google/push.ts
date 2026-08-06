import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
// The `event` *table*, from the schema assembly point rather than from
// `@/modules/calendar` — see `sync.ts`'s header comment for why (a barrel
// import here would drag a React client graph into this `server-only`
// module and reintroduce the import cycle this file exists to avoid).
import { event } from '@/server/db/schema';
import { enqueueEventPush } from './jobs';
import { pushEventById } from './sync';

/**
 * The one push-and-retry wrapper, shared by every caller that pushes a local
 * write to Google (docs/architecture.md §5 "Write path (2-way)").
 *
 * B1 carry-forward: the `google:push-event` job used to call `pushEventById`
 * directly, bypassing this wrapper — so a retry that finally succeeded never
 * cleared `pendingSyncAt`, and the sync pip stuck forever. Both the Server
 * Action's synchronous push (`@/modules/calendar/sync-bridge`'s `pushToGoogle`,
 * which delegates here) and the job worker (`./jobs`) now call this function,
 * so "set on failure, clear on success" is one piece of code instead of two
 * copies that can drift.
 *
 * Google outages must never fail a local edit — the event is already written
 * and correct. So: try to push now → on failure, record `pendingSyncAt` and
 * hand the retry to the `google:push-event` job, which owns backoff.
 */
export async function pushEventWithRetry(eventId: string): Promise<void> {
  try {
    const outcome = await pushEventById(eventId);

    if (outcome.status === 'skipped') {
      // N6: a skip is not a failure — a native event or an unsyncable
      // calendar was never going to push, and never will until something
      // else changes (the event gets a calendar, the calendar becomes
      // writable). Clearing here is correct, not a shortcut: an outstanding
      // `pendingSyncAt` promises a retry will eventually push, which would be
      // false for these rows, so a stuck pip is strictly worse than none.
      console.info(`google push skipped for event ${eventId}: ${outcome.reason}`);
    }

    await clearPendingSync(eventId);
  } catch {
    // Deliberately swallowed: the local write already succeeded and is the
    // user's source of truth. Surfacing this as an action failure would tell a
    // parent their edit did not happen, which is false. The pip tells them the
    // *sync* has not happened, which is true.
    await markPendingSync(eventId);
    await enqueueEventPush(eventId).catch(() => {
      // Queue unavailable too (JOBS_ENABLED=false in tests, or a dead boss):
      // `pendingSyncAt` stays set, so the next poll or edit still repairs it.
    });
  }
}

async function markPendingSync(eventId: string): Promise<void> {
  await getDb()
    .update(event)
    .set({ pendingSyncAt: new Date() })
    .where(eq(event.id, eventId))
    .catch(() => {});
}

async function clearPendingSync(eventId: string): Promise<void> {
  await getDb()
    .update(event)
    .set({ pendingSyncAt: null })
    .where(eq(event.id, eventId))
    .catch(() => {});
}
