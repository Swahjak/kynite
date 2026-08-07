import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * Reminder scan and dispatch, running for real (M11).
 *
 * Two criteria live here, and they are the two that a household would notice
 * if they broke:
 *
 *  - **routing**: a reminder goes to the routine's `ownerMemberId`, *never*
 *    to whoever created it (PRD FR10, research §Decisions 10). Getting this
 *    wrong reproduces the exact failure the product exists to fix — the
 *    parent who set everything up also receives everything about it.
 *  - **idempotency**: "a restart cannot double-notify" (§8). The look-ahead is
 *    90s on a 60s cadence, so every occurrence is seen at least twice *by
 *    design*; the unique index on `(routine, occurrence date, member)` is
 *    what turns that into one notification. This suite kills the process
 *    between the claim and the send and proves the replay stays silent.
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
  enqueued: [] as { name: string; data: unknown; options: unknown }[],
  /**
   * Set to make the *send* half of a dispatch die (see the restart test). The
   * queue hand-off is the first thing that happens after the claim is written
   * and the last thing `runReminderDispatch` does, so failing it is exactly
   * "the process got as far as claiming and no further".
   */
  failPushSend: false,
}));

vi.mock('@/server/db', () => ({ getDb: () => stubs.db }));
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
  Link: () => null,
  usePathname: () => '/',
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

vi.mock('@/server/jobs/boss', () => ({
  enqueue: async (name: string, data: unknown, options: unknown) => {
    if (stubs.failPushSend && name === 'push.send') {
      throw new Error('push queue unreachable');
    }
    stubs.enqueued.push({ name, data, options });
    return randomUUID();
  },
}));

process.env.BETTER_AUTH_SECRET ??= 'x'.repeat(32);
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.VAPID_PUBLIC_KEY ??= 'test-public-key';
process.env.VAPID_PRIVATE_KEY ??= 'test-private-key';

const { runReminderDispatch, runRemindersScan, upsertPushSubscription } =
  await import('@/modules/notifications');

vi.setConfig({ testTimeout: 30_000 });

/** `07:30` Amsterdam on 10 March 2026 is `06:30Z`. */
const DUE_AT = new Date('2026-03-10T06:30:00Z');
const OCCURRENCE_DATE = '2026-03-10';

