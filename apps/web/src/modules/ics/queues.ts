/**
 * Queue names, policies and schedules for subscribed feeds (M25).
 *
 * Declarative and dependency-free, exactly like `modules/google/queues.ts`, so
 * the cadence can be asserted without a database — it is a contract with the
 * publishers, not an implementation detail.
 */

export const ICS_QUEUE = {
  /** One subscription, one fetch. Enqueued by the sweep and by "Vernieuw nu". */
  refreshSubscription: 'ics:refresh-subscription',
  /** The hourly sweep that enqueues one of the above per enabled subscription. */
  refresh: 'ics:refresh',
} as const;

export type IcsQueueName = (typeof ICS_QUEUE)[keyof typeof ICS_QUEUE];

export type IcsQueueDefinition = {
  name: IcsQueueName;
  policy?: 'standard' | 'stately';
  retryLimit: number;
  retryBackoff: boolean;
  cron?: string;
};

/**
 * **Hourly, and deliberately not faster.** A school publishes its holidays once
 * a term and a sports club its fixtures once a week; polling those every
 * fifteen minutes (the Google cadence) would be four times the load on
 * somebody else's server for information that changes four times a year. The
 * conditional GET makes most of those hours a 304 anyway, and "Vernieuw nu" in
 * settings covers the one case an hour is too long for — a parent who has just
 * pasted the link.
 *
 * `:07` rather than `:00` keeps the sweep off the same minute as the Google
 * poll and the channel renewal, which both land on the hour.
 *
 * **`retryLimit: 2`, not 5.** A refresh only ever throws for a *local* fault: a
 * remote failure is caught, recorded on the row and reported as a normal
 * outcome (see `refresh.ts`), precisely so a school that is down for a day
 * cannot turn into a retry storm against its server.
 */
export const ICS_QUEUE_DEFINITIONS: IcsQueueDefinition[] = [
  {
    name: ICS_QUEUE.refreshSubscription,
    policy: 'stately',
    retryLimit: 2,
    retryBackoff: true,
  },
  {
    name: ICS_QUEUE.refresh,
    policy: 'stately',
    retryLimit: 2,
    retryBackoff: true,
    cron: '7 * * * *',
  },
];

/**
 * pg-boss 12 rejects the `:` in the documented queue names; the colon form
 * stays the vocabulary of the codebase and this is the adapter at the boundary,
 * exactly as `modules/google/queues.ts` does it.
 */
export function icsQueueName(name: IcsQueueName): string {
  return name.replace(':', '.');
}

export type RefreshSubscriptionJob = { subscriptionId: string };

/** One refresh in flight per subscription. */
export function refreshSingletonKey(subscriptionId: string): string {
  return subscriptionId;
}
