import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import {
  createTestDb,
  databaseUrl,
  expectRejection,
  seedHousehold,
  type Household,
} from './support/db';

/**
 * The timer actions, running for real (M09).
 *
 * `tests/unit/timers/countdown.test.ts` proves the clock arithmetic. What it
 * cannot prove is that a *timer* is server-authoritative in practice: that the
 * start time is stamped by the server rather than taken from the caller, that
 * a replayed start leaves one countdown rather than two, that a forged step or
 * timer id from another household addresses nothing, and that the realtime
 * event is written in the same transaction as the row. That is this file. The
 * only fakes are framework seams (session, cache, locale).
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
  session: null as { session: { activeFamilyId?: string; memberId?: string } } | null,
}));

vi.mock('@/server/db', () => ({ getDb: () => stubs.db }));
vi.mock('@/server/auth', () => ({
  getAuth: () => ({ api: { getSession: async () => stubs.session } }),
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'nl' }));
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));

const { startTimerAction, stopTimerAction } = await import('@/modules/timers/actions');

vi.setConfig({ testTimeout: 20_000 });

describe.skipIf(!databaseUrl)('timers (integration)', () => {
  const { pool, db } = createTestDb();
  const { eventLog, family, routine, routineStep, timer } = schema;

  let household: Household;
  let other: Household;
  let stepId: string;
  let otherStepId: string;

  beforeAll(async () => {
    stubs.db = db;
    household = await seedHousehold(db, 'Timers');
    other = await seedHousehold(db, 'Timers elders');

    const seedStep = async (context: Household, title: string, timerSeconds: number) => {
      const [row] = await db
        .insert(routine)
        .values({
          familyId: context.familyId,
          ownerMemberId: context.childId,
          title: 'Ochtendroutine',
          schedule: { rrule: 'FREQ=DAILY', timeOfDay: '07:30' },
        })
        .returning({ id: routine.id });

      const [step] = await db
        .insert(routineStep)
        .values({ routineId: row.id, title, sortOrder: 0, timerSeconds })
        .returning({ id: routineStep.id });

      return step.id;
    };

    stepId = await seedStep(household, 'Tanden poetsen', 120);
    otherStepId = await seedStep(other, 'Tanden poetsen', 120);
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
    await db.delete(family).where(eq(family.id, other.familyId));
    await pool.end();
  });

  beforeEach(async () => {
    stubs.session = {
      session: { activeFamilyId: household.familyId, memberId: household.parentId },
    };
    await db.delete(timer).where(eq(timer.familyId, household.familyId));
    await db.delete(timer).where(eq(timer.familyId, other.familyId));
    await db.delete(eventLog).where(eq(eventLog.familyId, household.familyId));
  });

  const rowsOf = (familyId: string) => db.select().from(timer).where(eq(timer.familyId, familyId));

  describe('starting', () => {
    it('stamps the start time server-side and stores the duration, not a deadline', async () => {
      const before = Date.now();
      const result = await startTimerAction({
        label: 'Schoenen aan',
        durationSeconds: 300,
        memberId: household.childId,
        clientId: 'timer-adhoc-1',
      });
      const after = Date.now();

      expect(result.status).toBe('started');

      const [row] = await rowsOf(household.familyId);
      expect(row.label).toBe('Schoenen aan');
      expect(row.durationSeconds).toBe(300);
      expect(row.memberId).toBe(household.childId);
      expect(row.stoppedAt).toBeNull();
      // The server's clock, within the window this test ran in — never a value
      // the caller supplied (there is no parameter for one).
      expect(row.startedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(row.startedAt.getTime()).toBeLessThanOrEqual(after + 1000);
      // Default lead time, capped by the duration.
      expect(row.warningLeadSeconds).toBe(300);
    });

    it('takes the label, duration and owner from a routine step', async () => {
      const result = await startTimerAction({ routineStepId: stepId, clientId: 'timer-step-1' });

      expect(result.status).toBe('started');

      const [row] = await rowsOf(household.familyId);
      expect(row.label).toBe('Tanden poetsen');
      expect(row.durationSeconds).toBe(120);
      expect(row.memberId).toBe(household.childId);
      expect(row.routineStepId).toBe(stepId);
      // The lead never exceeds the timer: a 2-minute step warns at 2 minutes.
      expect(row.warningLeadSeconds).toBe(120);
    });

    it('absorbs a replayed start — one countdown, not two', async () => {
      const first = await startTimerAction({
        label: 'Schoenen aan',
        durationSeconds: 300,
        clientId: 'timer-replay',
      });
      const second = await startTimerAction({
        label: 'Schoenen aan',
        durationSeconds: 300,
        clientId: 'timer-replay',
      });

      expect(first).toMatchObject({ status: 'started', replayed: false });
      expect(second).toMatchObject({ status: 'started', replayed: true });
      if (first.status === 'started' && second.status === 'started') {
        expect(second.timerId).toBe(first.timerId);
      }
      expect(await rowsOf(household.familyId)).toHaveLength(1);
    });

    /**
     * M09 review carry-forward, closed in M11.
     *
     * `timer_client_id_unique` is not partial, so a replay of a tap whose
     * timer has since been stopped still conflicts. The recovery lookup used
     * to filter `stopped_at IS NULL`, found nothing, and returned
     * `alreadyRunning` — an *error* for a request that had already succeeded.
     * The offline outbox makes exactly that sequence ordinary: queue a start,
     * lose the network, stop the timer by hand, reconnect, flush.
     */
    it('replays a start idempotently even after the timer was stopped', async () => {
      const first = await startTimerAction({
        label: 'Schoenen aan',
        durationSeconds: 300,
        clientId: 'timer-replay-after-stop',
      });
      if (first.status !== 'started') {
        throw new Error(`expected a started timer, got ${JSON.stringify(first)}`);
      }

      await stopTimerAction({ timerId: first.timerId });

      const replay = await startTimerAction({
        label: 'Schoenen aan',
        durationSeconds: 300,
        clientId: 'timer-replay-after-stop',
      });

      expect(replay).toMatchObject({ status: 'started', replayed: true });
      if (replay.status === 'started') expect(replay.timerId).toBe(first.timerId);
      // And still exactly one row: the replay minted nothing.
      expect(await rowsOf(household.familyId)).toHaveLength(1);
    });

    it('absorbs a second device starting the same step with its own key', async () => {
      const first = await startTimerAction({ routineStepId: stepId, clientId: 'timer-device-a' });
      const second = await startTimerAction({ routineStepId: stepId, clientId: 'timer-device-b' });

      expect(second).toMatchObject({ status: 'started', replayed: true });
      if (first.status === 'started' && second.status === 'started') {
        expect(second.timerId).toBe(first.timerId);
      }
      expect(await rowsOf(household.familyId)).toHaveLength(1);
    });

    it('lets the same step be timed again once the previous one stopped', async () => {
      const first = await startTimerAction({ routineStepId: stepId, clientId: 'timer-again-1' });
      if (first.status !== 'started') {
        throw new Error(`expected a started timer, got ${JSON.stringify(first)}`);
      }

      await stopTimerAction({ timerId: first.timerId });
      const second = await startTimerAction({ routineStepId: stepId, clientId: 'timer-again-2' });

      expect(second).toMatchObject({ status: 'started', replayed: false });
      expect(await rowsOf(household.familyId)).toHaveLength(2);
    });

    it('refuses a routine step from another household', async () => {
      const result = await startTimerAction({
        routineStepId: otherStepId,
        clientId: 'forged-step',
      });

      expect(result).toEqual({ status: 'error', error: 'stepNotFound' });
      expect(await rowsOf(household.familyId)).toHaveLength(0);
      expect(await rowsOf(other.familyId)).toHaveLength(0);
    });

    it('refuses a member from another household', async () => {
      const result = await startTimerAction({
        label: 'Schoenen aan',
        durationSeconds: 60,
        memberId: other.childId,
        clientId: 'forged-member',
      });

      expect(result).toEqual({ status: 'error', error: 'memberNotFound' });
      expect(await rowsOf(household.familyId)).toHaveLength(0);
    });

    it('refuses a start with no principal at all', async () => {
      stubs.session = null;

      const result = await startTimerAction({
        label: 'Schoenen aan',
        durationSeconds: 60,
        clientId: 'no-session',
      });

      expect(result).toEqual({ status: 'error', error: 'forbidden' });
      expect(await rowsOf(household.familyId)).toHaveLength(0);
    });

    it('publishes `timer.started` in the same transaction as the row', async () => {
      await startTimerAction({
        label: 'Schoenen aan',
        durationSeconds: 300,
        memberId: household.childId,
        clientId: 'timer-publish',
      });

      const [row] = await rowsOf(household.familyId);
      const log = await db.select().from(eventLog).where(eq(eventLog.familyId, household.familyId));

      expect(log).toHaveLength(1);
      expect(log[0].type).toBe('timer.started');
      expect(log[0].payload.entity.id).toBe(row.id);
      expect(log[0].payload.patch).toMatchObject({ label: 'Schoenen aan', durationSeconds: 300 });
    });

    it('publishes nothing when the start is refused', async () => {
      await startTimerAction({ routineStepId: otherStepId, clientId: 'forged-no-publish' });

      const log = await db.select().from(eventLog).where(eq(eventLog.familyId, household.familyId));
      expect(log).toHaveLength(0);
    });
  });

  describe('stopping', () => {
    async function running(clientId: string): Promise<string> {
      const started = await startTimerAction({
        label: 'Schoenen aan',
        durationSeconds: 300,
        clientId,
      });
      if (started.status !== 'started')
        throw new Error(`expected a started timer, got ${JSON.stringify(started)}`);
      return started.timerId;
    }

    it('records the stop and publishes `timer.stopped`', async () => {
      const timerId = await running('timer-stop-1');

      expect(await stopTimerAction({ timerId })).toEqual({ status: 'stopped' });

      const [row] = await rowsOf(household.familyId);
      expect(row.stoppedAt).not.toBeNull();

      const log = await db
        .select()
        .from(eventLog)
        .where(and(eq(eventLog.familyId, household.familyId), eq(eventLog.type, 'timer.stopped')));

      expect(log).toHaveLength(1);
      expect(log[0].payload.entity.id).toBe(timerId);
    });

    it('is idempotent: a second stop changes nothing', async () => {
      const timerId = await running('timer-stop-2');
      await stopTimerAction({ timerId });

      const [afterFirst] = await rowsOf(household.familyId);
      const stoppedAt = afterFirst.stoppedAt;

      expect(await stopTimerAction({ timerId })).toEqual({
        status: 'error',
        error: 'timerNotFound',
      });

      const [afterSecond] = await rowsOf(household.familyId);
      expect(afterSecond.stoppedAt).toEqual(stoppedAt);
    });

    it('cannot stop another household’s timer', async () => {
      const timerId = await running('timer-stop-3');

      stubs.session = {
        session: { activeFamilyId: other.familyId, memberId: other.parentId },
      };

      expect(await stopTimerAction({ timerId })).toEqual({
        status: 'error',
        error: 'timerNotFound',
      });

      stubs.session = {
        session: { activeFamilyId: household.familyId, memberId: household.parentId },
      };
      const [row] = await rowsOf(household.familyId);
      expect(row.stoppedAt).toBeNull();
    });
  });

  describe('what the database itself refuses', () => {
    it('rejects a non-positive duration', async () => {
      await expectRejection(
        db.insert(timer).values({
          familyId: household.familyId,
          label: 'Nul',
          durationSeconds: 0,
        }),
        /timer_duration_seconds_positive/
      );
    });

    it('rejects a negative warning lead', async () => {
      await expectRejection(
        db.insert(timer).values({
          familyId: household.familyId,
          label: 'Negatief',
          durationSeconds: 60,
          warningLeadSeconds: -1,
        }),
        /timer_warning_lead_seconds_non_negative/
      );
    });

    it('rejects a second running timer for one step, and allows one after a stop', async () => {
      await db.insert(timer).values({
        familyId: household.familyId,
        label: 'A',
        durationSeconds: 60,
        routineStepId: stepId,
      });

      await expectRejection(
        db.insert(timer).values({
          familyId: household.familyId,
          label: 'B',
          durationSeconds: 60,
          routineStepId: stepId,
        }),
        /timer_running_step_unique/
      );

      await db
        .update(timer)
        .set({ stoppedAt: new Date() })
        .where(eq(timer.familyId, household.familyId));

      await db.insert(timer).values({
        familyId: household.familyId,
        label: 'C',
        durationSeconds: 60,
        routineStepId: stepId,
      });

      expect(await rowsOf(household.familyId)).toHaveLength(2);
    });
  });
});
