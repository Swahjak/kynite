import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '@/server/db/schema';
import { createTestDb, databaseUrl, seedHousehold, type Household } from './support/db';

/**
 * The completion transaction, running for real (M07).
 *
 * `tests/unit/routines/*` prove the pure logic and
 * `tests/integration/completion.test.ts` proves the database's own uniqueness
 * guarantees. Neither proves that the *action* — resolving a real principal,
 * writing a real row — lands the completion and its star atomically, awards
 * nothing on a replay, and awards nothing for a routine that has graduated.
 * That is this file. The only fakes are framework seams (session, cache,
 * locale); `can()`, `getPrincipal()`, the reads and the writes are real.
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
// The action imports `@/modules/family`, whose barrel re-exports client
// components — which drags next-intl's client navigation into a plain Node run.
// Only `redirect` matters here, and it throws like the real one.
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));

const { completeStepAction } = await import('@/modules/routines/actions');

// Integration tests hit a real Postgres instance, so a single slow query
// (connection setup, a cold Docker volume) is more likely to bump into the
// unit-test default of 5s than to indicate an actual hang.
vi.setConfig({ testTimeout: 20_000 });

/**
 * A single frozen instant for the whole suite, snapshotted once here rather
 * than read fresh from `Date.now()` inside `dateKey()`. The suite spans many
 * `await` points against a real database; if the wall clock crossed local
 * midnight in Europe/Amsterdam mid-run, two calls to a per-invocation
 * `dateKey()` could disagree about what "today" is, flipping the occurrence
 * math (due/grace/closed) between the write and the assertion. Freezing it
 * once removes that window entirely.
 */
const NOW = new Date();

