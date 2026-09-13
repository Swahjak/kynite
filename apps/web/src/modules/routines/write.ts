import 'server-only';
import { and, eq, isNull, notInArray } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/server/db';
// Table objects from the schema assembly point, not a slice barrel — the same
// note as in `./actions.ts` and `./complete.ts`.
import { completion, routine, routineStep } from '@/server/db/schema';
import { can, getMember, type Principal } from '@/modules/family';
import { publish } from '@/modules/realtime';
import { completionFailure, type CompletionState } from './action-state';
import { actorOf } from './complete';
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
 * The write seam for the routines slice (MCP milestone M1).
 *
 * Same shape and the same discipline as `modules/tasks/write.ts` and
 * `modules/calendar/write.ts`: every function takes an explicit `Principal`,
 * calls `can()` *itself* rather than trusting the caller, validates its own
 * input, and imports nothing from `next/cache` — revalidation is the caller's
 * concern, because `/api/mcp` has no page to revalidate. `./actions.ts` is now
 * a set of thin wrappers over these (session → principal → seam → revalidate),
 * and `/api/mcp/tools/routines.ts` calls the same functions with the principal
 * resolved from a bearer token. MCP never imports a Server Action.
 *
 * The input shape is a plain object, not `FormData`: the builder form is one
 * caller of many now, so parsing its three parallel step arrays stays in
 * `actions.ts` where that transport is known.
 */

const trimmed = z.string().trim();

const stepSchema = z.object({
  id: z.union([z.uuid(), z.literal('')]),
  title: trimmed.min(1).max(120),
  /** `null` = untimed. Bounded at two hours: a step is a step, not a day. */
  timerSeconds: z.number().int().min(5).max(7200).nullable(),
});

/**
 * The routine body both `createRoutine` and `updateRoutine` accept. Moved here
 * verbatim from `./actions.ts` (M1) so the two entry points validate through
 * one definition rather than two that drift.
 */
export const routineSchema = z
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

/** The raw (pre-validation) routine body — untrusted. */
export type RoutineInput = z.input<typeof routineSchema>;
export type UpdateRoutineInput = RoutineInput & { routineId: string };

export type RoutineWriteResult =
  | {
      ok: true;
      routineId: string;
      /** Whose board changed — what a web caller revalidates. */
      memberIds: string[];
    }
  | { ok: false; error: string };

/**
 * The validated body → the `schedule` jsonb. Null when the two cannot be
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

type ResolvedInput = z.infer<typeof routineSchema> & { schedule: Schedule };

async function resolveInput(
  familyId: string,
  input: RoutineInput
): Promise<{ ok: true; input: ResolvedInput } | { ok: false; error: string }> {
  const parsed = routineSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const schedule = scheduleOf(parsed.data);
  if (!schedule) return { ok: false, error: 'invalidInput' };

  // `ownerMemberId` is a uuid the caller supplied. `getMember` returns null for
  // an id that exists but belongs to another family, which is what turns a
  // forged cross-family id into a rejection instead of a silent cross-tenant
  // write. FR9: it is also why a routine can never end up unowned.
  if (!(await getMember(familyId, parsed.data.ownerMemberId))) {
    return { ok: false, error: 'memberNotFound' };
  }

  return { ok: true, input: { ...parsed.data, schedule } };
}

export async function createRoutine(
  principal: Principal,
  input: RoutineInput
): Promise<RoutineWriteResult> {
  if (!can(principal, 'routine:write', { familyId: principal.familyId })) {
    return { ok: false, error: 'forbidden' };
  }

  const resolved = await resolveInput(principal.familyId, input);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const body = resolved.input;

  const created = await getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(routine)
      .values({
        familyId: principal.familyId,
        ownerMemberId: body.ownerMemberId,
        title: body.title,
        icon: body.icon,
        schedule: body.schedule,
        starsPerCompletion: body.starsPerCompletion,
        rewardEnabled: body.rewardEnabled,
        active: body.active,
      })
      .returning({ id: routine.id });

    await tx.insert(routineStep).values(
      body.steps.map((step, index) => ({
        routineId: row.id,
        title: step.title,
        timerSeconds: step.timerSeconds,
        sortOrder: index,
      }))
    );

    await publish(
      {
        familyId: principal.familyId,
        type: 'routine.updated',
        entity: { id: row.id },
        actor: { ...actorOf(principal), source: 'mobile' },
      },
      tx
    );

    return row;
  });

  return { ok: true, routineId: created.id, memberIds: [body.ownerMemberId] };
}

export async function updateRoutine(
  principal: Principal,
  input: UpdateRoutineInput
): Promise<RoutineWriteResult> {
  if (!can(principal, 'routine:write', { familyId: principal.familyId })) {
    return { ok: false, error: 'forbidden' };
  }

  const { routineId } = input;
  if (!z.uuid().safeParse(routineId).success) return { ok: false, error: 'invalidInput' };

  const resolved = await resolveInput(principal.familyId, input);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const body = resolved.input;
  const db = getDb();

  const [existing] = await db
    .select()
    .from(routine)
    .where(and(eq(routine.id, routineId), eq(routine.familyId, principal.familyId)))
    .limit(1);

  if (!existing) return { ok: false, error: 'routineNotFound' };

  await db.transaction(async (tx) => {
    await tx
      .update(routine)
      .set({
        ownerMemberId: body.ownerMemberId,
        title: body.title,
        icon: body.icon,
        schedule: body.schedule,
        starsPerCompletion: body.starsPerCompletion,
        rewardEnabled: body.rewardEnabled,
        // Fade is a *state*, not a toggle echo: turning rewards off stamps the
        // graduation moment, turning them back on clears it. Either way no
        // star that was already earned is touched — the ledger is append-only.
        fadedAt: body.rewardEnabled ? null : (existing.fadedAt ?? new Date()),
        active: body.active,
        updatedAt: new Date(),
      })
      .where(and(eq(routine.id, routineId), eq(routine.familyId, principal.familyId)));

    const keptIds = body.steps.map((step) => step.id).filter((id) => id !== '');

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

    for (const [index, step] of body.steps.entries()) {
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

  return {
    ok: true,
    routineId,
    memberIds: [body.ownerMemberId, existing.ownerMemberId],
  };
}

export async function deleteRoutine(
  principal: Principal,
  input: { routineId: string }
): Promise<RoutineWriteResult> {
  if (!can(principal, 'routine:write', { familyId: principal.familyId })) {
    return { ok: false, error: 'forbidden' };
  }

  const { routineId } = input;
  if (!z.uuid().safeParse(routineId).success) return { ok: false, error: 'invalidInput' };

  const db = getDb();
  const [existing] = await db
    .select({ id: routine.id, ownerMemberId: routine.ownerMemberId })
    .from(routine)
    .where(and(eq(routine.id, routineId), eq(routine.familyId, principal.familyId)))
    .limit(1);

  if (!existing) return { ok: false, error: 'routineNotFound' };

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

  return { ok: true, routineId, memberIds: [existing.ownerMemberId] };
}

const activeSchema = z.object({ routineId: z.uuid(), active: z.boolean() });
const fadeSchema = z.object({ routineId: z.uuid(), rewardEnabled: z.boolean() });

export type SetRoutineActiveInput = z.input<typeof activeSchema>;
export type SetRoutineRewardInput = z.input<typeof fadeSchema>;

/**
 * Pause or resume a routine — deliberately *not* a delete: the routine, its
 * steps and every star it ever paid stay exactly where they are; it simply
 * stops appearing on the child's board until it is switched back on.
 *
 * Takes the *target* state rather than a toggle, so a double submit lands the
 * same value twice instead of flipping back and forth.
 */
