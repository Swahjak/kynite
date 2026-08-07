import 'server-only';
import type { PgBoss } from 'pg-boss';
import { enqueue } from '@/server/jobs/boss';
import { isPushConfigured } from './config';
import { redemptionRequestPayload, reminderPayload } from './copy';
import { dueReminders, minutesUntil } from './domain/reminder-window';
import {
  QUEUE,
  QUEUE_DEFINITIONS,
  queueName,
  reminderKey,
  type PushPayload,
  type PushSendJob,
  type ReminderDispatchJob,
} from './queues';
import {
  applyDeliveryOutcome,
  claimReminderDispatch,
  getFamilyLocale,
  getNotificationPreferences,
  getPushSubscription,
  getReminderRoutine,
  listActiveSubscriptions,
  listRedemptionRecipients,
  listScannableFamilies,
} from './queries';
import { sendToSubscription, type PushTransport } from './send';

/**
 * The reminder and push job handlers (docs/architecture.md §6, §8, M11).
 *
 * Three queues, each doing one thing:
 *
 *   `reminders:scan`     — every minute, 90s look-ahead, enqueue dispatches
 *   `reminders:dispatch` — claim the idempotency key, fan out to the *owner*
 *   `push:send`          — **one job per endpoint** (§8), so a dead phone
 *                          cannot block the household's other devices
 *
 * The fan-out shape is the load-bearing decision here. A single "notify these
 * five devices" job would retry all five when one endpoint times out, and
 * would leave four parents un-notified while pg-boss backed off on the fifth.
 * One job per endpoint means a broken device costs exactly its own retries.
 */

export async function enqueueReminderDispatch(job: ReminderDispatchJob): Promise<string | null> {
  // `queueName()`, not the bare colon form — pg-boss rejects `:` in queue
  // names. Same adapter, same reason as `modules/google/jobs.ts`.
  return enqueue(queueName(QUEUE.remindersDispatch), job, {
    singletonKey: reminderKey(job),
    retryLimit: 3,
    retryBackoff: true,
  });
}

export async function enqueuePushSend(job: PushSendJob): Promise<string | null> {
  return enqueue(queueName(QUEUE.pushSend), job, {
    // The endpoint's row id: two notifications for one device serialise
    // instead of racing, and a storm collapses per device rather than
    // globally.
    singletonKey: job.subscriptionId,
    retryLimit: 3,
    retryBackoff: true,
  });
}

/**
 * Fan a payload out to every live endpoint of every listed member — one
 * `push:send` job each (§8).
 *
 * Returns the number of jobs enqueued, which is the number of *endpoints*, not
 * of members: two parents with three phones between them is three jobs.
 */
export async function fanOutPush(
  familyId: string,
  memberIds: readonly string[],
  payload: PushPayload
): Promise<number> {
  const subscriptions = await listActiveSubscriptions(familyId, memberIds);

  for (const subscription of subscriptions) {
    await enqueuePushSend({ subscriptionId: subscription.id, payload });
  }

  return subscriptions.length;
}

/**
 * `redemption:request` → every adult (§6 step 4: "Redemption requests fan out
 * to all adults").
 *
 * Deliberately best-effort and never awaited into the request's critical path
 * by its caller: a child's "may I spend my stars" must not fail because a
 * queue is briefly unavailable. The request itself is already committed and
 * already on the hub via `publish()`.
 */
export async function notifyRedemptionRequested(input: {
  familyId: string;
  redemptionId: string;
  childName: string;
  rewardTitle: string;
}): Promise<number> {
  if (!isPushConfigured()) return 0;

  // Not *every* adult since M16 — every adult who has not switched this
  // notification off. The filter is in the query rather than here so the
  // absent-row default ("on") is evaluated by the database with everything
  // else (`listRedemptionRecipients`).
  const adults = await listRedemptionRecipients(input.familyId);
  if (adults.length === 0) return 0;

  const payload = await redemptionRequestPayload({
    locale: await getFamilyLocale(input.familyId),
    childName: input.childName,
    rewardTitle: input.rewardTitle,
    redemptionId: input.redemptionId,
  });

  return fanOutPush(input.familyId, adults, payload);
}

/**
 * The `reminders:scan` body (§8: cron `* * * * *`, 90s look-ahead).
 *
 * A minute's cadence against a 90s window means a reminder reaches a phone
 * about a minute before the routine starts (`LOOK_AHEAD_MS` has the arithmetic)
 * — not five, and not a per-routine offset, neither of which exists yet.
 *
 * Exported rather than inlined below so an integration test can drive it
 * against a real Postgres with a frozen clock and a capturing `enqueue`,
 * exactly as `modules/google/jobs.ts` does for `runPoll`.
 */