/** Yesterday and today as `YYYY-MM-DD` in the family's own zone. */
function dateKey(offsetDays = 0): string {
  const day = new Date(NOW);
  day.setUTCDate(day.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(day);
}

describe.skipIf(!databaseUrl)('routine completion (integration)', () => {
  const { pool, db } = createTestDb();
  const { completion, family, routine, routineStep, starLedger } = schema;

  let household: Household;
  let routineId: string;
  let stepId: string;
  let fadedRoutineId: string;
  let fadedStepId: string;

  beforeAll(async () => {
    stubs.db = db;
    household = await seedHousehold(db, 'Routines');

    const [live] = await db
      .insert(routine)
      .values({
        familyId: household.familyId,
        ownerMemberId: household.childId,
        title: 'Ochtendroutine',
        icon: 'task_alt',
        // Daily, so "today" is always a due day whenever the suite runs.
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '07:30', graceDays: 1 },
        starsPerCompletion: 3,
        // Backdated: `createdAt` is the series' DTSTART, so a routine created
        // this second would not have been due yesterday — and the grace-day
        // case below would pass for the wrong reason.
        createdAt: new Date(Date.now() - 30 * 86_400_000),
      })
      .returning({ id: routine.id });
    routineId = live.id;

    const [step] = await db
      .insert(routineStep)
      .values({ routineId, title: 'Tanden poetsen', sortOrder: 0 })
      .returning({ id: routineStep.id });
    stepId = step.id;

    const [faded] = await db
      .insert(routine)
      .values({
        familyId: household.familyId,
        ownerMemberId: household.childId,
        title: 'Zelfstandig',
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '07:30' },
        starsPerCompletion: 3,
        rewardEnabled: false,
        fadedAt: new Date(),
      })
      .returning({ id: routine.id });
    fadedRoutineId = faded.id;

    const [fadedStep] = await db
      .insert(routineStep)
      .values({ routineId: fadedRoutineId, title: 'Bed opmaken', sortOrder: 0 })
      .returning({ id: routineStep.id });
    fadedStepId = fadedStep.id;
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
  });

  const tap = (overrides: Partial<Parameters<typeof completeStepAction>[0]> = {}) =>
    completeStepAction({
      routineId,
      routineStepId: stepId,
      memberId: household.childId,
      occurrenceDate: dateKey(),
      clientId: `hub:${household.childId}:${stepId}:${dateKey()}`,
      source: 'hub',
      ...overrides,
    });

  it('inserts the completion and its star in one go', async () => {
    const result = await tap();
    expect(result).toEqual({ status: 'done', stars: 3, replayed: false });

    const rows = await db
      .select()
      .from(completion)
      .where(eq(completion.familyId, household.familyId));
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('hub');

    const ledger = await db
      .select()
      .from(starLedger)
      .where(eq(starLedger.familyId, household.familyId));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      amount: 3,
      reason: 'routine',
      memberId: household.childId,
      completionId: rows[0].id,
    });
  });

  it('publishes the completion inside the same transaction', async () => {
    await tap();

    const log = await db
      .select()
      .from(schema.eventLog)
      .where(eq(schema.eventLog.familyId, household.familyId));

    expect(log.map((row) => row.type).sort()).toEqual(['completion.created', 'stars.awarded']);
  });

  it('awards nothing on a replayed clientId — the star cannot be minted twice', async () => {
    const first = await tap();
    const second = await tap();

    expect(first).toMatchObject({ stars: 3, replayed: false });
    expect(second).toEqual({ status: 'done', stars: 0, replayed: true });

    const ledger = await db
      .select()
      .from(starLedger)
      .where(eq(starLedger.familyId, household.familyId));
    expect(ledger).toHaveLength(1);
  });

  it('awards nothing on a double tap that mints a fresh clientId', async () => {
    await tap();
    const second = await tap({ clientId: `hub:other-device:${stepId}:${dateKey()}` });

    expect(second).toEqual({ status: 'done', stars: 0, replayed: true });

    const rows = await db
      .select()
      .from(completion)
      .where(eq(completion.familyId, household.familyId));
    expect(rows).toHaveLength(1);
  });

  it('completes a graduated routine and awards no star — and removes nothing', async () => {
    const result = await completeStepAction({
      routineId: fadedRoutineId,
      routineStepId: fadedStepId,
      memberId: household.childId,
      occurrenceDate: dateKey(),
      clientId: `hub:${household.childId}:${fadedStepId}:${dateKey()}`,
      source: 'hub',
    });

    expect(result).toEqual({ status: 'done', stars: 0, replayed: false });

    const rows = await db
      .select()
      .from(completion)
      .where(
        and(eq(completion.familyId, household.familyId), eq(completion.routineId, fadedRoutineId))
      );
    expect(rows).toHaveLength(1);

    const ledger = await db
      .select()
      .from(starLedger)
      .where(eq(starLedger.familyId, household.familyId));
    expect(ledger).toEqual([]);
  });

  it('accepts a grace-day catch-up within the window', async () => {
    const result = await tap({
      occurrenceDate: dateKey(-1),
      clientId: `hub:${household.childId}:${stepId}:${dateKey(-1)}`,
    });

    expect(result).toMatchObject({ status: 'done', stars: 3 });
  });

  it('refuses a day the routine was never due on', async () => {
    const result = await completeStepAction({
      routineId: fadedRoutineId,
      routineStepId: fadedStepId,
      memberId: household.childId,
      // The faded routine has no grace days, so yesterday is closed.
      occurrenceDate: dateKey(-1),
      clientId: `hub:closed:${fadedStepId}`,
      source: 'hub',
    });

    expect(result).toEqual({ status: 'error', error: 'notScheduled' });
  });

  it('refuses a member from another family, however well-formed the id', async () => {
    const outsider = await seedHousehold(db, 'Outsiders');

    const result = await tap({
      memberId: outsider.childId,
      clientId: `hub:forged:${stepId}`,
    });

    expect(result).toEqual({ status: 'error', error: 'memberNotFound' });

    const rows = await db
      .select()
      .from(completion)
      .where(eq(completion.familyId, household.familyId));
    expect(rows).toEqual([]);

    await db.delete(family).where(eq(family.id, outsider.familyId));
  });

  it('refuses a routine from another family', async () => {
    const outsider = await seedHousehold(db, 'Outsiders 2');
    const [theirRoutine] = await db
      .insert(routine)
      .values({
        familyId: outsider.familyId,
        ownerMemberId: outsider.childId,
        title: 'Hun routine',
        schedule: { rrule: 'FREQ=DAILY', timeOfDay: '07:30' },
      })
      .returning({ id: routine.id });
    const [theirStep] = await db
      .insert(routineStep)
      .values({ routineId: theirRoutine.id, title: 'Hun stap', sortOrder: 0 })
      .returning({ id: routineStep.id });

    const result = await completeStepAction({
      routineId: theirRoutine.id,
      routineStepId: theirStep.id,
      memberId: household.childId,
      occurrenceDate: dateKey(),
      clientId: `hub:cross-family:${theirStep.id}`,
      source: 'hub',
    });

    expect(result).toEqual({ status: 'error', error: 'routineNotFound' });

    await db.delete(family).where(eq(family.id, outsider.familyId));
  });

  it('refuses a caller with no session at all', async () => {
    stubs.session = null;

    expect(await tap({ clientId: 'hub:anonymous' })).toEqual({
      status: 'error',
      error: 'forbidden',
    });
  });

  it('lets a child complete their own step — the hub is theirs', async () => {
    stubs.session = {
      session: { activeFamilyId: household.familyId, memberId: household.childId },
    };

    expect(await tap()).toMatchObject({ status: 'done', stars: 3 });
  });
});