describe.skipIf(!databaseUrl)('reminders (integration)', () => {
  const { pool, db } = createTestDb();
  const { family, pushSubscription, reminderDispatch, routine } = schema;

  let household: Household;
  let routineId: string;

  beforeAll(async () => {
    stubs.db = db;
    household = await seedHousehold(db, 'Reminders');

    const [row] = await db
      .insert(routine)
      .values({
        familyId: household.familyId,
        // The child owns the routine; the *parent* created it. Everything
        // below turns on the difference.
        ownerMemberId: household.childId,
        title: 'Schoenen aan',
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '07:30' },
        // Anchors the series well before the instants under test.
        createdAt: new Date('2026-01-01T06:00:00Z'),
      })
      .returning({ id: routine.id });

    routineId = row.id;
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
    await pool.end();
  });

  beforeEach(async () => {
    stubs.enqueued.length = 0;
    stubs.failPushSend = false;
    await db.delete(reminderDispatch).where(eq(reminderDispatch.familyId, household.familyId));
    await db.delete(pushSubscription).where(eq(pushSubscription.familyId, household.familyId));
  });

  const dispatchJobs = () => stubs.enqueued.filter((job) => job.name === 'reminders.dispatch');
  const pushJobs = () => stubs.enqueued.filter((job) => job.name === 'push.send');

  const ledger = () =>
    db.select().from(reminderDispatch).where(eq(reminderDispatch.familyId, household.familyId));

  describe('scan', () => {
    it('enqueues a dispatch for an occurrence inside the look-ahead', async () => {
      await runRemindersScan(new Date(DUE_AT.getTime() - 60_000));

      const jobs = dispatchJobs().filter(
        (job) => (job.data as { routineId: string }).routineId === routineId
      );
      expect(jobs).toHaveLength(1);
      expect(jobs[0].data).toMatchObject({
        familyId: household.familyId,
        routineId,
        occurrenceDate: OCCURRENCE_DATE,
        // The owner, resolved from the routine — not the creator.
        memberId: household.childId,
      });
    });

    it('enqueues nothing when the occurrence is still beyond the window', async () => {
      await runRemindersScan(new Date(DUE_AT.getTime() - 120_000));

      expect(
        dispatchJobs().filter((job) => (job.data as { routineId: string }).routineId === routineId)
      ).toHaveLength(0);
    });

    it('keys the job so two overlapping scans collapse to one queue slot', async () => {
      await runRemindersScan(new Date(DUE_AT.getTime() - 89_000));
      await runRemindersScan(new Date(DUE_AT.getTime() - 29_000));

      const jobs = dispatchJobs().filter(
        (job) => (job.data as { routineId: string }).routineId === routineId
      );
      expect(jobs).toHaveLength(2);

      const keys = jobs.map((job) => (job.options as { singletonKey: string }).singletonKey);
      expect(new Set(keys).size).toBe(1);
      expect(keys[0]).toBe(`${routineId}:${OCCURRENCE_DATE}:${household.childId}`);
    });
  });

  describe('dispatch', () => {
    const job = () => ({
      familyId: household.familyId,
      routineId,
      occurrenceDate: OCCURRENCE_DATE,
      // Deliberately *wrong* in the payload — the parent, who created the
      // routine. `runReminderDispatch` must ignore it and re-read the owner.
      memberId: household.parentId,
      dueAt: DUE_AT.toISOString(),
    });

    const subscribeOwner = () =>
      upsertPushSubscription({
        familyId: household.familyId,
        memberId: household.childId,
        endpoint: 'https://push.example/owner-device',
        p256dh: 'p',
        auth: 'a',
      });

    it('routes to the routine owner even when the job payload names the creator', async () => {
      await subscribeOwner();

      const sent = await runReminderDispatch(job(), new Date(DUE_AT.getTime() - 300_000));

      expect(sent).toBe(1);
      const [row] = await ledger();
      expect(row.memberId).toBe(household.childId);
      expect(row.memberId).not.toBe(household.parentId);
    });

    it('sends nothing when the owner has no device — and blames nobody for it', async () => {
      // The parent has a phone; the owner does not. Nothing is redirected.
      await upsertPushSubscription({
        familyId: household.familyId,
        memberId: household.parentId,
        endpoint: 'https://push.example/creator-device',
        p256dh: 'p',
        auth: 'a',
      });

      expect(await runReminderDispatch(job(), DUE_AT)).toBe(0);
      expect(pushJobs()).toHaveLength(0);
    });

    it('writes the idempotency key §8 specifies', async () => {
      await subscribeOwner();
      await runReminderDispatch(job(), DUE_AT);

      const rows = await db
        .select()
        .from(reminderDispatch)
        .where(
          and(
            eq(reminderDispatch.routineId, routineId),
            eq(reminderDispatch.occurrenceDate, OCCURRENCE_DATE),
            eq(reminderDispatch.memberId, household.childId)
          )
        );

      expect(rows).toHaveLength(1);
    });

    it('a second dispatch of the same occurrence notifies nobody', async () => {
      await subscribeOwner();

      expect(await runReminderDispatch(job(), DUE_AT)).toBe(1);
      stubs.enqueued.length = 0;

      expect(await runReminderDispatch(job(), DUE_AT)).toBe(0);
      expect(pushJobs()).toHaveLength(0);
      expect(await ledger()).toHaveLength(1);
    });

    /**
     * The criterion in full: "a restart cannot double-notify".
     *
     * The claim is written *before* the send, so a crash in between loses the
     * notification rather than duplicating it. The crash is *injected*, which
     * is the whole point — a version of this test that simply calls the
     * function twice proves only that the second call is idempotent, not that
     * the first one died where the argument says it dies.
     *
     * The injection point is the queue hand-off: `runReminderDispatch` claims,
     * then enqueues one `push.send` per endpoint, and that enqueue is the last
     * thing it does. Failing it puts the process on the floor after the claim
     * is durable and before any device could have been reached — which is the
     * window the ordering exists to make safe.
     */
    it('a restart between claim and send loses the reminder and never doubles it', async () => {
      await subscribeOwner();

      // Attempt one: claims the key, then dies before the push service is
      // ever reached.
      stubs.failPushSend = true;
      await expect(runReminderDispatch(job(), DUE_AT)).rejects.toThrow('push queue unreachable');

      // The claim survived the crash — that is what makes the replay silent.
      expect(await ledger()).toHaveLength(1);
      // And nothing was sent: the notification is genuinely lost, not queued.
      expect(pushJobs()).toHaveLength(0);

      // The queue redelivers the job to a *new*, healthy process. Nothing about
      // the in-memory state of the old one survives; only the row does.
      stubs.failPushSend = false;
      stubs.enqueued.length = 0;
      const replay = await runReminderDispatch(job(), DUE_AT);

      expect(replay).toBe(0);
      // Zero pushes across both attempts, one ledger row, no duplicate.
      expect(pushJobs()).toHaveLength(0);
      expect(await ledger()).toHaveLength(1);
    });

    it('still notifies for the next day’s occurrence', async () => {
      await subscribeOwner();
      await runReminderDispatch(job(), DUE_AT);
      stubs.enqueued.length = 0;

      // The key includes the occurrence date, so tomorrow is a fresh claim.
      const tomorrow = await runReminderDispatch(
        { ...job(), occurrenceDate: '2026-03-11', dueAt: '2026-03-11T06:30:00Z' },
        new Date('2026-03-11T06:25:00Z')
      );

      expect(tomorrow).toBe(1);
      expect(await ledger()).toHaveLength(2);
    });

    it('carries the neutral board copy, not an instruction', async () => {
      await subscribeOwner();
      // A minute out — the lead the 90s look-ahead on a 60s cadence actually
      // produces. There is no five-minute warning and no per-routine offset;
      // the body states the number it computed.
      await runReminderDispatch(job(), new Date(DUE_AT.getTime() - 60_000));

      const [push] = pushJobs();
      const payload = (push.data as { payload: { title: string; body: string; tag: string } })
        .payload;

      expect(payload.title).toBe('Schoenen aan');
      // "Schoenen aan over 1 minuut" — a statement about the schedule.
      expect(payload.body).toBe('Schoenen aan over 1 minuut');
      expect(payload.body).not.toMatch(/!|vergeet|mama|papa/i);
      expect(payload.tag).toBe(`reminder:${routineId}:${OCCURRENCE_DATE}:${household.childId}`);
    });

    it('does nothing for a routine from another household', async () => {
      const elsewhere = await seedHousehold(db, 'Reminders elders');
      try {
        const sent = await runReminderDispatch({ ...job(), familyId: elsewhere.familyId }, DUE_AT);

        // The routine lookup is family-scoped, so a forged familyId addresses
        // nothing at all.
        expect(sent).toBe(0);
        expect(await ledger()).toHaveLength(0);
      } finally {
        await db.delete(family).where(eq(family.id, elsewhere.familyId));
      }
    });
  });
});
