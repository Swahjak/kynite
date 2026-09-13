import 'server-only';
import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/server/db';
// Table objects from the schema assembly point, not a slice barrel — same
// note as `./actions.ts`.
import { routine, routineStep, timer } from '@/server/db/schema';
import { can, getMember, type Principal } from '@/modules/family';
import { publish } from '@/modules/realtime';
import {
  extendFailure,
  pauseFailure,
  resumeFailure,
  startFailure,
  stopFailure,
  type ExtendTimerState,
  type PauseTimerState,
  type ResumeTimerState,
  type StartTimerState,
  type StopTimerState,
} from './action-state';
import {
  DEFAULT_WARNING_LEAD_SECONDS,
  EXTEND_PRESET_MINUTES,
  MAX_DURATION_SECONDS,
} from './domain/countdown';
import { isTimerIcon } from './ui/tokens';

/**
 * The write seam for the timers slice (MCP milestone M2).
 *
 * Same shape and the same discipline as `modules/tasks/write.ts` and
 * `modules/routines/write.ts`: every function takes an explicit `Principal`,
 * calls `can()` itself rather than trusting the caller, validates its own
 * input, and imports nothing from `next/cache` — revalidation is the
 * caller's concern (`./actions.ts` does it for the web app; `/api/mcp`'s
 * tools do not, since there is no page to revalidate). `./actions.ts` is now
 * a set of thin wrappers over these (assertCan → delegate → revalidate),
 * and `/api/mcp/tools/timers.ts` calls the same functions with the principal
 * resolved from a bearer token. MCP never imports a Server Action.
 *
 * Every publish/realtime side effect that used to live in `actions.ts` moved
 * here with the write it belongs to — a timer MCP triggers is exactly as
 * live on the wall as one a Server Action started.
 */

const trimmed = z.string().trim();

/**
 * The realtime `actor` for a principal. A `member` principal names itself; a
 * paired kiosk names its device. Neither is invented from a form.
 */
function actorOf(principal: Principal): { memberId?: string; deviceId?: string } {
  if (principal.kind === 'member') return { memberId: principal.memberId };
  if (principal.kind === 'device') return { deviceId: principal.deviceId };
  return {};
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
  /**
   * The closed `TIMER_ICONS` set: a client posts a name, not a codepoint, and
   * an unrecognised one is a malformed request rather than something to
   * silently default. Omitted = fall back to the parent routine's icon, or
   * the plain default (`ui/tokens.ts`'s `timerIconOf`).
   */
  icon: z.string().refine(isTimerIcon).optional(),
});

export type StartTimerInput = z.input<typeof startSchema>;

/**
 * Start a timer — from a routine step's `timerSeconds` prescription, or ad
 * hoc.
 *
 * When `routineStepId` is given, the label, duration and owning member come
 * from the *step*, resolved through a join to its routine so the family
 * scope is proven by the query rather than trusted from the caller. A forged
 * step id from another household matches nothing and the call fails closed.
 *
 * The insert is `ON CONFLICT DO NOTHING`, absorbing both unique indexes at
 * once: `unique(clientId)` (a retry, an offline replay) and the partial
 * `unique(routineStepId) where stopped_at is null` (a second tap, or a
 * second device/client). A replay leaves exactly one countdown on the wall.
 */
