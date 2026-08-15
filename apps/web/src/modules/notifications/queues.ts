/**
 * Notification and maintenance queue names, policies and schedules
 * (docs/architecture.md §8 "Jobs & queues", milestone M11).
 *
 * Declarative and dependency-free, the same shape as `modules/google/queues.ts`
 * — the cadences are a contract the unit suite asserts without a database.
 */

export const QUEUE = {
  /** §8: cron `* * * * *`, find due routines/events, enqueue dispatch. */
  remindersScan: 'reminders:scan',
  /** §8: from scan, route the reminder to the **owner** member. */
  remindersDispatch: 'reminders:dispatch',
  /** §8: fan-out, one job per subscription endpoint. */
  pushSend: 'push:send',
} as const;

// §8's fourth queue, `maintenance:trim`, is not a notifications concern and
// lives in `src/server/jobs/maintenance.ts` with the same shape.

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

export type QueueDefinition = {
  name: QueueName;
  policy?: 'standard' | 'stately';
  retryLimit: number;
  retryBackoff: boolean;
  cron?: string;
};

/**
 * `stately` throughout, matching the Google queues: at most one job per state
 * per `singletonKey`. For `reminders:dispatch` and `push:send` the key is the
 * unit of work itself (the reminder key; the endpoint), so a scan that fires
 * twice inside one look-ahead window collapses instead of queueing twice —
 * belt to the `reminder_dispatch` unique index's braces.
 */
export const QUEUE_DEFINITIONS: QueueDefinition[] = [
  {
    name: QUEUE.remindersScan,
    policy: 'stately',
    retryLimit: 3,
    retryBackoff: true,
    // §8: every minute, with a 90s look-ahead — deliberately wider than the
    // cadence so a slow minute cannot drop an occurrence between two passes.
    cron: '* * * * *',
  },
  {
    name: QUEUE.remindersDispatch,
    policy: 'stately',
    retryLimit: 3,
    retryBackoff: true,
  },
  {
    name: QUEUE.pushSend,
    policy: 'stately',
    // §8: "3×, drop on 410". The drop is not a retry policy, it is what the
    // handler does with the response — see `recordPushFailure`.
    retryLimit: 3,
    retryBackoff: true,
  },
];

/**
 * pg-boss 12 restricts queue names to alphanumerics, `_`, `-`, `.` and `/`.
 * The colon form (`reminders:scan`) is the vocabulary of the docs, the code
 * and the tests; this is the adapter at the pg-boss boundary, byte-identical
 * in behaviour to `modules/google/queues.ts`'s. Duplicated rather than
 * imported because a slice may not deep-import another slice's non-public
 * module, and re-exporting a Google concern from here would be worse.
 */
export function queueName(name: QueueName): string {
  return name.replace(':', '.');
}

/** The idempotency key of one reminder (§8). Also the dispatch singleton key. */
export type ReminderDispatchJob = {
  familyId: string;
  routineId: string;
  /** `YYYY-MM-DD` in the family's timezone. */
  occurrenceDate: string;
  /** The routine's `ownerMemberId` — never the creator (PRD FR10). */
  memberId: string;
  /** ISO instant the occurrence is due at, for the "in N minutes" copy. */
  dueAt: string;
};

export type PushSendJob = {
  subscriptionId: string;
  payload: PushPayload;
};

/** What the service worker's `push` handler receives, verbatim. */
export type PushPayload = {
  title: string;
  body: string;
  /** Deep link into `(app)` — §6 step 5. */
  url: string;
  /** Groups replaceable notifications so a re-send never stacks. */
  tag: string;
};

export function reminderKey(
  job: Pick<ReminderDispatchJob, 'routineId' | 'occurrenceDate' | 'memberId'>
): string {
  return `${job.routineId}:${job.occurrenceDate}:${job.memberId}`;
}