export async function runRemindersScan(
  now: Date = new Date(),
  enqueueDispatch: (job: ReminderDispatchJob) => Promise<unknown> = enqueueReminderDispatch
): Promise<number> {
  let enqueued = 0;

  for (const family of await listScannableFamilies()) {
    for (const due of dueReminders(family.routines, now, family.timeZone)) {
      await enqueueDispatch({
        familyId: due.familyId,
        routineId: due.routineId,
        occurrenceDate: due.occurrenceDate,
        memberId: due.memberId,
        dueAt: due.dueAt.toISOString(),
      });
      enqueued += 1;
    }
  }

  return enqueued;
}

/**
 * The `reminders:dispatch` body.
 *
 * Order matters and is the whole point of the criterion "a restart cannot
 * double-notify": the idempotency key is *claimed first*. If the process dies
 * between the claim and the send, the reminder is lost — and that is the
 * correct trade for a household. A lost "shoes on in a minute" is invisible;
 * a duplicated one is the nagging this product exists to remove.
 *
 * `memberId` on the job is the routine's `ownerMemberId`, and it is re-read
 * from the routine here rather than trusted from the job payload: a routine
 * re-assigned between scan and dispatch must notify its new owner, and the
 * criterion is "routes to `ownerMemberId`, **never the creator**", which is
 * only guaranteed if the owner is read from the routine.
 */
export async function runReminderDispatch(
  job: ReminderDispatchJob,
  now: Date = new Date()
): Promise<number> {
  if (!isPushConfigured()) return 0;

  const routine = await getReminderRoutine(job.familyId, job.routineId);
  if (!routine) return 0;

  const memberId = routine.ownerMemberId;

  /**
   * The recipient's own preference, checked **before** the idempotency key is
   * claimed (M16).
   *
   * Order matters, and it is the opposite of the claim-before-send rule right
   * below. Claiming first and then discarding would burn the key for this
   * occurrence, so a parent who switches reminders back on ten seconds later
   * would silently get nothing for the rest of the day — the ledger would say
   * "already sent". Not claiming means the scan's second pass re-evaluates the
   * preference, which is what a *preference* should do.
   */
  const preferences = await getNotificationPreferences(job.familyId, memberId);
  if (!preferences.routineReminders) return 0;

  const claimed = await claimReminderDispatch({
    familyId: job.familyId,
    routineId: job.routineId,
    occurrenceDate: job.occurrenceDate,
    memberId,
  });
  if (!claimed) return 0;

  const payload = await reminderPayload({
    locale: await getFamilyLocale(job.familyId),
    routineTitle: routine.title,
    minutes: minutesUntil(new Date(job.dueAt), now),
    routineId: job.routineId,
    occurrenceDate: job.occurrenceDate,
    memberId,
  });

  return fanOutPush(job.familyId, [memberId], payload);
}

/**
 * The `push:send` body — one endpoint, one attempt, one policy application.
 *
 * The handler does **not** throw on a delivery failure. Letting pg-boss retry
 * a 410 would burn three attempts to reach a subscription we already know is
 * gone, and `applyDeliveryOutcome` has already deleted the row by then. What
 * pg-boss's retries are for is *our* failures — a database blip — which do
 * still throw.
 */
export async function runPushSend(
  job: PushSendJob,
  transport?: PushTransport
): Promise<'sent' | 'skipped' | 'failed'> {
  const subscription = await getPushSubscription(job.subscriptionId);
  if (!subscription || subscription.disabledAt) return 'skipped';

  const outcome = await sendToSubscription(
    {
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
    job.payload,
    transport
  );

  await applyDeliveryOutcome(subscription.id, outcome);

  return outcome === 'success' ? 'sent' : 'failed';
}

/** Creates every queue with its policy. Idempotent — pg-boss upserts. */
export async function createNotificationQueues(boss: PgBoss): Promise<void> {
  for (const definition of QUEUE_DEFINITIONS) {
    await boss.createQueue(queueName(definition.name), {
      policy: definition.policy ?? 'standard',
      retryLimit: definition.retryLimit,
      retryBackoff: definition.retryBackoff,
    });
  }
}

/** Registers workers and the cron schedule. Called once, from instrumentation. */
export async function registerNotificationJobs(boss: PgBoss): Promise<void> {
  await createNotificationQueues(boss);

  await boss.work(queueName(QUEUE.remindersScan), async () => {
    // No keypair means no reachable device; scanning would only produce
    // dispatch jobs that all no-op.
    if (!isPushConfigured()) return;
    await runRemindersScan();
  });

  await boss.work<ReminderDispatchJob>(queueName(QUEUE.remindersDispatch), async (jobs) => {
    for (const job of jobs) await runReminderDispatch(job.data);
  });

  await boss.work<PushSendJob>(queueName(QUEUE.pushSend), async (jobs) => {
    for (const job of jobs) await runPushSend(job.data);
  });

  for (const definition of QUEUE_DEFINITIONS) {
    if (!definition.cron) continue;
    await boss.schedule(
      queueName(definition.name),
      definition.cron,
      {},
      { key: queueName(definition.name) }
    );
  }
}
