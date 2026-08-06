import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as schema from '@/server/db/schema';
import {
  createTestDb,
  databaseUrl,
  expectRejection,
  seedHousehold,
  type Household,
} from './support/db';

/**
 * Completion idempotency (M04). The optimistic completion flow in
 * `docs/architecture.md` §4 fires the celebration before the write lands and
 * retries from an offline outbox, so a double tap and a replayed outbox entry
 * both have to be no-ops *in the database*.
 */
describe.skipIf(!databaseUrl)('completion (integration)', () => {
  const { pool, db } = createTestDb();
  const { completion, routine, routineStep, family } = schema;

  let household: Household;
  let routineId: string;
  let stepId: string;
  let otherRoutineId: string;

  beforeAll(async () => {
    household = await seedHousehold(db, 'Completions');

    const routines = await db
      .insert(routine)
      .values([
        {
          familyId: household.familyId,
          ownerMemberId: household.childId,
          title: 'Ochtendroutine',
          schedule: { rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR', timeOfDay: '07:30', graceDays: 1 },
        },
        {
          familyId: household.familyId,
          ownerMemberId: household.childId,
          title: 'Avondroutine',
          schedule: { rrule: 'FREQ=DAILY', timeOfDay: '19:00' },
        },
      ])
      .returning();
    routineId = routines[0].id;
    otherRoutineId = routines[1].id;

    const [step] = await db
      .insert(routineStep)
      .values({ routineId, title: 'Tanden poetsen', sortOrder: 0, timerSeconds: 120 })
      .returning();
    stepId = step.id;
  });

  afterAll(async () => {
    await db.delete(family).where(eq(family.id, household.familyId));
    await pool.end();
  });

  it('stores the routine schedule as structured jsonb', async () => {
    const [row] = await db.select().from(routine).where(eq(routine.id, routineId));

    expect(row.schedule).toEqual({
      rrule: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
      timeOfDay: '07:30',
      graceDays: 1,
    });
    expect(row.rewardEnabled).toBe(true);
    expect(row.fadedAt).toBeNull();
  });

  it('makes a replayed outbox entry a no-op: the same clientId lands once', async () => {
    const clientId = `outbox-${randomUUID()}`;
    const values = {
      familyId: household.familyId,
      memberId: household.childId,
      routineId,
      routineStepId: stepId,
      occurrenceDate: '2026-03-02',
      source: 'hub' as const,
      clientId,
    };

    const first = await db.insert(completion).values(values).onConflictDoNothing().returning();
    const second = await db.insert(completion).values(values).onConflictDoNothing().returning();

    expect(first).toHaveLength(1);
    expect(second, 'the replay must not create a second row').toHaveLength(0);

    const rows = await db.select().from(completion).where(eq(completion.clientId, clientId));
    expect(rows).toHaveLength(1);
  });

  it('rejects a second row for the same member, step and day', async () => {
    await expectRejection(
      db.insert(completion).values({
        familyId: household.familyId,
        memberId: household.childId,
        routineId,
        routineStepId: stepId,
        occurrenceDate: '2026-03-02',
        source: 'mobile',
        // A different device, a different key — the (member, step, day) index
        // is what makes the double tap idempotent.
        clientId: `outbox-${randomUUID()}`,
      }),
      /completion_member_step_date_unique/
    );
  });

  it('rejects a reused clientId even on a different day', async () => {
    const clientId = `outbox-${randomUUID()}`;
    await db.insert(completion).values({
      familyId: household.familyId,
      memberId: household.childId,
      routineId,
      routineStepId: stepId,
      occurrenceDate: '2026-03-03',
      source: 'hub',
      clientId,
    });

    await expectRejection(
      db.insert(completion).values({
        familyId: household.familyId,
        memberId: household.childId,
        routineId,
        routineStepId: stepId,
        occurrenceDate: '2026-03-04',
        source: 'hub',
        clientId,
      }),
      /completion_client_id_unique/
    );
  });

  it('lets the same step be completed by a sibling on the same day', async () => {
    const [row] = await db
      .insert(completion)
      .values({
        familyId: household.familyId,
        memberId: household.siblingId,
        routineId,
        routineStepId: stepId,
        occurrenceDate: '2026-03-02',
        source: 'hub',
        clientId: `outbox-${randomUUID()}`,
      })
      .returning();

    expect(row.memberId).toBe(household.siblingId);
  });

  it('allows two step-less completions on one day (NULLS DISTINCT is deliberate)', async () => {
    await db.insert(completion).values([
      {
        familyId: household.familyId,
        memberId: household.childId,
        routineId,
        occurrenceDate: '2026-03-05',
        source: 'hub',
        clientId: `outbox-${randomUUID()}`,
      },
      {
        familyId: household.familyId,
        memberId: household.childId,
        routineId: otherRoutineId,
        occurrenceDate: '2026-03-05',
        source: 'hub',
        clientId: `outbox-${randomUUID()}`,
      },
    ]);

    const rows = await db
      .select()
      .from(completion)
      .where(
        and(eq(completion.memberId, household.childId), eq(completion.occurrenceDate, '2026-03-05'))
      );

    expect(rows).toHaveLength(2);
  });

  it('has no "uncompleted" state: undo is a delete', async () => {
    const clientId = `outbox-${randomUUID()}`;
    await db.insert(completion).values({
      familyId: household.familyId,
      memberId: household.childId,
      routineId,
      routineStepId: stepId,
      occurrenceDate: '2026-03-06',
      source: 'hub',
      clientId,
    });

    await db.delete(completion).where(eq(completion.clientId, clientId));

    // And the day is free again — a missed task is the absence of a row.
    const [reinstated] = await db
      .insert(completion)
      .values({
        familyId: household.familyId,
        memberId: household.childId,
        routineId,
        routineStepId: stepId,
        occurrenceDate: '2026-03-06',
        source: 'hub',
        clientId: `outbox-${randomUUID()}`,
      })
      .returning();

    expect(reinstated.occurrenceDate).toBe('2026-03-06');
  });

  it('takes completions with the step when a routine is deleted', async () => {
    const [doomed] = await db
      .insert(routine)
      .values({
        familyId: household.familyId,
        ownerMemberId: household.childId,
        title: 'Tijdelijk',
        schedule: { rrule: 'FREQ=DAILY' },
      })
      .returning();
    const [doomedStep] = await db
      .insert(routineStep)
      .values({ routineId: doomed.id, title: 'Weg', sortOrder: 0 })
      .returning();
    await db.insert(completion).values({
      familyId: household.familyId,
      memberId: household.childId,
      routineId: doomed.id,
      routineStepId: doomedStep.id,
      occurrenceDate: '2026-03-07',
      source: 'hub',
      clientId: `outbox-${randomUUID()}`,
    });

    await db.delete(routine).where(eq(routine.id, doomed.id));

    const steps = await db.select().from(routineStep).where(eq(routineStep.id, doomedStep.id));
    const rows = await db.select().from(completion).where(eq(completion.routineId, doomed.id));

    expect(steps).toHaveLength(0);
    expect(rows).toHaveLength(0);
  });
});