export async function setRoutineActive(
  principal: Principal,
  input: SetRoutineActiveInput
): Promise<RoutineWriteResult> {
  if (!can(principal, 'routine:write', { familyId: principal.familyId })) {
    return { ok: false, error: 'forbidden' };
  }

  const parsed = activeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const { routineId, active } = parsed.data;
  const db = getDb();

  const [existing] = await db
    .select({ id: routine.id, ownerMemberId: routine.ownerMemberId })
    .from(routine)
    .where(and(eq(routine.id, routineId), eq(routine.familyId, principal.familyId)))
    .limit(1);

  if (!existing) return { ok: false, error: 'routineNotFound' };

  await db.transaction(async (tx) => {
    await tx
      .update(routine)
      .set({ active, updatedAt: new Date() })
      .where(and(eq(routine.id, routineId), eq(routine.familyId, principal.familyId)));

    await publish(
      {
        familyId: principal.familyId,
        type: 'routine.updated',
        entity: { id: routineId },
        actor: { ...actorOf(principal), source: 'mobile' },
        patch: { active },
      },
      tx
    );
  });

  return { ok: true, routineId, memberIds: [existing.ownerMemberId] };
}

/**
 * The fade path (research §Decisions 7, FR17). `rewardEnabled = false` stamps
 * `fadedAt` (and re-enabling clears it); the routine keeps working, only
 * `starsFor()` returns 0; **no star already earned is touched** — the ledger is
 * append-only.
 */
export async function setRoutineReward(
  principal: Principal,
  input: SetRoutineRewardInput
): Promise<RoutineWriteResult> {
  if (!can(principal, 'routine:write', { familyId: principal.familyId })) {
    return { ok: false, error: 'forbidden' };
  }

  const parsed = fadeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const { routineId, rewardEnabled } = parsed.data;
  const db = getDb();

  const [existing] = await db
    .select({ id: routine.id, ownerMemberId: routine.ownerMemberId, fadedAt: routine.fadedAt })
    .from(routine)
    .where(and(eq(routine.id, routineId), eq(routine.familyId, principal.familyId)))
    .limit(1);

  if (!existing) return { ok: false, error: 'routineNotFound' };

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

  return { ok: true, routineId, memberIds: [existing.ownerMemberId] };
}

/**
 * Ticking a step. `recordCompletion` (`./complete.ts`) already *is* the
 * principal-taking seam — it was extracted in M13 so a caregiver share link
 * could reach it without a Server Action, and it checks
 * `can('completion:write', { memberId })` against the subject member itself.
 * Re-exported under the seam vocabulary rather than wrapped: a second function
 * that only forwards would be one more place for the two to drift.
 */
export { recordCompletion as completeStep } from './complete';

const undoSchema = z.object({ clientId: trimmed.min(8).max(200) });

export type UndoCompletionInput = z.input<typeof undoSchema>;

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
 * - **It renders nothing on a child surface.** This is the parent's correction
 *   path and the event that carries it.
 */
export async function undoCompletion(
  principal: Principal,
  input: UndoCompletionInput
): Promise<CompletionState> {
  if (!can(principal, 'completion:write', { familyId: principal.familyId })) {
    return completionFailure('forbidden');
  }

  const parsed = undoSchema.safeParse(input);
  if (!parsed.success) return completionFailure('invalidInput');

  const { clientId } = parsed.data;

  return getDb().transaction(async (tx): Promise<CompletionState> => {
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
}
