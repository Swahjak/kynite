'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/server/db';
// Table objects come from the schema assembly point, not from a slice barrel
// (same note as `modules/rewards/actions.ts`): a barrel re-exports client
// components, which must not enter a server mutation module.
import { routine, routineStep, timer } from '@/server/db/schema';
import { assertCan, getMember, type Principal } from '@/modules/family';
import { publish } from '@/modules/realtime';
import {
  startFailure,
  stopFailure,
  type StartTimerState,
  type StopTimerState,
} from './action-state';
import { DEFAULT_WARNING_LEAD_SECONDS, MAX_DURATION_SECONDS } from './domain/countdown';

/**
 * Mutations for the timers slice (M09).
 *
 * Two actions, because a timer has exactly two things a person can do to it.
 * Both open with `assertCan('timer:control')` — the §7 capability that already
 * exists for "Start/stop timers", granted to owners, adults, children on the
 * hub, contributor caregivers and paired devices — before any database
 * identifier is referenced, which is what
 * `tests/unit/server-action-authorization.test.ts` audits structurally.
 *
 * **Nothing here writes a remaining time.** `startedAt` is stamped from the
 * server's clock and `durationSeconds` is fixed; every reader derives the rest
 * (`domain/countdown.ts`). A client that lies about what time it is therefore
 * cannot lengthen or shorten a countdown — it can only be wrong on its own
 * screen for as long as it takes the next server echo to correct it.
 */

const trimmed = z.string().trim();

/**
 * The realtime `actor` for a principal. A `member` principal names itself; a
 * paired kiosk names its device (M12). Neither is invented from a form.
 */
function actorOf(principal: Principal): { memberId?: string; deviceId?: string } {
  if (principal.kind === 'member') return { memberId: principal.memberId };
  if (principal.kind === 'device') return { deviceId: principal.deviceId };
  return {};
}

/**
 * Every surface a running timer appears on.
 *
 * No SSE yet (M10 owns realtime), so the hub polls `/api/timers` and this
 * revalidation covers the server-rendered surfaces. `publish()` is already
 * called inside each transaction below, so when the stream lands it replaces
 * the poll rather than adding a call site.
 */
async function revalidateTimers(): Promise<void> {
  const locale = await getLocale();
  revalidatePath(`/${locale}/timers`);
  revalidatePath(`/${locale}/hub`);
  revalidatePath(`/${locale}/hub/timers`);
}

const startSchema = z.object({
  /** Ad hoc timers name themselves; a step timer takes the step's title. */
  label: trimmed.max(120).optional(),
  durationSeconds: z.number().int().min(1).max(MAX_DURATION_SECONDS).optional(),
  memberId: z.uuid().optional(),
  routineStepId: z.uuid().optional(),
  /** `null` = no transition warning at all; omitted = the studied 5 minutes. */
  warningLeadSeconds: z.number().int().min(0).max(MAX_DURATION_SECONDS).nullable().optional(),
  clientId: trimmed.min(8).max(200).optional(),
});

export type StartTimerInput = z.infer<typeof startSchema>;

/**
 * Start a timer — from a routine step's `timerSeconds` prescription, or ad hoc
 * from the Controller (M09 scope).
 *
 * When `routineStepId` is given, the label, duration and owning member come
 * from the *step*, resolved through a join to its routine so the family scope
 * is proven by the query rather than trusted from the form. A forged step id
 * from another household matches nothing and the action fails closed.
 *
 * The insert is `ON CONFLICT DO NOTHING`, absorbing both unique indexes at
 * once: `unique(clientId)` (a retry, an offline replay) and the partial
 * `unique(routineStepId) where stopped_at is null` (a second tap, or a second
 * device). A replay leaves exactly one countdown on the wall.
 */
