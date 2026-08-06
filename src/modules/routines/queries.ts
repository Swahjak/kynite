import 'server-only';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { orderSteps } from './domain/steps';
import { completion, routine, routineStep, type Routine, type RoutineStep } from './schema';

/**
 * Reads for the routines slice. `server-only`, like every other slice's
 * `queries.ts`: a client component that imported this would ship the database
 * client and its connection string to the browser.
 */

export type RoutineWithSteps = Routine & { steps: RoutineStep[] };

/**
 * Every routine in the family with its steps, in board order.
 *
 * Two queries rather than a join with a `group by`: routines are a handful of
 * rows per family, and assembling in JavaScript keeps `orderSteps`' tie-break
 * (the same one the hub uses) as the single definition of step order.
 */
export async function listRoutines(
  familyId: string,
  options: { ownerMemberId?: string; activeOnly?: boolean } = {}
): Promise<RoutineWithSteps[]> {
  const db = getDb();

  const routines = await db
    .select()
    .from(routine)
    .where(
      and(
        eq(routine.familyId, familyId),
        options.ownerMemberId ? eq(routine.ownerMemberId, options.ownerMemberId) : undefined,
        options.activeOnly ? eq(routine.active, true) : undefined
      )
    )
    .orderBy(asc(routine.sortOrder), asc(routine.createdAt));

  if (routines.length === 0) return [];

  const steps = await db
    .select()
    .from(routineStep)
    .where(
      inArray(
        routineStep.routineId,
        routines.map((row) => row.id)
      )
    );

  const byRoutine = new Map<string, RoutineStep[]>();
  for (const step of steps) {
    const bucket = byRoutine.get(step.routineId);
    if (bucket) bucket.push(step);
    else byRoutine.set(step.routineId, [step]);
  }

  return routines.map((row) => ({ ...row, steps: orderSteps(byRoutine.get(row.id) ?? []) }));
}

/** One routine, family-scoped. Null for another family's id — never a leak. */
export async function getRoutine(familyId: string, routineId: string): Promise<Routine | null> {
  const [row] = await getDb()
    .select()
    .from(routine)
    .where(and(eq(routine.id, routineId), eq(routine.familyId, familyId)))
    .limit(1);

  return row ?? null;
}

export async function listSteps(routineId: string): Promise<RoutineStep[]> {
  const steps = await getDb()
    .select()
    .from(routineStep)
    .where(eq(routineStep.routineId, routineId));

  return orderSteps(steps);
}

export type CompletedStep = { routineStepId: string; occurrenceDate: string };

/**
 * Which of a member's steps are already done on the given days.
 *
 * The hub asks this for exactly the occurrence dates it is about to render —
 * "today, plus whatever grace days are still open" — so the query stays a
 * bounded index lookup on `(familyId, memberId, occurrenceDate)`.
 */
export async function listCompletedSteps(input: {
  familyId: string;
  memberId: string;
  occurrenceDates: readonly string[];
}): Promise<CompletedStep[]> {
  if (input.occurrenceDates.length === 0) return [];

  const rows = await getDb()
    .select({
      routineStepId: completion.routineStepId,
      occurrenceDate: completion.occurrenceDate,
    })
    .from(completion)
    .where(
      and(
        eq(completion.familyId, input.familyId),
        eq(completion.memberId, input.memberId),
        inArray(completion.occurrenceDate, [...input.occurrenceDates])
      )
    );

  return rows.flatMap((row) =>
    row.routineStepId
      ? [{ routineStepId: row.routineStepId, occurrenceDate: row.occurrenceDate }]
      : []
  );
}
