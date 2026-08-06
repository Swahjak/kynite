import 'server-only';
import type { PgBoss } from 'pg-boss';
import { enqueue } from '@/server/jobs/boss';
import { renewExpiringChannels } from './channels';
import { isGoogleConfigured } from './config';
import {
  QUEUE,
  QUEUE_DEFINITIONS,
  queueName,
  syncSingletonKey,
  type PushEventJob,
  type SyncCalendarJob,
} from './queues';
import { listPendingSyncEventIds, listSyncableCalendars, syncCalendarById } from './sync';
import { pushEventWithRetry } from './push';
import { refreshExpiringTokens } from './tokens';

/**
 * The Google job handlers (docs/architecture.md §5, milestone M05).
 *
 * Every handler is small on purpose: find the rows, call the engine, let
 * pg-boss own the retry. Failures throw — swallowing them here would hide a
 * dead channel behind a green queue.
 */

export async function enqueueCalendarSync(calendarId: string): Promise<string | null> {
  // `queueName()`, not the bare `QUEUE.syncCalendar`: pg-boss rejects the
  // colon in the documented queue name (`queues.ts`'s own header comment),
  // and `registerGoogleJobs`'s worker below is registered under the dot form
  // — an un-adapted name here would either throw (caught and swallowed by
  // every caller's `.catch(() => {})`) or, worse, silently address a queue no
  // worker is listening on. Caught by this module's own integration test
  // (N5) exercising a real `enqueue()` boundary rather than a mock of it.
  return enqueue(queueName(QUEUE.syncCalendar), { calendarId } satisfies SyncCalendarJob, {
    singletonKey: syncSingletonKey(calendarId),
    retryLimit: 5,
    retryBackoff: true,
  });
}

export async function enqueueEventPush(eventId: string): Promise<string | null> {
  // See `enqueueCalendarSync` above — same adapter, same reason.
  return enqueue(queueName(QUEUE.pushEvent), { eventId } satisfies PushEventJob, {
    singletonKey: eventId,
    retryLimit: 5,
    retryBackoff: true,
  });
}

/**
 * The `google:poll` job body, exported (not inlined in `registerGoogleJobs`)
 * so a test can drive it directly against a real Postgres with the pg-boss
 * `enqueue()` boundary swapped for a capturing fake, instead of needing a
 * running boss to observe what it enqueues.
 *
 * Two sweeps: every enabled calendar gets an incremental sync (missed
 * webhooks), and — N5 — every event still carrying `pendingSyncAt` gets a
 * fresh `google:push-event`. Before this, `sync-bridge.ts` claimed "the next
 * poll repairs it" for a push whose retry-enqueue also failed, but poll only
 * ever pulled; this is what makes that claim true.
 */
export async function runPoll(): Promise<void> {
  if (!isGoogleConfigured()) return;

  for (const calendar of await listSyncableCalendars()) {
    await enqueueCalendarSync(calendar.id);
  }

  for (const eventId of await listPendingSyncEventIds()) {
    await enqueueEventPush(eventId);
  }
}

/** Creates every queue with its policy. Idempotent — pg-boss upserts. */
export async function createGoogleQueues(boss: PgBoss): Promise<void> {
  for (const definition of QUEUE_DEFINITIONS) {
    await boss.createQueue(queueName(definition.name), {
      policy: definition.policy ?? 'standard',
      retryLimit: definition.retryLimit,
      retryBackoff: definition.retryBackoff,
    });
  }
}

/** Registers workers and the cron schedules. Called once, from instrumentation. */
export async function registerGoogleJobs(boss: PgBoss): Promise<void> {
  await createGoogleQueues(boss);

  await boss.work<SyncCalendarJob>(queueName(QUEUE.syncCalendar), async (jobs) => {
    for (const job of jobs) {
      await syncCalendarById(job.data.calendarId);
    }
  });

  await boss.work<PushEventJob>(queueName(QUEUE.pushEvent), async (jobs) => {
    for (const job of jobs) {
      // B1: the same wrapper the Server Actions call
      // (`@/modules/calendar/sync-bridge`'s `pushToGoogle`, which delegates to
      // this), not `pushEventById` directly — so a retry that finally
      // succeeds clears `pendingSyncAt` here exactly as it would on the
      // synchronous path, instead of leaving the pip stuck forever.
      await pushEventWithRetry(job.data.eventId);
    }
  });

  // §5 fallback: an incremental pass for every enabled calendar, so a missed
  // webhook costs at most one poll interval.
  await boss.work(queueName(QUEUE.poll), runPoll);

  await boss.work(queueName(QUEUE.renewChannels), async () => {
    if (!isGoogleConfigured()) return;
    await renewExpiringChannels();
  });

  await boss.work(queueName(QUEUE.refreshTokens), async () => {
    if (!isGoogleConfigured()) return;
    await refreshExpiringTokens();
  });

  for (const definition of QUEUE_DEFINITIONS) {
    if (!definition.cron) continue;
    // `key` makes rescheduling idempotent across restarts and deploys. It is
    // subject to the same name grammar as the queue, hence `queueName()`.
    await boss.schedule(
      queueName(definition.name),
      definition.cron,
      {},
      { key: queueName(definition.name) }
    );
  }
}