export async function startTimer(
  principal: Principal,
  input: StartTimerInput
): Promise<StartTimerState> {
  if (
    !can(principal, 'timer:control', {
      familyId: principal.familyId,
      memberId: input.memberId ?? null,
    })
  ) {
    return startFailure('forbidden');
  }

  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return startFailure('invalidInput');

  const { routineStepId, clientId } = parsed.data;
  const db = getDb();

  let label = parsed.data.label ?? '';
  let durationSeconds = parsed.data.durationSeconds ?? 0;
  let memberId = parsed.data.memberId ?? null;
  let routineId: string | null = null;

  if (routineStepId) {
    // The join is the family check: a step is only reachable through a
    // routine that belongs to the principal's family.
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

    // Authorize on one subject, act on another is the bug shape that must
    // never be in the codebase: the check above ran against `input.memberId`
    // (a value from the caller), and the step's *real* owner is what is
    // actually used below — so it is re-authorized before it is used.
    if (
      !can(principal, 'timer:control', {
        familyId: principal.familyId,
        memberId: step.ownerMemberId,
      })
    ) {
      return startFailure('forbidden');
    }

    label = step.title;
    // The step's prescription wins; an explicit duration is the fallback for
    // a step that carries none.
    durationSeconds = step.timerSeconds ?? durationSeconds;
    memberId = step.ownerMemberId;
    routineId = step.routineId;
  } else if (memberId && !(await getMember(principal.familyId, memberId))) {
    // A uuid from the caller: `getMember` returns null for an id that exists
    // but belongs to another family, so a forged id addresses nothing.
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

  return db.transaction(async (tx): Promise<StartTimerState> => {
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
        // device's countdown is derived from.
        startedAt: new Date(),
        warningLeadSeconds,
        startedByMemberId: principal.kind === 'member' ? principal.memberId : null,
        clientId: clientId ?? null,
        icon: parsed.data.icon ?? null,
      })
      // No conflict *target*: this absorbs both unique indexes at once — the
      // clientId replay and the one-running-timer-per-step guard.
      .onConflictDoNothing()
      .returning({ id: timer.id });

    if (!inserted) {
      // Nothing was inserted, so this tap already has a row. Report it
      // rather than an error — but *which* row depends on which unique index
      // bit, and the two are not symmetrical.
      //
      // `timer_client_id_unique` is a plain unique index over the whole
      // table; `timer_running_step_unique` is partial (`WHERE stopped_at IS
      // NULL`). So: the clientId lookup ignores `stoppedAt` (the key
      // identifies one tap for all time), and the step lookup keeps it (the
      // partial index only ever blocks a *running* timer, and yesterday's
      // stopped one must not be reported for today's tap).
      const [existing] = await tx
        .select({ id: timer.id })
        .from(timer)
        .where(
          and(
            eq(timer.familyId, principal.familyId),
            clientId
              ? eq(timer.clientId, clientId)
              : and(isNull(timer.stoppedAt), eq(timer.routineStepId, routineStepId ?? ''))!
          )
        )
        .orderBy(desc(timer.startedAt))
        .limit(1);

      if (existing) return { status: 'started', timerId: existing.id, replayed: true };

      // No clientId row: the conflict was the running-step guard against a
      // timer this tap did not mint. That one *is* "already running".
      if (routineStepId) {
        const [running] = await tx
          .select({ id: timer.id })
          .from(timer)
          .where(
            and(
              eq(timer.familyId, principal.familyId),
              isNull(timer.stoppedAt),
              eq(timer.routineStepId, routineStepId)
            )
          )
          .limit(1);

        if (running) return { status: 'started', timerId: running.id, replayed: true };
      }

      return startFailure('alreadyRunning');
    }

    await publish(
      {
        familyId: principal.familyId,
        type: 'timer.started',
        entity: { id: inserted.id },
        actor: { ...actorOf(principal), source: 'mobile' },
        patch: {
          label,
          durationSeconds,
          memberId,
          routineStepId: routineStepId ?? null,
          icon: parsed.data.icon ?? null,
        },
      },
      tx
    );

    return { status: 'started', timerId: inserted.id, replayed: false };
  });
}

const stopSchema = z.object({ timerId: z.uuid() });

export type StopTimerInput = z.input<typeof stopSchema>;

/**
 * Stop a running timer.
 *
 * "Stopped" is the only human-writable state a timer has, and it is not a
 * judgement: a timer that ran over and one that was ended early are the same
 * row afterwards. The update is idempotent by predicate (`stopped_at is
 * null`), so two devices/clients stopping at once leave one stop time, not
 * two.
 */
