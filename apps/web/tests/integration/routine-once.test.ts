import { eq } from 'drizzle-orm';
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
 * One-off chores, end to end through the real write path (M20).
 *
 * `tests/unit/routines/occurrence.test.ts` proves the date logic and
 * `tests/unit/no-negative-marking.test.ts` pins the states it may produce.
 * Neither proves the thing this milestone is actually about: that the *builder*
 * stores a one-off, that the ordinary completion path pays its stars without
 * knowing it is one, and that once it is done it stops appearing on the child's
 * board. That is this file — real Postgres, real actions, framework seams
 * (session, cache, locale, push) faked and nothing else.
 */

const stubs = vi.hoisted(() => ({
  db: undefined as unknown as ReturnType<typeof createTestDb>['db'],
  session: null as { session: { activeFamilyId?: string; memberId?: string } } | null,
}));

vi.mock('@/server/db', () => ({ getDb: () => stubs.db }));
vi.mock('@/server/auth', () => ({
  getAuth: () => ({ api: { getSession: async () => stubs.session } }),
}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('next-intl/server', () => ({ getLocale: async () => 'nl' }));
vi.mock('@/i18n/navigation', () => ({
  redirect: () => {
    throw new Error('NEXT_REDIRECT');
  },
}));
vi.mock('@/modules/routines/notify-bridge', () => ({ notifyCompletion: async () => 1 }));

const { completeStepAction, createRoutineAction } = await import('@/modules/routines/actions');
const { loadMemberRoutines } = await import('@/modules/routines/page-data');

vi.setConfig({ testTimeout: 20_000 });

const ZONE = 'Europe/Amsterdam';

/** A single frozen instant, for the same midnight-crossing reason as `routine-completion.test.ts`. */
const NOW = new Date();

/** `YYYY-MM-DD` in the family's own zone — never `toISOString().slice(0, 10)`. */
function dateKey(offsetDays = 0): string {
  const day = new Date(NOW);
  day.setUTCDate(day.getUTCDate() + offsetDays);
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(day);
}

/** The builder's form, as the dialog actually posts it. */
function form(fields: Record<string, string | string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    for (const entry of Array.isArray(value) ? value : [value]) data.append(key, entry);
  }
  return data;
}

describe.skipIf(!databaseUrl)('one-off chores (integration)', () => {
  const { pool, db } = createTestDb();
  const { completion, family, routine, routineStep, starLedger } = schema;

  let household: Household;

  beforeAll(async () => {
    stubs.db = db;
    household = await seedHousehold(db, 'One-off');
    // The board reads the family's timezone; state it rather than lean on the
    // default, so the date keys above and the server agree by construction.
    await db.update(family).set({ timezone: ZONE }).where(eq(family.id, household.familyId));
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
    await pool.end();
  });

  beforeEach(async () => {
    stubs.session = {
      session: { activeFamilyId: household.familyId, memberId: household.parentId },
    };
    await db.delete(routine).where(eq(routine.familyId, household.familyId));
    await db.delete(starLedger).where(eq(starLedger.familyId, household.familyId));
    await db.delete(schema.eventLog).where(eq(schema.eventLog.familyId, household.familyId));
  });

  /** "Clean the garage today, 10 stars" — through the builder, not an INSERT. */
  const createGarage = (overrides: Record<string, string | string[]> = {}) =>
    createRoutineAction(
      { status: 'idle' },
      form({
        title: 'Garage opruimen',
        icon: 'task_alt',
        ownerMemberId: household.childId,
        scheduleKind: 'once',
        onceDate: dateKey(),
        // Already due whenever the suite runs, so the board state is not a
        // function of the wall clock in CI.
        timeOfDay: '00:01',
        graceDays: '1',
        starsPerCompletion: '10',
        rewardEnabled: 'on',
        active: 'on',
        stepId: '',
        stepTitle: 'Dozen naar de kringloop',
        stepTimerSeconds: '',
        ...overrides,
      })
    );

  async function storedRoutine() {
    const [row] = await db.select().from(routine).where(eq(routine.familyId, household.familyId));
    const [step] = await db.select().from(routineStep).where(eq(routineStep.routineId, row.id));
    return { row, step };
  }

  it('stores a one-off as a dated schedule with no recurrence rule', async () => {
    expect(await createGarage()).toEqual({ status: 'idle' });

    const { row, step } = await storedRoutine();
    expect(row.schedule).toEqual({
      kind: 'once',
      date: dateKey(),
      timeOfDay: '00:01',
      graceDays: 1,
    });
    expect(row.schedule.rrule).toBeUndefined();
    // FR9: it is owned, like every routine.
    expect(row.ownerMemberId).toBe(household.childId);
    expect(row.starsPerCompletion).toBe(10);
    expect(step.title).toBe('Dozen naar de kringloop');
  });

  it('refuses a one-off with no date, or with a date that is not a day', async () => {
    expect(await createGarage({ onceDate: '' })).toEqual({
      status: 'error',
      error: 'invalidInput',
    });
    expect(await createGarage({ onceDate: '2026-02-30' })).toEqual({
      status: 'error',
      error: 'invalidInput',
    });
    expect(await createGarage({ onceDate: 'zaterdag' })).toEqual({
      status: 'error',
      error: 'invalidInput',
    });

    const rows = await db.select().from(routine).where(eq(routine.familyId, household.familyId));
    expect(rows).toEqual([]);
  });

  it('still requires weekdays for a recurring routine — the toggle relaxes nothing', async () => {
    expect(await createGarage({ scheduleKind: 'recurring', weekdays: [] })).toEqual({
      status: 'error',
      error: 'invalidInput',
    });
  });

  it('refuses a one-off for a member of another family', async () => {
    const outsider = await seedHousehold(db, 'One-off outsiders');

    expect(await createGarage({ ownerMemberId: outsider.childId })).toEqual({
      status: 'error',
      error: 'memberNotFound',
    });

    await db.delete(family).where(eq(family.id, outsider.familyId));
  });

  it('puts the chore on the owner’s board, in the band its time of day names', async () => {
    await createGarage({ timeOfDay: '19:30' });

    const board = await loadMemberRoutines({ memberId: household.childId });
    const evening = board!.sections.find((section) => section.section === 'evening')!;

    expect(evening.routines.map((entry) => entry.title)).toEqual(['Garage opruimen']);
    expect(evening.routines[0]).toMatchObject({
      oneOff: true,
      occurrenceDate: dateKey(),
      starsPerCompletion: 10,
    });
    // And nowhere else on the board.
    expect(
      board!.sections.filter((section) => section.section !== 'evening').flatMap((s) => s.routines)
    ).toEqual([]);
  });

  it('is absent from the board on a day it is not for', async () => {
    await createGarage({ onceDate: dateKey(3) });

    const board = await loadMemberRoutines({ memberId: household.childId });
    expect(board!.sections.flatMap((section) => section.routines)).toEqual([]);
  });

  it('pays its stars through the ordinary completion path and then leaves the board', async () => {
    await createGarage();
    const { row, step } = await storedRoutine();

    const before = await loadMemberRoutines({ memberId: household.childId });
    expect(before!.sections.flatMap((section) => section.routines)).toHaveLength(1);
    expect(before!.activeRoutineId).toBe(row.id);

    const result = await completeStepAction({
      routineId: row.id,
      routineStepId: step.id,
      memberId: household.childId,
      occurrenceDate: dateKey(),
      clientId: `hub:${household.childId}:${step.id}:${dateKey()}`,
      source: 'hub',
    });
    expect(result).toEqual({ status: 'done', stars: 10, replayed: false });

    // The completion row and its append-only ledger entry — identical wiring to
    // a recurring routine's, because it is literally the same code path.
    const completions = await db
      .select()
      .from(completion)
      .where(eq(completion.familyId, household.familyId));
    expect(completions).toHaveLength(1);
    expect(completions[0].occurrenceDate).toBe(dateKey());

    const ledger = await db
      .select()
      .from(starLedger)
      .where(eq(starLedger.familyId, household.familyId));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      amount: 10,
      reason: 'routine',
      memberId: household.childId,
      routineId: row.id,
      completionId: completions[0].id,
    });

    // Done with, not merely ticked: the chore is gone from the board rather
    // than sitting there as a finished card until midnight.
    const after = await loadMemberRoutines({ memberId: household.childId });
    expect(after!.sections.flatMap((section) => section.routines)).toEqual([]);
    expect(after!.activeRoutineId).toBeNull();

    // The card leaves; the credit does not. The band the chore was in still
    // counts it in *both* halves of its counter — "1 van 1 klaar", never a
    // denominator that quietly shrank to zero because the card went away. That
    // matters on a fresh load and on the other devices in the house, which
    // never saw the celebration and would otherwise watch the morning's total
    // drop by one for no visible reason.
    const sections = after!.sections;
    const sum = (pick: (section: (typeof sections)[number]) => number) =>
      sections.reduce((total, section) => total + pick(section), 0);
    expect({ done: sum((s) => s.doneCount), total: sum((s) => s.total) }).toEqual({
      done: 1,
      total: 1,
    });
    // …and the band it is in is complete, not empty.
    const band = after!.sections.find((section) => section.total > 0)!;
    expect(band.ratio).toBe(1);

    // Nothing was deleted to achieve that — the routine and its history are
    // still there for the parent.
    const stillThere = await db
      .select()
      .from(routine)
      .where(eq(routine.familyId, household.familyId));
    expect(stillThere).toHaveLength(1);
  });

  it('rejects a database row that claims to be a one-off without a date', async () => {
    // Defence in depth: the domain degrades such a schedule to "never due" and
    // the action cannot produce one, but a hand-written UPDATE should not be
    // able to either.
    await expectRejection(
      db.insert(routine).values({
        familyId: household.familyId,
        ownerMemberId: household.childId,
        title: 'Kapot',
        schedule: { kind: 'once', timeOfDay: '10:00' },
      }),
      /routine_once_has_date/
    );
  });
});
