/**
 * Queue names, policies and schedules (docs/architecture.md §5 "Renewal +
 * fallback", milestone M05).
 *
 * Declarative and dependency-free so the definitions can be asserted in the
 * unit suite without a database — the cadences are a contract, not an
 * implementation detail.
 */

export const QUEUE = {
  syncCalendar: 'google:sync-calendar',
  poll: 'google:poll',
  renewChannels: 'google:renew-channels',
  refreshTokens: 'google:refresh-tokens',
  pushEvent: 'google:push-event',
} as const;

export type QueueName = (typeof QUEUE)[keyof typeof QUEUE];

export type QueueDefinition = {
  name: QueueName;
  /**
   * pg-boss queue policy. `stately` is the singleton family extended with
   * `singletonKey`: at most one job *per state* per key, so a webhook storm for
   * one calendar collapses to "the running sync plus one queued follow-up"
   * instead of a hundred redundant passes.
   */
  policy?: 'standard' | 'stately';
  retryLimit: number;
  retryBackoff: boolean;
  /** Cron cadence for scheduled queues; absent for event-driven ones. */
  cron?: string;
};

/** §5: sync jobs retry 5× with exponential backoff — Google rate-limits hard. */
export const QUEUE_DEFINITIONS: QueueDefinition[] = [
  {
    name: QUEUE.syncCalendar,
    policy: 'stately',
    retryLimit: 5,
    retryBackoff: true,
  },
  {
    name: QUEUE.poll,
    policy: 'stately',
    retryLimit: 3,
    retryBackoff: true,
    cron: '*/15 * * * *',
  },
  {
    name: QUEUE.renewChannels,
    policy: 'stately',
    retryLimit: 3,
    retryBackoff: true,
    cron: '*/30 * * * *',
  },
  {
    name: QUEUE.refreshTokens,
    policy: 'stately',
    retryLimit: 3,
    retryBackoff: true,
    cron: '*/15 * * * *',
  },
  {
    name: QUEUE.pushEvent,
    policy: 'stately',
    retryLimit: 5,
    retryBackoff: true,
  },
];

/**
 * pg-boss 12 restricts queue names to alphanumerics, `_`, `-`, `.` and `/` —
 * the `:` in the documented names (docs/architecture.md §5, milestone M05) is
 * not accepted. The colon-form stays the vocabulary of the codebase, the docs
 * and the tests; this is the one-line adapter at the pg-boss boundary, so
 * `google:sync-calendar` is stored as `google.sync-calendar`.
 */
export function queueName(name: QueueName): string {
  return name.replace(':', '.');
}

export type SyncCalendarJob = { calendarId: string };
export type PushEventJob = { eventId: string };

/** One sync in flight per calendar (M05: "singleton per calendarId"). */
export function syncSingletonKey(calendarId: string): string {
  return calendarId;
}