export async function stopTimer(
  principal: Principal,
  input: StopTimerInput
): Promise<StopTimerState> {
  if (!can(principal, 'timer:control', { familyId: principal.familyId })) {
    return stopFailure('forbidden');
  }

  const parsed = stopSchema.safeParse(input);
  if (!parsed.success) return stopFailure('invalidInput');

  const { timerId } = parsed.data;

  return getDb().transaction(async (tx): Promise<StopTimerState> => {
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
}

const extendSchema = z.object({
  timerId: z.uuid(),
  /**
   * Minutes, from the closed preset list — not a free number. `MAX_DURATION_SECONDS`
   * still caps the total below.
   */
  minutes: z
    .number()
    .int()
    .refine((value) => (EXTEND_PRESET_MINUTES as readonly number[]).includes(value)),
});

export type ExtendTimerInput = z.input<typeof extendSchema>;

/**
 * Give a running timer longer (PRD FR7).
 *
 * Server-authoritative like everything else in this slice: the *duration*
 * moves, `startedAt` never does. A caller that posts a longer duration than
 * the cap gets the cap, computed in SQL — `least(duration + n, max)` — so two
 * calls racing cannot add up past it.
 *
 * The `stopped_at is null` predicate is the whole idempotency story: a timer
 * that has already ended cannot be extended into life.
 *
 * An overrun timer can still be extended, and that is deliberate — "stopped"
 * and "past its duration" are different states.
 *
 * A timer already at `MAX_DURATION_SECONDS` returns `atMaximum` and
 * publishes nothing.
 */
export async function extendTimer(
  principal: Principal,
  input: ExtendTimerInput
): Promise<ExtendTimerState> {
  if (!can(principal, 'timer:control', { familyId: principal.familyId })) {
    return extendFailure('forbidden');
  }

  const parsed = extendSchema.safeParse(input);
  if (!parsed.success) return extendFailure('invalidInput');

  const { timerId, minutes } = parsed.data;
  const added = minutes * 60;

  return getDb().transaction(async (tx): Promise<ExtendTimerState> => {
    // Read the current duration under a row lock first: the cap is enforced
    // in SQL below regardless, but "did this actually change anything"
    // cannot be answered by an UPDATE that returns only the new value.
    const [current] = await tx
      .select({ durationSeconds: timer.durationSeconds })
      .from(timer)
      .where(
        and(
          eq(timer.id, timerId),
          eq(timer.familyId, principal.familyId),
          // Same predicate as the update: a stopped timer is not "at
          // maximum", it is gone, and must fall through to `timerNotFound`.
          isNull(timer.stoppedAt)
        )
      )
      .limit(1)
      .for('update');

    if (current && current.durationSeconds >= MAX_DURATION_SECONDS) {
      return { status: 'atMaximum', durationSeconds: current.durationSeconds };
    }

    const [extended] = await tx
      .update(timer)
      .set({
        durationSeconds: sql`least(${timer.durationSeconds} + ${added}, ${MAX_DURATION_SECONDS})`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(timer.id, timerId),
          eq(timer.familyId, principal.familyId),
          // Only something still on the wall can be given longer.
          isNull(timer.stoppedAt)
        )
      )
      .returning({
        id: timer.id,
        memberId: timer.memberId,
        durationSeconds: timer.durationSeconds,
      });

    if (!extended) return extendFailure('timerNotFound');

    await publish(
      {
        familyId: principal.familyId,
        type: 'timer.extended',
        entity: { id: timerId },
        actor: { ...actorOf(principal), source: 'mobile' },
        patch: { memberId: extended.memberId, durationSeconds: extended.durationSeconds },
      },
      tx
    );

    return { status: 'extended', durationSeconds: extended.durationSeconds };
  });
}

const pauseSchema = z.object({ timerId: z.uuid() });

export type PauseTimerInput = z.input<typeof pauseSchema>;

/**
 * Freeze a running timer.
 *
 * Same idempotent-guard shape as `stopTimer`: the update's own predicate —
 * not running, not already paused, this family — is the whole refusal
 * story, so a second pause call (a retry, two devices/clients) is a no-op
 * rather than a second freeze. `pausedAt` is stamped from the server's
 * clock, same as `startedAt` always has been.
 */
export async function pauseTimer(
  principal: Principal,
  input: PauseTimerInput
): Promise<PauseTimerState> {
  if (!can(principal, 'timer:control', { familyId: principal.familyId })) {
    return pauseFailure('forbidden');
  }

  const parsed = pauseSchema.safeParse(input);
  if (!parsed.success) return pauseFailure('invalidInput');

  const { timerId } = parsed.data;

  return getDb().transaction(async (tx): Promise<PauseTimerState> => {
    const paused = await tx
      .update(timer)
      .set({ pausedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(timer.id, timerId),
          eq(timer.familyId, principal.familyId),
          // Not already stopped, and not already paused — both are why this
          // call has nothing to do.
          isNull(timer.stoppedAt),
          isNull(timer.pausedAt)
        )
      )
      .returning({ id: timer.id, memberId: timer.memberId });

    if (paused.length === 0) return pauseFailure('timerNotFound');

    await publish(
      {
        familyId: principal.familyId,
        type: 'timer.paused',
        entity: { id: timerId },
        actor: { ...actorOf(principal), source: 'mobile' },
        patch: { memberId: paused[0].memberId },
      },
      tx
    );

    return { status: 'paused' };
  });
}

const resumeSchema = z.object({ timerId: z.uuid() });

export type ResumeTimerInput = z.input<typeof resumeSchema>;

/**
 * Unfreeze a paused timer.
 *
 * The one arithmetic step this seam owns: fold the just-finished pause into
 * `pausedSeconds` before clearing `pausedAt`, computed in SQL from the
 * server's own clock (`now() - paused_at`) rather than round-tripped through
 * the caller — the same reason `extendTimer` computes its `least()` cap in
 * SQL instead of trusting a caller-supplied number. `startedAt` never moves;
 * this is the only other value that can change on a timer besides
 * `stoppedAt` and `pausedAt` itself.
 */
export async function resumeTimer(
  principal: Principal,
  input: ResumeTimerInput
): Promise<ResumeTimerState> {
  if (!can(principal, 'timer:control', { familyId: principal.familyId })) {
    return resumeFailure('forbidden');
  }

  const parsed = resumeSchema.safeParse(input);
  if (!parsed.success) return resumeFailure('invalidInput');

  const { timerId } = parsed.data;

  return getDb().transaction(async (tx): Promise<ResumeTimerState> => {
    const resumed = await tx
      .update(timer)
      .set({
        pausedSeconds: sql`${timer.pausedSeconds} + floor(extract(epoch from (now() - ${timer.pausedAt})))::integer`,
        pausedAt: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(timer.id, timerId),
          eq(timer.familyId, principal.familyId),
          isNull(timer.stoppedAt),
          // Nothing to resume unless it is actually paused.
          isNotNull(timer.pausedAt)
        )
      )
      .returning({ id: timer.id, memberId: timer.memberId, pausedSeconds: timer.pausedSeconds });

    if (resumed.length === 0) return resumeFailure('timerNotFound');

    await publish(
      {
        familyId: principal.familyId,
        type: 'timer.resumed',
        entity: { id: timerId },
        actor: { ...actorOf(principal), source: 'mobile' },
        patch: { memberId: resumed[0].memberId, pausedSeconds: resumed[0].pausedSeconds },
      },
      tx
    );

    return { status: 'resumed' };
  });
}
