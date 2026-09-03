'use server';

import { revalidatePath } from 'next/cache';
import { getLocale } from 'next-intl/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/server/db';
// Table objects come from the schema assembly point, not from a slice barrel
// (same note as `modules/timers/actions.ts`): a barrel re-exports client
// components, which must not enter a server mutation module.
import { task } from '@/server/db/schema';
import { assertCan, type Principal } from '@/modules/family';
import { publish } from '@/modules/realtime';
import { actionFailure, type ActionState } from './action-state';
import { createTask, type CreateTaskInput } from './write';

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

/**
 * The realtime `actor` for a principal. A `member` principal names itself; a
 * paired kiosk names its device. Neither is invented from a form.
 */
function actorOf(principal: Principal): { memberId?: string; deviceId?: string } {
  if (principal.kind === 'member') return { memberId: principal.memberId };
  if (principal.kind === 'device') return { deviceId: principal.deviceId };
  return {};
}

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

const toggleSchema = z.object({
  taskId: z.uuid(),
  /** What the row should become — never a flip, so a double tap is idempotent. */
  completed: z.boolean(),
});

export type ToggleTaskInput = z.infer<typeof toggleSchema>;

/**
 * Tick a task off, or take it back.
 *
 * The input states the *target* state rather than asking for a flip. Two taps
 * racing from two devices then agree instead of cancelling each other out, and
 * a replayed request is a no-op rather than an un-tick.
 */
export async function toggleTaskAction(input: ToggleTaskInput): Promise<ActionState> {
  const principal = await assertCan('task:complete').catch(() => null);
  if (!principal) return actionFailure('forbidden');

  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return actionFailure('invalidInput');

  const { taskId, completed } = parsed.data;

  const result = await getDb().transaction(async (tx): Promise<ActionState> => {
    const [row] = await tx
      .update(task)
      .set({ completedAt: completed ? new Date() : null, updatedAt: new Date() })
      // Scope from the principal, never from the input: another household's id
      // matches nothing.
      .where(and(eq(task.id, taskId), eq(task.familyId, principal.familyId)))
      .returning({ id: task.id });

    if (!row) return actionFailure('taskNotFound');

    await publish(
      {
        familyId: principal.familyId,
        type: 'task.upserted',
        entity: { id: row.id },
        actor: { ...actorOf(principal), source: 'mobile' },
        patch: { completed },
      },
      tx
    );

    return { status: 'saved', taskId: row.id };
  });

  if (result.status === 'saved') await revalidateTasks();
  return result;
}

const deleteSchema = z.object({ taskId: z.uuid() });

export type DeleteTaskInput = z.infer<typeof deleteSchema>;

export async function deleteTaskAction(input: DeleteTaskInput): Promise<ActionState> {
  const principal = await assertCan('task:write').catch(() => null);
  if (!principal) return actionFailure('forbidden');

  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return actionFailure('invalidInput');

  const { taskId } = parsed.data;

  const result = await getDb().transaction(async (tx): Promise<ActionState> => {
    const [row] = await tx
      .delete(task)
      .where(and(eq(task.id, taskId), eq(task.familyId, principal.familyId)))
      .returning({ id: task.id });

    if (!row) return actionFailure('taskNotFound');

    await publish(
      {
        familyId: principal.familyId,
        type: 'task.deleted',
        entity: { id: row.id },
        actor: { ...actorOf(principal), source: 'mobile' },
      },
      tx
    );

    return { status: 'saved', taskId: row.id };
  });

  if (result.status === 'saved') await revalidateTasks();
  return result;
}
