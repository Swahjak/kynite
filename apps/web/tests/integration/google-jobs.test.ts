import { PgBoss } from 'pg-boss';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { QUEUE, queueName } from '@/modules/google/queues';
import { createTestDb, databaseUrl } from './support/db';

/**
 * The job registry against a real pg-boss (docs/architecture.md §5 "Renewal +
 * fallback", §10 "One process; jobs in-process").
 *
 * The unit suite asserts the *declarations*; this asserts that pg-boss accepts
 * them — that `stately` is a real policy, that the crons parse, and that a
 * `google:sync-calendar` job is deduplicated per calendar. Runs in its own
 * schema so it never touches an application queue, and drops it afterwards.
 */
describe.skipIf(!databaseUrl)('google jobs (integration)', () => {
  const SCHEMA = 'pgboss_m05_test';
  const { pool, db } = createTestDb();

  let boss: PgBoss;

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

    boss = new PgBoss({ connectionString: databaseUrl, schema: SCHEMA, max: 2 });
    boss.on('error', () => {});
    await boss.start();

    const { registerGoogleJobs } = await import('@/modules/google/jobs');
    await registerGoogleJobs(boss);
  }, 60_000);

  afterAll(async () => {
    await boss?.stop({ graceful: false });
    await db.execute(sql.raw(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`));
    await pool.end();
  });

  it('creates every queue with its policy and retry configuration', async () => {
    const queues = await boss.getQueues();
    const byName = new Map(queues.map((queue) => [queue.name, queue]));

    for (const name of Object.values(QUEUE)) {
      expect(byName.has(queueName(name)), `queue ${name} was not created`).toBe(true);
    }

    const sync = byName.get(queueName(QUEUE.syncCalendar))!;
    // One job per state per singletonKey: a webhook storm for one calendar
    // collapses to "running + one queued".
    expect(sync.policy).toBe('stately');
    expect(sync.retryLimit).toBe(5);
    expect(sync.retryBackoff).toBe(true);
  });

  it('schedules the polling, renewal and refresh crons', async () => {
    const schedules = await boss.getSchedules();
    const cron = new Map(schedules.map((schedule) => [schedule.name, schedule.cron]));

    expect(cron.get(queueName(QUEUE.poll))).toBe('*/15 * * * *');
    expect(cron.get(queueName(QUEUE.renewChannels))).toBe('*/30 * * * *');
    expect(cron.get(queueName(QUEUE.refreshTokens))).toBe('*/15 * * * *');
    // Event-driven queues are never scheduled.
    expect(cron.has(queueName(QUEUE.syncCalendar))).toBe(false);
    expect(cron.has(queueName(QUEUE.pushEvent))).toBe(false);
  });

  it('deduplicates queued sync jobs per calendar', async () => {
    const calendarId = '11111111-1111-4111-8111-111111111111';
    const other = '22222222-2222-4222-8222-222222222222';

    const queue = queueName(QUEUE.syncCalendar);
    const first = await boss.send(queue, { calendarId }, { singletonKey: calendarId });
    const duplicate = await boss.send(queue, { calendarId }, { singletonKey: calendarId });
    const different = await boss.send(queue, { calendarId: other }, { singletonKey: other });

    expect(first).toBeTruthy();
    // Same calendar, already queued: pg-boss refuses the second.
    expect(duplicate).toBeNull();
    // A different calendar is unaffected — the singleton is per calendar.
    expect(different).toBeTruthy();
  });
});
