import 'server-only';
import { z } from 'zod';
import { getDb } from '@/server/db';
// Table object from the schema assembly point, not the slice barrel — same
// note as `./actions.ts`.
import { task } from '@/server/db/schema';
import { can, getMember, type Principal } from '@/modules/family';
import { publish } from '@/modules/realtime';

/**
 * The write seam for the tasks slice (MCP milestone M-B).
 *
 * `createTask(principal, input)` is `recordCompletion`'s shape
 * (`modules/routines/complete.ts`) and `modules/calendar/write.ts`'s
 * `createEvent` twin: an explicit `Principal`, its own `can()` check inside
 * the seam (redundant with the action wrapper's `assertCan` by design — see
 * `recordCompletion`'s doc comment on why a shared write checks for itself
 * rather than trusting every future caller to remember), and no `next/cache`
 * import, so a future `/api/mcp` route can call it exactly as
 * `createTaskAction` does. `createTaskAction` is now a thin wrapper:
 * authorize → delegate to `createTask` → revalidate.
 */

const trimmed = z.string().trim();

/** `YYYY-MM-DD` in the family's zone; the column is a `date`, never an instant. */
const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();

export const createTaskSchema = z.object({
  title: trimmed.min(1).max(200),
  /** Null / omitted = nobody in particular, which is most of a household list. */
  assigneeMemberId: z.uuid().nullable().optional(),
  dueDate: dateKey,
});

/** The raw (pre-validation) shape `createTask` accepts — untrusted. */
export type CreateTaskInput = z.input<typeof createTaskSchema>;

/**
 * The realtime `actor` for a principal. A `member` principal names itself; a
 * paired kiosk names its device. Neither is invented from the caller.
 */
function actorOf(principal: Principal): { memberId?: string; deviceId?: string } {
  if (principal.kind === 'member') return { memberId: principal.memberId };
  if (principal.kind === 'device') return { deviceId: principal.deviceId };
  return {};
}

export type CreateTaskResult = { ok: true; taskId: string } | { ok: false; error: string };

/**
 * Create a task for `principal`, outside of any Server Action.
 *
 * Same discipline as `recordCompletion` and `calendar/write.ts#createEvent`:
 * `can()` is checked *inside* the seam against the passed-in principal, not
 * read off an ambient session, so a future `/api/mcp` route reaches identical
 * authorization to `createTaskAction` without going through `assertCan`'s
 * cookie/session resolution. The assignee is *proven* to be in
 * `principal.familyId` rather than trusted from the caller — a forged id from
 * another household resolves to nothing and the task is written unassigned
 * rather than pointing across a family boundary, matching the existing
 * action's behaviour exactly.
 *
 * Pure of `next/cache`: revalidation is a caller concern (`./actions.ts` does
 * it for the web app; a future MCP route would not, since there is no page to
 * revalidate). The realtime publish is not deferred to the caller — it is as
 * much a part of "the task now exists" as the row itself.
 */
export async function createTask(
  principal: Principal,
  input: CreateTaskInput
): Promise<CreateTaskResult> {
  if (!can(principal, 'task:write', { familyId: principal.familyId })) {
    return { ok: false, error: 'forbidden' };
  }

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const { title, assigneeMemberId, dueDate } = parsed.data;

  const assignee = assigneeMemberId
    ? ((await getMember(principal.familyId, assigneeMemberId))?.id ?? null)
    : null;
  if (assigneeMemberId && !assignee) return { ok: false, error: 'memberNotFound' };

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

  return { ok: true, taskId: created.id };
}
