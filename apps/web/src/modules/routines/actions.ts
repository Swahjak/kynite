'use server';

import { assertCan } from '@/modules/family';
import {
  actionFailure as failure,
  completionFailure,
  idleState,
  type ActionState,
  type CompletionState,
} from './action-state';
import { recordCompletion, revalidateRoutines, type CompleteStepInput } from './complete';
import {
  createRoutine,
  deleteRoutine,
  setRoutineActive,
  setRoutineReward,
  undoCompletion,
  updateRoutine,
  type RoutineInput,
  type RoutineWriteResult,
  type UndoCompletionInput,
} from './write';

/**
 * Mutations for the routines slice (M07), as **thin wrappers** over
 * `./write.ts` since M1 of the MCP-parity milestone.
 *
 * Everything that is specific to *this* entry point stays here: resolving the
 * request principal from the session cookie (`assertCan`), turning the
 * builder's `FormData` into the plain object the seam validates, and
 * revalidating the pages the web app renders. The write itself — the `can()`
 * re-check, the transaction, the realtime publish — lives in the seam, so
 * `/api/mcp` reaches identical authorization and identical effects without
 * importing a Server Action (which the `(share)` tree and any route handler
 * may not do anyway, docs/architecture.md §2).
 *
 * Same §2 discipline as every other slice: `assertCan()` is the first
 * statement in every action — before any database identifier is referenced —
 * which is what `tests/unit/server-action-authorization.test.ts` audits
 * structurally.
 */

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
 * The builder posts steps as four parallel arrays (`stepId`, `stepTitle`,
 * `stepTimerSeconds`, `stepIcon`) — the shape an `<input name="…">` repeater
 * produces without any client-side serialisation. Row order *is* the intended
 * order, so `sortOrder` is the array index and reordering in the dialog
 * persists by simply saving.
 */
function readSteps(formData: FormData) {
  const ids = readAll(formData, 'stepId');
  const titles = readAll(formData, 'stepTitle');
  const timers = readAll(formData, 'stepTimerSeconds');
  const icons = readAll(formData, 'stepIcon');

  return titles.flatMap((title, index) => {
    if (title.trim() === '') return [];
    const seconds = Number.parseInt(timers[index] ?? '', 10);
    return [
      {
        id: ids[index] ?? '',
        title,
        timerSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : null,
        icon: icons[index] || null,
      },
    ];
  });
}

/** The builder form → the seam's input shape. Validation happens in the seam. */
function routineInput(formData: FormData): RoutineInput {
  return {
    title: read(formData, 'title'),
    icon: read(formData, 'icon'),
    ownerMemberId: read(formData, 'ownerMemberId'),
    scheduleKind: (read(formData, 'scheduleKind') || 'recurring') as RoutineInput['scheduleKind'],
    weekdays: readAll(formData, 'weekdays') as RoutineInput['weekdays'],
    onceDate: read(formData, 'onceDate'),
    timeOfDay: read(formData, 'timeOfDay'),
    graceDays: readNumber(formData, 'graceDays', 0),
    starsPerCompletion: readNumber(formData, 'starsPerCompletion', 1),
    rewardEnabled: formData.get('rewardEnabled') !== null,
    active: formData.get('active') !== null,
    steps: readSteps(formData),
  };
}

/** Seam result → `ActionState`, revalidating the boards it names. */
async function settle(result: RoutineWriteResult): Promise<ActionState> {
  if (!result.ok) return failure(result.error);
  await revalidateRoutines(result.memberIds);
  return idleState;
}

export async function createRoutineAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('routine:write').catch(() => null);
  if (!principal) return failure('forbidden');

  return settle(await createRoutine(principal, routineInput(formData)));
}

export async function updateRoutineAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('routine:write').catch(() => null);
  if (!principal) return failure('forbidden');

  return settle(
    await updateRoutine(principal, {
      ...routineInput(formData),
      routineId: read(formData, 'routineId'),
    })
  );
}

export async function deleteRoutineAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('routine:write').catch(() => null);
  if (!principal) return failure('forbidden');

  return settle(await deleteRoutine(principal, { routineId: read(formData, 'routineId') }));
}

/**
 * The switch on the parent's routine list (`Routines.dc.html`, mobile beheer).
 *
 * Pausing a routine is the lightest thing a parent does to one, and until M20
 * it cost a whole trip through the builder. It is deliberately *not* a delete
 * — see `setRoutineActive` in `./write.ts` for what it does and does not touch.
 * Posts the *target* state rather than a toggle, so a double submit lands the
 * same value twice instead of flipping back and forth.
 */
export async function setRoutineActiveAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('routine:write').catch(() => null);
  if (!principal) return failure('forbidden');

  return settle(
    await setRoutineActive(principal, {
      routineId: read(formData, 'routineId'),
      active: read(formData, 'active') === 'true',
    })
  );
}

/**
 * The fade path, as a one-tap control (research §Decisions 7, FR17) — the same
 * state transition `updateRoutineAction` performs through its checkbox,
 * extracted so graduating a routine does not require opening the whole builder
 * and re-saving every step. See `setRoutineReward` in `./write.ts`.
 */
export async function setRoutineRewardAction(
  _previous: ActionState,
  formData: FormData
): Promise<ActionState> {
  const principal = await assertCan('routine:write').catch(() => null);
  if (!principal) return failure('forbidden');

  return settle(
    await setRoutineReward(principal, {
      routineId: read(formData, 'routineId'),
      rewardEnabled: read(formData, 'rewardEnabled') === 'true',
    })
  );
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

export type { UndoCompletionInput };

/** Take a completion back. The write and its reasoning live in `./write.ts`. */
export async function undoCompletionAction(input: UndoCompletionInput): Promise<CompletionState> {
  const principal = await assertCan('completion:write').catch(() => null);
  if (!principal) return completionFailure('forbidden');

  const result = await undoCompletion(principal, input);
  if (result.status === 'undone') await revalidateRoutines([result.memberId]);
  return result;
}
