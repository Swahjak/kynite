'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { and, eq, notInArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/server/db';
// Table objects come from the schema assembly point, not from a slice barrel
// (see the same note in `modules/calendar/actions.ts`): a barrel re-exports
// client components, which must not enter a server mutation module.
import { completion, routine, routineStep, starLedger } from '@/server/db/schema';
import { assertCan, getFamily, getMember, type Principal } from '@/modules/family';
import { publish } from '@/modules/realtime';
import {
  actionFailure as failure,
  completionFailure,
  idleState,
  type ActionState,
  type CompletionState,
} from './action-state';
import { isCompletableOn } from './domain/occurrence';
import { MAX_GRACE_DAYS, WEEKDAYS, ruleForWeekdays, type Weekday } from './domain/schedule';
import { starsFor } from './domain/stars';
import { isRoutineIcon } from './ui/tokens';

/**
 * Mutations for the routines slice (M07).
 *
 * Same §2 discipline as every other slice: `assertCan()` is the first statement
 * in every action — before any database identifier is referenced — which is
 * what `tests/unit/server-action-authorization.test.ts` audits structurally.
 * Family scoping never comes from the form: every `where` carries `familyId`
 * from the *principal*, so a forged id addresses nothing.
 */

const trimmed = z.string().trim();

const stepSchema = z.object({
  id: z.union([z.uuid(), z.literal('')]),
  title: trimmed.min(1).max(120),
  /** `null` = untimed. Bounded at two hours: a step is a step, not a day. */
  timerSeconds: z.number().int().min(5).max(7200).nullable(),
});

const routineSchema = z.object({
  title: trimmed.min(1).max(120),
  icon: trimmed.refine(isRoutineIcon),
  ownerMemberId: z.uuid(),
  weekdays: z.array(z.enum(WEEKDAYS)).min(1),
  timeOfDay: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  graceDays: z.number().int().min(0).max(MAX_GRACE_DAYS),
  starsPerCompletion: z.number().int().min(0).max(20),
  rewardEnabled: z.boolean(),
  active: z.boolean(),
  steps: z.array(stepSchema).min(1).max(20),
});

function read(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function readAll(formData: FormData, key: string): string[] {
  return formData.getAll(key).filter((value): value is string => typeof value === 'string');
}

function readNumber(formData: FormData, key: string, fallback: number): number {
  const parsed = Number.parseInt(read(formData, key), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * The builder posts steps as three parallel arrays (`stepId`, `stepTitle`,
 * `stepTimerSeconds`) — the shape an `<input name="…">` repeater produces
 * without any client-side serialisation. Row order *is* the intended order, so
 * `sortOrder` is the array index and reordering in the dialog persists by
 * simply saving.
 */
function readSteps(formData: FormData) {
  const ids = readAll(formData, 'stepId');
  const titles = readAll(formData, 'stepTitle');
  const timers = readAll(formData, 'stepTimerSeconds');

  return titles.flatMap((title, index) => {
    if (title.trim() === '') return [];
    const seconds = Number.parseInt(timers[index] ?? '', 10);
    return [
      {
        id: ids[index] ?? '',
        title,
        timerSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
      },
    ];
  });
}

function routineInput(formData: FormData) {
  return routineSchema.safeParse({
    title: read(formData, 'title'),
    icon: read(formData, 'icon'),
    ownerMemberId: read(formData, 'ownerMemberId'),
    weekdays: readAll(formData, 'weekdays'),
    timeOfDay: read(formData, 'timeOfDay'),
    graceDays: readNumber(formData, 'graceDays', 0),
    starsPerCompletion: readNumber(formData, 'starsPerCompletion', 1),
    rewardEnabled: formData.get('rewardEnabled') !== null,
    active: formData.get('active') !== null,
    steps: readSteps(formData),
  });
}

async function revalidateRoutines(memberIds: readonly string[]): Promise<void> {
  const locale = await getLocale();
  // No SSE yet (M10 owns realtime), so every surface that renders routines is
  // revalidated explicitly. `publish()` below is already wired, so when the
  // stream lands these paths become a fallback rather than the mechanism.
  revalidatePath(`/${locale}/routines`);
  revalidatePath(`/${locale}/hub`);
  for (const memberId of new Set(memberIds)) {
    revalidatePath(`/${locale}/hub/routines/${memberId}`);
  }
}

type ResolvedInput = z.infer<typeof routineSchema> & { rrule: string };

async function resolveInput(
  familyId: string,
  formData: FormData
): Promise<{ ok: true; input: ResolvedInput } | { ok: false; error: string }> {
  const parsed = routineInput(formData);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const rrule = ruleForWeekdays(parsed.data.weekdays as Weekday[]);
  if (!rrule) return { ok: false, error: 'invalidInput' };

  // `ownerMemberId` is a uuid a form supplied. `getMember` returns null for an
  // id that exists but belongs to another family, which is what turns a forged
  // cross-family id into a rejection instead of a silent cross-tenant write.
  if (!(await getMember(familyId, parsed.data.ownerMemberId))) {
    return { ok: false, error: 'memberNotFound' };
  }

  return { ok: true, input: { ...parsed.data, rrule } };
}

/**
 * The realtime `actor` for a principal. A `member` principal names itself; a
 * paired kiosk names its device (M12). Neither is invented from a form.
 */
function actorOf(principal: Principal): { memberId?: string; deviceId?: string } {
  if (principal.kind === 'member') return { memberId: principal.memberId };
  if (principal.kind === 'device') return { deviceId: principal.deviceId };
  return {};
}

function scheduleOf(input: ResolvedInput) {
  return { rrule: input.rrule, timeOfDay: input.timeOfDay, graceDays: input.graceDays };
}

export async function createRoutineAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('routine:write').catch(() => null);
  if (!principal) return failure('forbidden');

  const resolved = await resolveInput(principal.familyId, formData);
  if (!resolved.ok) return failure(resolved.error);

  const { input } = resolved;
  const db = getDb();

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(routine)
      .values({
        familyId: principal.familyId,
        ownerMemberId: input.ownerMemberId,
        title: input.title,
        icon: input.icon,
        schedule: scheduleOf(input),
        starsPerCompletion: input.starsPerCompletion,
        rewardEnabled: input.rewardEnabled,
        active: input.active,
      })
      .returning({ id: routine.id });

    await tx.insert(routineStep).values(
      input.steps.map((step, index) => ({
        routineId: created.id,
        title: step.title,
        timerSeconds: step.timerSeconds,
        sortOrder: index,
      }))
    );

    await publish(
      {
        familyId: principal.familyId,
        type: 'routine.updated',
        entity: { id: created.id },
        actor: { ...actorOf(principal), source: 'mobile' },
      },
      tx
    );
  });

  await revalidateRoutines([input.ownerMemberId]);
  return idleState;
}

