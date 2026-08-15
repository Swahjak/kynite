import 'server-only';
import type { PgBoss } from 'pg-boss';
import { enqueue } from '@/server/jobs/boss';
import {
  ICS_QUEUE,
  ICS_QUEUE_DEFINITIONS,
  icsQueueName,
  refreshSingletonKey,
  type RefreshSubscriptionJob,
} from './queues';
import { listRefreshableSubscriptionIds, refreshSubscription } from './refresh';

/**
 * The feed-refresh handlers (M25), registered from `server/jobs/index.ts`
 * alongside the Google ones.
 *
 * Small on purpose, like their Google counterparts: find the rows, call the
 * engine, let pg-boss own the retry. The one difference is what counts as a
 * failure — `refreshSubscription` returns `{ status: 'failed' }` for anything
 * the *publisher* did and writes it onto the row, so nothing thrown here means
 * "a school server is unreachable" and a throw genuinely is our own fault.
 */

export async function enqueueSubscriptionRefresh(subscriptionId: string): Promise<string | null> {
  return enqueue(
    icsQueueName(ICS_QUEUE.refreshSubscription),
    { subscriptionId } satisfies RefreshSubscriptionJob,
    { singletonKey: refreshSingletonKey(subscriptionId), retryLimit: 2, retryBackoff: true }
  );
}

/**
 * The `ics:refresh` job body, exported for the same reason `runPoll` is: a test
 * can drive it against a real Postgres with the `enqueue()` boundary faked.
 */
export async function runIcsRefresh(): Promise<void> {
  for (const id of await listRefreshableSubscriptionIds()) {
    await enqueueSubscriptionRefresh(id);
  }
}

/** Creates every queue with its policy. Idempotent — pg-boss upserts. */
export async function createIcsQueues(boss: PgBoss): Promise<void> {
  for (const definition of ICS_QUEUE_DEFINITIONS) {
    await boss.createQueue(icsQueueName(definition.name), {
      policy: definition.policy ?? 'standard',
      retryLimit: definition.retryLimit,
      retryBackoff: definition.retryBackoff,
    });
  }
}

export async function registerIcsJobs(boss: PgBoss): Promise<void> {
  await createIcsQueues(boss);

  await boss.work<RefreshSubscriptionJob>(
    icsQueueName(ICS_QUEUE.refreshSubscription),
    async (jobs) => {
      for (const job of jobs) {
        await refreshSubscription(job.data.subscriptionId);
      }
    }
  );

  await boss.work(icsQueueName(ICS_QUEUE.refresh), runIcsRefresh);

  for (const definition of ICS_QUEUE_DEFINITIONS) {
    if (!definition.cron) continue;
    await boss.schedule(
      icsQueueName(definition.name),
      definition.cron,
      {},
      { key: icsQueueName(definition.name) }
    );
  }
}
