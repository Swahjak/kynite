import 'server-only';
import type { PgBoss } from 'pg-boss';
import { retentionCutoff, trimEventLog } from '@/modules/realtime';
import { trimFinishedTimers } from '@/modules/timers';
import { trimReminderDispatch } from '@/modules/notifications';

/**
 * `maintenance:trim` (docs/architecture.md §8: "cron nightly — trim
 * `event_log` >7d, pg-boss archive, stale device sessions").
 *
 * It lives here rather than in a slice because it is not any one slice's
 * concern: it is the install's hygiene pass, and each slice contributes one
 * bounded delete through its own public surface. M10 shipped `RETENTION_DAYS`
 * with no caller — this is the job that makes it true, and without it a hub
 * that reconnects after a long gap can never take the `resync` branch, because
 * nothing ever falls out of the log.
 *
 * Device sessions are named in §8 but have no table until M12; the trim gains
 * a line there rather than pretending to prune something that does not exist.
 */

export const MAINTENANCE_QUEUE = 'maintenance:trim';

/** 03:20 local: after the nightly hub-reload window opens, hours from any routine. */
export const MAINTENANCE_CRON = '20 3 * * *';

/**
 * Reminder-dispatch rows are the idempotency ledger, not history: a key older
 * than a couple of days can never be claimed again (the occurrence is long
 * past), so keeping it only grows an index.
 */
export const REMINDER_LEDGER_RETENTION_DAYS = 14;

/**
 * Finished timers older than this are deleted. Running ones never are — they
 * are *stopped* at the time they would have ended once they fall outside the
 * board's 24h window, so an abandoned row stops blocking its routine step
 * (`trimFinishedTimers`).
 */
export const TIMER_RETENTION_DAYS = 30;

export type TrimResult = {
  eventLog: number;
  reminderDispatch: number;
  timers: number;
};

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

/**
 * The job body, exported so an integration test can drive it against a real
 * Postgres with a frozen clock instead of needing a running boss.
 */
export async function runMaintenanceTrim(now: Date = new Date()): Promise<TrimResult> {
  return {
    eventLog: await trimEventLog(retentionCutoff(now)),
    reminderDispatch: await trimReminderDispatch(daysAgo(now, REMINDER_LEDGER_RETENTION_DAYS)),
    timers: await trimFinishedTimers(daysAgo(now, TIMER_RETENTION_DAYS), now),
  };
}

export async function registerMaintenanceJobs(boss: PgBoss): Promise<void> {
  await boss.createQueue(MAINTENANCE_QUEUE.replace(':', '.'), {
    policy: 'stately',
    retryLimit: 3,
    retryBackoff: true,
  });

  await boss.work(MAINTENANCE_QUEUE.replace(':', '.'), async () => {
    await runMaintenanceTrim();
  });

  await boss.schedule(
    MAINTENANCE_QUEUE.replace(':', '.'),
    MAINTENANCE_CRON,
    {},
    {
      key: MAINTENANCE_QUEUE.replace(':', '.'),
    }
  );
}