export async function updateRoutineAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('routine:write').catch(() => null);
  if (!principal) return failure('forbidden');

  const routineId = read(formData, 'routineId');
  if (!z.uuid().safeParse(routineId).success) return failure('invalidInput');

  const resolved = await resolveInput(principal.familyId, formData);
  if (!resolved.ok) return failure(resolved.error);

  const { input } = resolved;
  const db = getDb();

  const [existing] = await db
    .select()
    .from(routine)
    .where(and(eq(routine.id, routineId), eq(routine.familyId, principal.familyId)))
    .limit(1);

  if (!existing) return failure('routineNotFound');

  await db.transaction(async (tx) => {
    await tx
      .update(routine)
      .set({
        ownerMemberId: input.ownerMemberId,
        title: input.title,
        icon: input.icon,
        schedule: scheduleOf(input),
        starsPerCompletion: input.starsPerCompletion,
        rewardEnabled: input.rewardEnabled,
        // Fade is a *state*, not a toggle echo: turning rewards off stamps the
        // graduation moment, turning them back on clears it. Either way no
        // star that was already earned is touched — the ledger is append-only.
        fadedAt: input.rewardEnabled ? null : (existing.fadedAt ?? new Date()),
        active: input.active,
        updatedAt: new Date(),
      })
      .where(and(eq(routine.id, routineId), eq(routine.familyId, principal.familyId)));

    const keptIds = input.steps.map((step) => step.id).filter((id) => id !== '');

    // Steps the parent removed. Their completions cascade away with them —
    // a step that no longer exists has no history to show, and the star
    // ledger rows survive regardless (`completionId` is `set null`).
    await tx
      .delete(routineStep)
      .where(
        and(
          eq(routineStep.routineId, routineId),
          keptIds.length > 0 ? notInArray(routineStep.id, keptIds) : undefined
        )
      );

    for (const [index, step] of input.steps.entries()) {
      if (step.id === '') {
        await tx.insert(routineStep).values({
          routineId,
          title: step.title,
          timerSeconds: step.timerSeconds,
          sortOrder: index,
        });
      } else {
        await tx
          .update(routineStep)
          .set({
            title: step.title,
            timerSeconds: step.timerSeconds,
            sortOrder: index,
            updatedAt: new Date(),
          })
          .where(and(eq(routineStep.id, step.id), eq(routineStep.routineId, routineId)));
      }
    }

    await publish(
      {
        familyId: principal.familyId,
        type: 'routine.updated',
        entity: { id: routineId },
        actor: { ...actorOf(principal), source: 'mobile' },
      },
      tx
    );
  });

  await revalidateRoutines([input.ownerMemberId, existing.ownerMemberId]);
  return idleState;
}