export async function startTimerAction(input: StartTimerInput): Promise<StartTimerState> {
  const principal = await assertCan('timer:control', { memberId: input.memberId ?? null }).catch(
    () => null
  );
  if (!principal) return startFailure('forbidden');

  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return startFailure('invalidInput');

  const { routineStepId, clientId } = parsed.data;
  const db = getDb();

  let label = parsed.data.label ?? '';
  let durationSeconds = parsed.data.durationSeconds ?? 0;
  let memberId = parsed.data.memberId ?? null;
  let routineId: string | null = null;

  if (routineStepId) {
    // The join is the family check: a step is only reachable through a routine
    // that belongs to the principal's family.
    const [step] = await db
      .select({
        stepId: routineStep.id,
        title: routineStep.title,
        timerSeconds: routineStep.timerSeconds,
        routineId: routine.id,
        ownerMemberId: routine.ownerMemberId,
      })
      .from(routineStep)
      .innerJoin(routine, eq(routine.id, routineStep.routineId))
      .where(and(eq(routineStep.id, routineStepId), eq(routine.familyId, principal.familyId)))
      .limit(1);

    if (!step) return startFailure('stepNotFound');

    label = step.title;
    // The step's prescription wins; an explicit duration is the fallback for a
    // step that carries none.
    durationSeconds = step.timerSeconds ?? durationSeconds;
    memberId = step.ownerMemberId;
    routineId = step.routineId;
  } else if (memberId && !(await getMember(principal.familyId, memberId))) {
    // A uuid from a form: `getMember` returns null for an id that exists but
    // belongs to another family, so a forged id addresses nothing.
    return startFailure('memberNotFound');
  }

  if (label.length === 0) return startFailure('invalidInput');
  if (durationSeconds < 1 || durationSeconds > MAX_DURATION_SECONDS) {
    return startFailure('invalidInput');
  }

  const warningLeadSeconds =
    parsed.data.warningLeadSeconds === undefined
      ? Math.min(DEFAULT_WARNING_LEAD_SECONDS, durationSeconds)
      : parsed.data.warningLeadSeconds;

  const result = await db.transaction(async (tx): Promise<StartTimerState> => {
    const [inserted] = await tx
      .insert(timer)
      .values({
        familyId: principal.familyId,
        memberId,
        routineId,
        routineStepId: routineStepId ?? null,
        label,
        durationSeconds,
        // Stamped server-side, deliberately: this is the one value every
        // device's countdown is derived from (architecture open question 3).
        startedAt: new Date(),
        warningLeadSeconds,
        startedByMemberId: principal.kind === 'member' ? principal.memberId : null,
        clientId: clientId ?? null,
      })
      // No conflict *target*: this absorbs both unique indexes at once — the
      // clientId replay and the one-running-timer-per-step guard.
      .onConflictDoNothing()
      .returning({ id: timer.id });

    if (!inserted) {
      // Nothing was inserted, so a timer for this tap is already running. The
      // wall already shows it; report the one that exists rather than an error.
      const [existing] = await tx
        .select({ id: timer.id })
        .from(timer)
        .where(
          and(
            eq(timer.familyId, principal.familyId),
            isNull(timer.stoppedAt),
            routineStepId
              ? eq(timer.routineStepId, routineStepId)
              : eq(timer.clientId, clientId ?? '')
          )
        )
        .limit(1);

      return existing
        ? { status: 'started', timerId: existing.id, replayed: true }
        : startFailure('alreadyRunning');
    }

    await publish(
      {
        familyId: principal.familyId,
        type: 'timer.started',
        entity: { id: inserted.id },
        actor: { ...actorOf(principal), source: 'mobile' },
        patch: { label, durationSeconds, memberId, routineStepId: routineStepId ?? null },
      },
      tx
    );

    return { status: 'started', timerId: inserted.id, replayed: false };
  });

  await revalidateTimers();
  return result;
}

const stopSchema = z.object({ timerId: z.uuid() });

export type StopTimerInput = z.infer<typeof stopSchema>;

/**
 * Stop a running timer.
 *
 * "Stopped" is the only human-writable state a timer has, and it is not a
 * judgement: a timer that ran over and one that was ended early are the same
 * row afterwards. The update is idempotent by predicate (`stopped_at is
 * null`), so two devices stopping at once leave one stop time, not two.
 */
export async function stopTimerAction(input: StopTimerInput): Promise<StopTimerState> {
  const principal = await assertCan('timer:control').catch(() => null);
  if (!principal) return stopFailure('forbidden');

  const parsed = stopSchema.safeParse(input);
  if (!parsed.success) return stopFailure('invalidInput');

  const { timerId } = parsed.data;

  const outcome = await getDb().transaction(async (tx): Promise<StopTimerState> => {
    const stopped = await tx
      .update(timer)
      .set({ stoppedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(timer.id, timerId),
          eq(timer.familyId, principal.familyId),
          // Already stopped is not an error worth reporting, but it is not a
          // second stop either.
          isNull(timer.stoppedAt)
        )
      )
      .returning({ id: timer.id, memberId: timer.memberId });

    if (stopped.length === 0) return stopFailure('timerNotFound');

    await publish(
      {
        familyId: principal.familyId,
        type: 'timer.stopped',
        entity: { id: timerId },
        actor: { ...actorOf(principal), source: 'mobile' },
        patch: { memberId: stopped[0].memberId },
      },
      tx
    );

    return { status: 'stopped' };
  });

  await revalidateTimers();
  return outcome;
}
