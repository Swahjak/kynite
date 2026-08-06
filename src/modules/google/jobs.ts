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
import { listSyncableCalendars, pushEventById, syncCalendarById } from './sync';
import { refreshExpiringTokens } from './tokens';

/**
 * The Google job handlers (docs/architecture.md §5, milestone M05).
 *
 * Every handler is small on purpose: find the rows, call the engine, let
 * pg-boss own the retry. Failures throw — swallowing them here would hide a
 * dead channel behind a green queue.
 */

export async function enqueueCalendarSync(calendarId: string): Promise<string | null> {
  return enqueue(QUEUE.syncCalendar, { calendarId } satisfies SyncCalendarJob, {
    singletonKey: syncSingletonKey(calendarId),
    retryLimit: 5,
    retryBackoff: true,
  });
}

export async function enqueueEventPush(eventId: string): Promise<string | null> {
  return enqueue(QUEUE.pushEvent, { eventId } satisfies PushEventJob, {
    singletonKey: eventId,
    retryLimit: 5,
    retryBackoff: true,
  });
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
      await pushEventById(job.data.eventId);
    }
  });

  // §5 fallback: an incremental pass for every enabled calendar, so a missed
  // webhook costs at most one poll interval.
  await boss.work(queueName(QUEUE.poll), async () => {
    if (!isGoogleConfigured()) return;
    for (const calendar of await listSyncableCalendars()) {
      await enqueueCalendarSync(calendar.id);
    }
  });

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
