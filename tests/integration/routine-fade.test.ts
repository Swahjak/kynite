import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * The fade path, running for real (M08, FR17, research §Decisions 7).
 *
 * `tests/unit/routines/steps-and-stars.test.ts` proves `starsFor()` returns 0
 * for a graduated routine. What that cannot prove is the part the child
 * experiences: that flipping one routine off stars **leaves every other
 * routine paying**, and that nothing the child already earned moves by a single
 * star when it happens.
 *
 * The suite is written as a before/after on the *whole* ledger rather than on a
 * total, for the same reason the denial test is: a fade that quietly reclassed
 * or renumbered a past award would keep the sum identical.
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

const { completeStepAction, setRoutineRewardAction } = await import('@/modules/routines/actions');

vi.setConfig({ testTimeout: 20_000 });

/** Today in the family's own zone. */
function today(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date());
}

describe.skipIf(!databaseUrl)('routine fade and graduation (integration)', () => {
  const { pool, db } = createTestDb();
  const { completion, family, routine, routineStep, starLedger } = schema;

  let household: Household;
  let brushId: string;
  let brushStepId: string;
  let tidyId: string;
  let tidyStepId: string;

  const setReward = (routineId: string, rewardEnabled: boolean) => {
    const form = new FormData();
    form.set('routineId', routineId);
    form.set('rewardEnabled', rewardEnabled ? 'true' : 'false');
    return setRoutineRewardAction({ status: 'idle' }, form);
  };

  const complete = (routineId: string, stepId: string, suffix: string) =>
    completeStepAction({
      routineId,
      routineStepId: stepId,
      memberId: household.childId,
      occurrenceDate: today(),
      clientId: `hub:${household.childId}:${stepId}:${today()}:${suffix}`,
      source: 'hub',
    });

  const ledger = () =>
    db
      .select()
      .from(starLedger)
      .where(eq(starLedger.familyId, household.familyId))
      .orderBy(starLedger.createdAt);

  const routineRow = async (routineId: string) => {
    const [row] = await db.select().from(routine).where(eq(routine.id, routineId));
    return row;
  };

  beforeAll(async () => {
    stubs.db = db;
    household = await seedHousehold(db, 'Fade');

    // Two routines for the same child, both paying, both due every day so the
    // suite runs on any weekday. Backdated so today's occurrence exists.
    const backdated = new Date(Date.now() - 30 * 86_400_000);

    const created = await db
      .insert(routine)
      .values([
        {
          familyId: household.familyId,
          ownerMemberId: household.childId,
          title: 'Tanden poetsen',
          schedule: { rrule: 'FREQ=DAILY', timeOfDay: '07:30' },
          starsPerCompletion: 2,
          createdAt: backdated,
        },
        {
          familyId: household.familyId,
          ownerMemberId: household.childId,
          title: 'Kamer opruimen',
          schedule: { rrule: 'FREQ=DAILY', timeOfDay: '17:00' },
          starsPerCompletion: 3,
          createdAt: backdated,
        },
      ])
      .returning({ id: routine.id });

    brushId = created[0].id;
    tidyId = created[1].id;

    const steps = await db
      .insert(routineStep)
      .values([
        { routineId: brushId, title: 'Poetsen', sortOrder: 0 },
        { routineId: tidyId, title: 'Opruimen', sortOrder: 0 },
      ])
      .returning({ id: routineStep.id, routineId: routineStep.routineId });

    brushStepId = steps.find((step) => step.routineId === brushId)!.id;
    tidyStepId = steps.find((step) => step.routineId === tidyId)!.id;
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
    await pool.end();
  });

  beforeEach(async () => {
    stubs.session = {
      session: { activeFamilyId: household.familyId, memberId: household.parentId },
    };
    await db.delete(completion).where(eq(completion.familyId, household.familyId));
    await db.delete(starLedger).where(eq(starLedger.familyId, household.familyId));
    await db.delete(schema.eventLog).where(eq(schema.eventLog.familyId, household.familyId));

    // Both routines pay again at the start of every test.
    await db
      .update(routine)
      .set({ rewardEnabled: true, fadedAt: null })
      .where(eq(routine.familyId, household.familyId));
  });

  it('stamps fadedAt when rewards are switched off', async () => {
    expect((await routineRow(brushId)).fadedAt).toBeNull();

    expect(await setReward(brushId, false)).toEqual({ status: 'idle' });

    const row = await routineRow(brushId);
    expect(row.rewardEnabled).toBe(false);
    // A recorded moment, not an inference from a boolean.
    expect(row.fadedAt).toBeInstanceOf(Date);
  });

  it('stops stars for that routine only — every other routine keeps paying', async () => {
    await setReward(brushId, false);

    expect(await complete(brushId, brushStepId, 'a')).toEqual({
      status: 'done',
      stars: 0,
      replayed: false,
    });
    expect(await complete(tidyId, tidyStepId, 'a')).toEqual({
      status: 'done',
      stars: 3,
      replayed: false,
    });

    const rows = await ledger();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ amount: 3, reason: 'routine', routineId: tidyId });
  });

  it('still completes the graduated routine — it fades, it does not stop working', async () => {
    await setReward(brushId, false);
    await complete(brushId, brushStepId, 'b');

    const rows = await db
      .select()
      .from(completion)
      .where(and(eq(completion.familyId, household.familyId), eq(completion.routineId, brushId)));

    // The tap still lands, the step is still done, the celebration still fires.
    // Only the star is absent.
    expect(rows).toHaveLength(1);
  });

  it('touches no star the child already earned', async () => {
    await complete(brushId, brushStepId, 'c');
    await complete(tidyId, tidyStepId, 'c');

    const before = await ledger();
    expect(before.map((row) => row.amount)).toEqual([2, 3]);

    await setReward(brushId, false);

    // Not "the total is still 5" — the same rows, byte for byte. A fade that
    // reclassified or renumbered a past award would keep the sum identical.
    expect(await ledger()).toEqual(before);
  });

  it('leaves the other routine untouched in the database, not just in its payouts', async () => {
    const before = await routineRow(tidyId);
    await setReward(brushId, false);

    expect(await routineRow(tidyId)).toEqual(before);
  });

  it('clears fadedAt when a parent turns stars back on', async () => {
    await setReward(brushId, false);
    expect((await routineRow(brushId)).fadedAt).toBeInstanceOf(Date);

    expect(await setReward(brushId, true)).toEqual({ status: 'idle' });

    const row = await routineRow(brushId);
    expect(row.rewardEnabled).toBe(true);
    expect(row.fadedAt).toBeNull();

    expect(await complete(brushId, brushStepId, 'd')).toMatchObject({ stars: 2 });
  });

  it('keeps the original graduation moment across a repeated fade', async () => {
    await setReward(brushId, false);
    const first = (await routineRow(brushId)).fadedAt;

    // Idempotent: posting the same target state again is not a new graduation.
    await setReward(brushId, false);

    expect((await routineRow(brushId)).fadedAt).toEqual(first);
  });

  it('publishes routine.updated so the hub can re-render the badge', async () => {
    await setReward(brushId, false);

    const log = await db
      .select()
      .from(schema.eventLog)
      .where(eq(schema.eventLog.familyId, household.familyId));

    expect(log.map((row) => row.type)).toEqual(['routine.updated']);
    expect(log[0].payload.patch).toMatchObject({ rewardEnabled: false });
  });

  it('refuses a routine from another family, however well-formed the id', async () => {
    const outsider = await seedHousehold(db, 'Outsiders 3');
    const [theirs] = await db
      .insert(routine)
      .values({
        familyId: outsider.familyId,
        ownerMemberId: outsider.childId,
        title: 'Hun routine',
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '07:30' },
      })
      .returning({ id: routine.id });

    expect(await setReward(theirs.id, false)).toEqual({
      status: 'error',
      error: 'routineNotFound',
    });

    const [row] = await db.select().from(routine).where(eq(routine.id, theirs.id));
    expect(row.rewardEnabled).toBe(true);

    await db.delete(family).where(eq(family.id, outsider.familyId));
  });

  it('does not let a child graduate their own routine', async () => {
    stubs.session = {
      session: { activeFamilyId: household.familyId, memberId: household.childId },
    };

    // `routine:write` is `deny` in the child column of the §7 matrix.
    expect(await setReward(brushId, false)).toEqual({ status: 'error', error: 'forbidden' });
    expect((await routineRow(brushId)).rewardEnabled).toBe(true);
  });
});
