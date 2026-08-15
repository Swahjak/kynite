'use server';

import { and, eq, isNull, notInArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/server/db';
// Table objects come from the schema assembly point, not from a slice barrel
// (see the same note in `modules/calendar/actions.ts`): a barrel re-exports
// client components, which must not enter a server mutation module.
import { completion, routine, routineStep } from '@/server/db/schema';
import { assertCan, getMember } from '@/modules/family';
import { publish } from '@/modules/realtime';
import {
  actionFailure as failure,
  completionFailure,
  idleState,
  type ActionState,
  type CompletionState,
} from './action-state';
import { actorOf, recordCompletion, revalidateRoutines, type CompleteStepInput } from './complete';
import {
  MAX_GRACE_DAYS,
  SCHEDULE_KINDS,
  WEEKDAYS,
  isValidDateKey,
  ruleForWeekdays,
  type Schedule,
  type Weekday,
} from './domain/schedule';
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

const routineSchema = z
  .object({
    title: trimmed.min(1).max(120),
    icon: trimmed.refine(isRoutineIcon),
    ownerMemberId: z.uuid(),
    /** M20: `'recurring'` reads the weekdays, `'once'` reads `onceDate`. */
    scheduleKind: z.enum(SCHEDULE_KINDS),
    weekdays: z.array(z.enum(WEEKDAYS)),
    /** `YYYY-MM-DD` in the family's zone. Empty for a recurring routine. */
    onceDate: z.string(),
    timeOfDay: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
    graceDays: z.number().int().min(0).max(MAX_GRACE_DAYS),
    starsPerCompletion: z.number().int().min(0).max(20),
    rewardEnabled: z.boolean(),
    active: z.boolean(),
    steps: z.array(stepSchema).min(1).max(20),
  })
  // The two schedule kinds have different required fields, and *neither* may be
  // saved half-answered: a routine with no weekdays is never due, and a one-off
  // with no date is a chore nobody can see. `2026-02-30` fails here too —
  // `isValidDateKey` parses the day rather than matching its shape.
  .superRefine((value, ctx) => {
    if (value.scheduleKind === 'once') {
      if (!isValidDateKey(value.onceDate)) {
        ctx.addIssue({ code: 'custom', path: ['onceDate'], message: 'invalidDate' });
      }
      return;
    }
    if (value.weekdays.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['weekdays'], message: 'noWeekdays' });
    }
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
    scheduleKind: read(formData, 'scheduleKind') || 'recurring',
    weekdays: readAll(formData, 'weekdays'),
    onceDate: read(formData, 'onceDate'),
    timeOfDay: read(formData, 'timeOfDay'),
    graceDays: readNumber(formData, 'graceDays', 0),
    starsPerCompletion: readNumber(formData, 'starsPerCompletion', 1),
    rewardEnabled: formData.get('rewardEnabled') !== null,
    active: formData.get('active') !== null,
    steps: readSteps(formData),
  });
}

type ResolvedInput = z.infer<typeof routineSchema> & { schedule: Schedule };

async function resolveInput(
  familyId: string,
  formData: FormData
): Promise<{ ok: true; input: ResolvedInput } | { ok: false; error: string }> {
  const parsed = routineInput(formData);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const schedule = scheduleOf(parsed.data);
  if (!schedule) return { ok: false, error: 'invalidInput' };

  // `ownerMemberId` is a uuid a form supplied. `getMember` returns null for an
  // id that exists but belongs to another family, which is what turns a forged
  // cross-family id into a rejection instead of a silent cross-tenant write.
  // FR9: it is also why a routine can never end up unowned — there is no code
  // path here that writes one without a member that resolved.
  if (!(await getMember(familyId, parsed.data.ownerMemberId))) {
    return { ok: false, error: 'memberNotFound' };
  }

  return { ok: true, input: { ...parsed.data, schedule } };
}

/**
 * The validated form → the `schedule` jsonb. Null when the two cannot be
 * reconciled, which after `superRefine` means only an unrepresentable weekday
 * set.
 *
 * A one-off stores **no rrule**: it does not recur, and writing a placeholder
 * rule would be a claim the data model would then have to keep true.
 */
