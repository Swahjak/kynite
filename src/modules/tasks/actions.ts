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
import { assertCan, getMember, type Principal } from '@/modules/family';
import { publish } from '@/modules/realtime';
import { actionFailure, type ActionState } from './action-state';

/**
 * Mutations for the tasks slice.
 *
 * Three actions, because a task has exactly three things a person can do to it:
 * write one down, tick it off (or un-tick it), and throw it away.
 *
 * **The capability is `routine:write`, not a new one.** §7's matrix grades
 * "Create/edit routines & chores" owner/adult `allow` and everyone else `deny`,
 * and a task *is* a chore — the lightweight one this product was missing.
 * Minting a `task:write` cell that would be a verbatim copy of an existing row
 * would add a column to the permission matrix without adding a permission, and
 * every surface that may author a chore may author a task by construction.
 *
 * Every action opens with `assertCan` before any database identifier is
 * referenced, which is what `tests/unit/server-action-authorization.test.ts`
 * audits structurally.
 */

const trimmed = z.string().trim();

/** `YYYY-MM-DD` in the family's zone; the column is a `date`, never an instant. */
const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

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

const createSchema = z.object({
  title: trimmed.min(1).max(200),
  /** Null / omitted = nobody in particular, which is most of a household list. */
  assigneeMemberId: z.uuid().nullable().optional(),
  dueDate: dateKey,
});

export type CreateTaskInput = z.infer<typeof createSchema>;

export async function createTaskAction(input: CreateTaskInput): Promise<ActionState> {
  const principal = await assertCan('routine:write').catch(() => null);
  if (!principal) return actionFailure('forbidden');

  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return actionFailure('invalidInput');

  const { title, assigneeMemberId, dueDate } = parsed.data;

  // The assignee is *proven* to be in this family rather than trusted from the
  // form: a forged id from another household resolves to nothing and the task
  // is written unassigned rather than pointing across a family boundary.
  const assignee = assigneeMemberId
    ? ((await getMember(principal.familyId, assigneeMemberId))?.id ?? null)
    : null;
  if (assigneeMemberId && !assignee) return actionFailure('memberNotFound');

  const created = await getDb().transaction(async (tx) => {
    const [row] = await tx
      .insert(task)
      .values({
        familyId: principal.familyId,
        title,
        assigneeMemberId: assignee,
        dueDate: dueDate ?? null,
        createdByMemberId: principal.kind === 'member' ? principal.memberId : null,
      })
      .returning({ id: task.id });

    await publish(
      {
        familyId: principal.familyId,
        type: 'task.upserted',
        entity: { id: row.id },
        actor: { ...actorOf(principal), source: 'mobile' },
        patch: { title, assigneeMemberId: assignee, dueDate: dueDate ?? null, completed: false },
      },
      tx
    );

    return row;
  });

  await revalidateTasks();
  return { status: 'saved', taskId: created.id };
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
  const principal = await assertCan('routine:write').catch(() => null);
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
  const principal = await assertCan('routine:write').catch(() => null);
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
