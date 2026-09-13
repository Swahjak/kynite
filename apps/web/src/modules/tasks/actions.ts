'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { assertCan } from '@/modules/family';
import { actionFailure, type ActionState } from './action-state';
import {
  createTask,
  deleteTask,
  toggleTask,
  type CreateTaskInput,
  type DeleteTaskInput,
  type ToggleTaskInput,
} from './write';

/**
 * Mutations for the tasks slice.
 *
 * Three actions, because a task has exactly three things a person can do to it:
 * write one down, tick it off (or un-tick it), and throw it away.
 *
 * **Two capabilities, not one** (docs/architecture.md §7): `task:write` for
 * authoring — create and delete, owner/adult only, same grade `routine:write`
 * has always carried — and `task:complete` for the tick, which is also open to
 * a child member and a paired hub device. That split mirrors the one the
 * routines slice already draws between `routine:write` and `completion:write`,
 * and for the same reason: finishing something and being allowed to invent or
 * remove it are different powers, and the wall display coming next may tick a
 * task's box without ever being trusted to author the household's list.
 *
 * Every action opens with `assertCan` before any database identifier is
 * referenced, which is what `tests/unit/server-action-authorization.test.ts`
 * audits structurally.
 */

/** Every surface a task appears on. Today's list is the only one so far. */
async function revalidateTasks(): Promise<void> {
  const locale = await getLocale();
  revalidatePath(`/${locale}/today`);
}

export type { CreateTaskInput } from './write';

export async function createTaskAction(input: CreateTaskInput): Promise<ActionState> {
  const principal = await assertCan('task:write').catch(() => null);
  if (!principal) return actionFailure('forbidden');

  const result = await createTask(principal, input);
  if (!result.ok) return actionFailure(result.error);

  await revalidateTasks();
  return { status: 'saved', taskId: result.taskId };
}

export type { ToggleTaskInput } from './write';

/**
 * Tick a task off, or take it back.
 *
 * The input states the *target* state rather than asking for a flip. Two taps
 * racing from two devices then agree instead of cancelling each other out, and
 * a replayed request is a no-op rather than an un-tick. `assertCan` here is a
 * cheap early rejection, not the decision — `toggleTask` (`./write.ts`)
 * re-checks `can()` against the resolved principal, the same discipline
 * `createTaskAction` already follows below.
 */
export async function toggleTaskAction(input: ToggleTaskInput): Promise<ActionState> {
  const principal = await assertCan('task:complete').catch(() => null);
  if (!principal) return actionFailure('forbidden');

  const result = await toggleTask(principal, input);
  if (!result.ok) return actionFailure(result.error);

  await revalidateTasks();
  return { status: 'saved', taskId: result.taskId };
}

export type { DeleteTaskInput } from './write';

export async function deleteTaskAction(input: DeleteTaskInput): Promise<ActionState> {
  const principal = await assertCan('task:write').catch(() => null);
  if (!principal) return actionFailure('forbidden');

  const result = await deleteTask(principal, input);
  if (!result.ok) return actionFailure(result.error);

  await revalidateTasks();
  return { status: 'saved', taskId: result.taskId };
}
