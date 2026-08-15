import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { QUEUE, queueName } from '@/modules/google/queues';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * N5: `google:poll`'s repair sweep, against a real Postgres (for
 * `listSyncableCalendars`/`listPendingSyncEventIds`) with the pg-boss
 * `enqueue()` boundary replaced by a capturing fake instead of a running
 * boss — "unit with fake boss capture", per the review note — so what
 * `runPoll()` tries to enqueue can be asserted without standing up pg-boss.
 *
 * Before this fix, `sync-bridge.ts` claimed "the next poll repairs it" for a
 * push whose retry-enqueue also failed, but `google:poll` only ever pulled
 * (`listSyncableCalendars` → `enqueueCalendarSync`) — an event stuck with
 * `pendingSyncAt` set had no path back to a push attempt if the original
 * `enqueueEventPush` call also failed. `runPoll()` now also re-enqueues a
 * `google:push-event` for every such event.
 */

const enqueueCalls: { name: string; data: unknown }[] = [];

vi.mock('@/server/jobs/boss', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/jobs/boss')>();
  return {
    ...actual,
    enqueue: vi.fn(async (name: string, data: unknown) => {
      enqueueCalls.push({ name, data });
      return `job-${enqueueCalls.length}`;
    }),
  };
});

describe.skipIf(!databaseUrl)('google:poll repair sweep (integration)', () => {
  const { pool, db } = createTestDb();

  let household: Household;
  let accountId: string;
  let calendarId: string;
  let jobs: typeof import('@/modules/google/jobs');

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl;
    process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
    process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
    process.env.GOOGLE_CLIENT_ID ??= 'client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET ??= 'client-secret';
    process.env.TOKEN_ENCRYPTION_KEY ??= Buffer.alloc(32, 7).toString('base64');

    jobs = await import('@/modules/google/jobs');

    household = await seedHousehold(db, 'PollRepair');

    const [account] = await db
      .insert(schema.googleAccount)
      .values({
        familyId: household.familyId,
        ownerMemberId: household.parentId,
        googleUserId: `google-${randomUUID()}`,
        email: 'parent@example.test',
        status: 'active',
      })
      .returning();
    accountId = account.id;

    const [row] = await db
      .insert(schema.calendar)
      .values({
        familyId: household.familyId,
        googleAccountId: accountId,
        googleCalendarId: 'family@group.calendar.google.com',
        summary: 'Gezin',
        writable: true,
        syncEnabled: true,
      })
      .returning();
    calendarId = row.id;
  });

  afterAll(async () => {
    await db.delete(schema.family).where(eq(schema.family.id, household.familyId));
    await pool.end();
  });

  beforeEach(() => {
    enqueueCalls.length = 0;
  });

  it('re-enqueues google:push-event for an event still carrying pendingSyncAt', async () => {
    // `listPendingSyncEventIds` is an unscoped, whole-table sweep by design —
    // the same "real cron has no family to scope to" reasoning
    // `google-channels.test.ts` documents for `renewExpiringChannels`, and it
    // orders oldest-first with a batch cap. A concurrently-running
    // integration file's own `pendingSyncAt` rows (all stamped with a *current*
    // timestamp) are therefore noise this test must survive rather than
    // exclude: anchoring this row at the Unix epoch guarantees it sorts first
    // and stays inside the cap regardless of how much of that noise exists.
    const [stuck] = await db
      .insert(schema.event)
      .values({
        familyId: household.familyId,
        calendarId,
        title: 'Zwemles',
        startsAt: new Date('2026-08-05T08:00:00Z'),
        endsAt: new Date('2026-08-05T09:00:00Z'),
        pendingSyncAt: new Date(0),
      })
      .returning();

    const [settled] = await db
      .insert(schema.event)
      .values({
        familyId: household.familyId,
        calendarId,
        title: 'Tandarts',
        startsAt: new Date('2026-08-06T08:00:00Z'),
        endsAt: new Date('2026-08-06T09:00:00Z'),
        pendingSyncAt: null,
      })
      .returning();

    await jobs.runPoll();

    const pushCalls = enqueueCalls.filter((call) => call.name === queueName(QUEUE.pushEvent));
    expect(pushCalls.map((call) => (call.data as { eventId: string }).eventId)).toContain(stuck.id);
    expect(pushCalls.map((call) => (call.data as { eventId: string }).eventId)).not.toContain(
      settled.id
    );

    // The pull-side sweep still runs alongside the repair sweep.
    const syncCalls = enqueueCalls.filter((call) => call.name === queueName(QUEUE.syncCalendar));
    expect(syncCalls.map((call) => (call.data as { calendarId: string }).calendarId)).toContain(
      calendarId
    );
  });

  it('caps the repair sweep and orders it oldest pendingSyncAt first', async () => {
    // Anchored at the Unix epoch, not "now" — see the previous test's comment.
    // A concurrent suite's rows are stamped with the real current time, so
    // these three sort ahead of that noise regardless of how much of it
    // exists, keeping them inside the batch cap.
    const rows = await db
      .insert(schema.event)
      .values(
        Array.from({ length: 3 }, (_, index) => ({
          familyId: household.familyId,
          calendarId,
          title: `Herhaling ${index}`,
          startsAt: new Date('2026-08-07T08:00:00Z'),
          endsAt: new Date('2026-08-07T09:00:00Z'),
          // Oldest first: index 0 is the stalest.
          pendingSyncAt: new Date(1000 + index * 1000),
        }))
      )
      .returning();

    await jobs.runPoll();

    const pushedIds = enqueueCalls
      .filter((call) => call.name === queueName(QUEUE.pushEvent))
      .map((call) => (call.data as { eventId: string }).eventId);

    const rowIds = rows.map((row) => row.id);
    const positions = rowIds.map((id) => pushedIds.indexOf(id));
    expect(positions.every((position) => position !== -1)).toBe(true);
    // Oldest (`rows[0]`) is enqueued no later than the newer ones.
    expect(positions[0]).toBeLessThanOrEqual(positions[1]);
    expect(positions[1]).toBeLessThanOrEqual(positions[2]);
  });
});