function scheduleOf(input: z.infer<typeof routineSchema>): Schedule | null {
  const shared = { timeOfDay: input.timeOfDay, graceDays: input.graceDays };

  if (input.scheduleKind === 'once') {
    return { kind: 'once', date: input.onceDate, ...shared };
  }

  const rrule = ruleForWeekdays(input.weekdays as Weekday[]);
  return rrule ? { kind: 'recurring', rrule, ...shared } : null;
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
        schedule: input.schedule,
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
        schedule: input.schedule,
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

const fadeSchema = z.object({
  routineId: z.uuid(),
  rewardEnabled: z.boolean(),
});

/**
 * The fade path, as a one-tap control (research §Decisions 7, FR17).
 *
 * The same state transition `updateRoutineAction` performs through its
 * checkbox, extracted so graduating a routine does not require opening the
 * whole builder and re-saving every step. It is the same three facts either
 * way:
 *
 * - `rewardEnabled = false` **stamps** `fadedAt` (and re-enabling clears it),
 *   so "when did this become a habit" is a recorded moment rather than an
 *   inference from a boolean;
 * - the routine keeps working — it still appears, still completes, still
 *   celebrates. Only `starsFor()` returns 0, and only for *this* routine;
 * - **no star is touched.** The ledger is append-only, so everything the child
 *   earned from this routine while it paid is still theirs, forever. Fading is
 *   the system becoming unnecessary, not a reward being withdrawn — which is
 *   exactly the distinction the token-economy literature says decides whether
 *   the behaviour survives the token going away.
 */
export async function setRoutineRewardAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('routine:write').catch(() => null);
  if (!principal) return failure('forbidden');

  const parsed = fadeSchema.safeParse({
    routineId: read(formData, 'routineId'),
    rewardEnabled: read(formData, 'rewardEnabled') === 'true',
  });
  if (!parsed.success) return failure('invalidInput');

  const { routineId, rewardEnabled } = parsed.data;
  const db = getDb();

  const [existing] = await db
    .select({ id: routine.id, ownerMemberId: routine.ownerMemberId, fadedAt: routine.fadedAt })
    .from(routine)
    .where(and(eq(routine.id, routineId), eq(routine.familyId, principal.familyId)))
    .limit(1);

  if (!existing) return failure('routineNotFound');

  await db.transaction(async (tx) => {
    await tx
      .update(routine)
      .set({
        rewardEnabled,
        fadedAt: rewardEnabled ? null : (existing.fadedAt ?? new Date()),
        updatedAt: new Date(),
      })
      .where(and(eq(routine.id, routineId), eq(routine.familyId, principal.familyId)));

    await publish(
      {
        familyId: principal.familyId,
        type: 'routine.updated',
        entity: { id: routineId },
        actor: { ...actorOf(principal), source: 'mobile' },
        patch: { rewardEnabled },
      },
      tx
    );
  });

  await revalidateRoutines([existing.ownerMemberId]);
  return idleState;
}

/**
 * A single tap on the hub (FR8).
 *
 * The write itself moved to `./complete.ts` in M13, unchanged: a caregiver
 * share link ticks the same step through `POST /api/share/completions`, and the
 * `(share)` tree may not import a Server Action, so the two entry points share
 * one implementation rather than two that drift. What stays here is the part
 * that is specific to *this* entry point — resolving the request principal from
 * a session cookie via `assertCan`, which is meaningless for a link that has
 * no session at all.
 */
export async function completeStepAction(input: CompleteStepInput): Promise<CompletionState> {
  const principal = await assertCan('completion:write', { memberId: input.memberId }).catch(
    () => null
  );
  if (!principal) return completionFailure('forbidden');

  return recordCompletion(principal, input);
}

const undoSchema = z.object({ clientId: trimmed.min(8).max(200) });

export type UndoCompletionInput = z.infer<typeof undoSchema>;

/**
 * Take a completion back (the `completion.undone` half of §4's vocabulary).
 *
 * Addressed by `clientId` rather than by row id, because that is the key the
 * device that tapped already holds — an undo is always "the thing I just did",
 * and it must work from an outbox entry whose server id never came back.
 *
 * Three things it deliberately does not do:
 *
 * - **It does not delete the row.** See `completion.undoneAt` in `schema.ts`:
 *   the row is what stops a re-tap from paying a second star.
 * - **It does not touch the star ledger.** The ledger is append-only and
 *   `stars:remove` is `deny` in every column of the §7 matrix. Un-ticking a
 *   step is a correction to *this board*, never a withdrawal from a child's
 *   history — undo and re-tap nets one star, not zero and not two.
 * - **It renders nothing on a child surface.** No affordance ships in M10;
 *   this is the parent's correction path and the event that carries it.
 */
export async function undoCompletionAction(input: UndoCompletionInput): Promise<CompletionState> {
  const principal = await assertCan('completion:write').catch(() => null);
  if (!principal) return completionFailure('forbidden');

  const parsed = undoSchema.safeParse(input);
  if (!parsed.success) return completionFailure('invalidInput');

  const { clientId } = parsed.data;

  const result = await getDb().transaction(async (tx): Promise<CompletionState> => {
    const [undone] = await tx
      .update(completion)
      .set({ undoneAt: new Date() })
      .where(
        and(
          // Scope from the principal, never from the input: a `clientId`
          // guessed from another household addresses nothing.
          eq(completion.familyId, principal.familyId),
          eq(completion.clientId, clientId),
          // Idempotent by predicate: undoing twice stamps one moment.
          isNull(completion.undoneAt)
        )
      )
      .returning({
        id: completion.id,
        memberId: completion.memberId,
        routineId: completion.routineId,
        routineStepId: completion.routineStepId,
        occurrenceDate: completion.occurrenceDate,
      });

    if (!undone) return completionFailure('completionNotFound');

    await publish(
      {
        familyId: principal.familyId,
        type: 'completion.undone',
        entity: { id: undone.id },
        actor: { ...actorOf(principal), clientId, source: 'mobile' },
        patch: {
          routineId: undone.routineId,
          routineStepId: undone.routineStepId,
          occurrenceDate: undone.occurrenceDate,
        },
      },
      tx
    );

    return { status: 'undone', memberId: undone.memberId } as const;
  });

  if (result.status === 'undone') await revalidateRoutines([result.memberId]);
  return result;
}