export async function deleteRoutineAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('routine:write').catch(() => null);
  if (!principal) return failure('forbidden');

  const routineId = read(formData, 'routineId');
  if (!z.uuid().safeParse(routineId).success) return failure('invalidInput');

  const db = getDb();
  const [existing] = await db
    .select({ id: routine.id, ownerMemberId: routine.ownerMemberId })
    .from(routine)
    .where(and(eq(routine.id, routineId), eq(routine.familyId, principal.familyId)))
    .limit(1);

  if (!existing) return failure('routineNotFound');

  await db.transaction(async (tx) => {
    await tx
      .delete(routine)
      .where(and(eq(routine.id, routineId), eq(routine.familyId, principal.familyId)));

    await publish(
      {
        familyId: principal.familyId,
        type: 'routine.updated',
        entity: { id: routineId },
        actor: { ...actorOf(principal), source: 'mobile' },
      },
      tx
    );
  });

  await revalidateRoutines([existing.ownerMemberId]);
  return idleState;
}

const completeSchema = z.object({
  routineId: z.uuid(),
  routineStepId: z.uuid(),
  memberId: z.uuid(),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /**
   * The idempotency key, minted by the client *before* the request leaves the
   * device (§4). It is derived from `(member, step, occurrence date)` rather
   * than random, so a retry after a dropped connection reuses the same key by
   * construction instead of by remembering to.
   */
  clientId: trimmed.min(8).max(200),
  source: z.enum(['hub', 'mobile']),
});

export type CompleteStepInput = z.infer<typeof completeSchema>;

/**
 * A single tap on the hub (FR8) — the whole of the <100ms optimistic path's
 * server half.
 *
 * The completion row and its star land in **one transaction**, together with
 * the realtime publish, so there is no observable moment where a step is done
 * but unpaid. Idempotency is the database's job, not a read-then-write check:
 * `ON CONFLICT DO NOTHING` covers both `unique(clientId)` (an offline outbox
 * replay) and `unique(memberId, routineStepId, occurrenceDate)` (a double
 * tap). When nothing was inserted, nothing is awarded — which is exactly why
 * a replay cannot mint a second star.
 *
 * There is no failure UI on this path by design: a tap that arrives late, or
 * twice, or for a routine that has graduated, all render the same. The one
 * thing that never happens is a mark against the child.
 */
export async function completeStepAction(input: CompleteStepInput): Promise<CompletionState> {
  const principal = await assertCan('completion:write', { memberId: input.memberId }).catch(
    () => null
  );
  if (!principal) return completionFailure('forbidden');

  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return completionFailure('invalidInput');

  const { routineId, routineStepId, memberId, occurrenceDate, clientId, source } = parsed.data;

  const db = getDb();

  const [target] = await db
    .select({
      routine: routine,
      step: routineStep,
    })
    .from(routineStep)
    .innerJoin(routine, eq(routine.id, routineStep.routineId))
    .where(
      and(
        eq(routineStep.id, routineStepId),
        eq(routineStep.routineId, routineId),
        eq(routine.familyId, principal.familyId)
      )
    )
    .limit(1);

  if (!target) return completionFailure('routineNotFound');

  // The completing member must be in this family; a forged id addresses nothing.
  if (!(await getMember(principal.familyId, memberId))) {
    return completionFailure('memberNotFound');
  }

  const family = await getFamily(principal.familyId);
  const timeZone = family?.timezone ?? 'Europe/Amsterdam';

  const completable = isCompletableOn(
    { schedule: target.routine.schedule, anchor: target.routine.createdAt, timeZone },
    occurrenceDate,
    new Date()
  );
  if (!completable) return completionFailure('notScheduled');

  const stars = starsFor(target.routine);

  const result = await db.transaction(async (tx): Promise<CompletionState> => {
    const [inserted] = await tx
      .insert(completion)
      .values({
        familyId: principal.familyId,
        memberId,
        routineId,
        routineStepId,
        occurrenceDate,
        source,
        clientId,
      })
      // No conflict *target*: this has to absorb both unique indexes at once —
      // the clientId replay and the (member, step, day) double tap.
      .onConflictDoNothing()
      .returning({ id: completion.id });

    if (!inserted) return { status: 'done', stars: 0, replayed: true } as const;

    if (stars > 0) {
      await tx.insert(starLedger).values({
        familyId: principal.familyId,
        memberId,
        amount: stars,
        reason: 'routine',
        completionId: inserted.id,
        routineId,
      });
    }

    await publish(
      {
        familyId: principal.familyId,
        type: 'completion.created',
        entity: { id: inserted.id },
        actor: { memberId, source },
        patch: { routineId, routineStepId, occurrenceDate, stars },
      },
      tx
    );

    if (stars > 0) {
      await publish(
        {
          familyId: principal.familyId,
          type: 'stars.awarded',
          entity: { id: inserted.id },
          actor: { memberId, source },
          patch: { amount: stars, reason: 'routine', routineId },
        },
        tx
      );
    }

    return { status: 'done', stars, replayed: false } as const;
  });

  // Outside the transaction: revalidation is a cache concern, not a write, and
  // the hub's own view has already flipped optimistically by the time this runs.
  await revalidateRoutines([memberId]);
  return result;
}
