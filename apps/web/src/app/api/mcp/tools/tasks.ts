import 'server-only';
import { z } from 'zod';
import { MCP_TASKS_READ, MCP_TASKS_WRITE, hasAllScopes } from '@/server/mcp-auth';
import { startOfDay } from '@/modules/calendar';
import { can, getFamily, type Principal } from '@/modules/family';
import { ACTIVITY_ICONS } from '@/modules/routines';
import {
  createTask,
  deleteTask,
  getTask,
  listTodayTasks,
  toggleTask,
  type CreateTaskInput,
  type DeleteTaskInput,
  type Task,
  type ToggleTaskInput,
} from '@/modules/tasks';
import { ok, toolError, type McpToolServer } from './shared';

/**
 * The tasks domain's MCP tools (MCP-parity M2) — the household's one-off
 * chores, as opposed to routines' repeating ones.
 *
 * Same discipline as `./routines.ts`: every write goes through
 * `modules/tasks/write.ts`, never through a Server Action, and each mutating
 * tool re-checks `can()` itself before calling the seam — redundant with the
 * seam's own check by design.
 */

const SCOPE_READ = 'insufficientScope: requires kynite:tasks.read';
const SCOPE_WRITE = 'insufficientScope: requires kynite:tasks.write';

/** A task as an MCP client sees it: no `familyId`, no internal columns. */
function taskView(row: Task) {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    assigneeMemberId: row.assigneeMemberId,
    dueDate: row.dueDate,
    done: row.completedAt !== null,
  };
}

/** `'2026-08-14'` in `timeZone` — same rule as `modules/tasks/page-data.ts`. */
function todayKeyIn(timeZone: string, now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(now);
}

export function registerTasksTools(
  server: McpToolServer,
  principal: Principal,
  grantedScopes: ReadonlySet<string>
): void {
  const canComplete = () => can(principal, 'task:complete', { familyId: principal.familyId });
  const canWrite = () => can(principal, 'task:write', { familyId: principal.familyId });

  server.registerTool(
    'list_tasks',
    {
      title: 'List tasks',
      description:
        'List this family’s tasks for a day: open and undated, open and due that day or earlier, and completed that day. Defaults to today in the family’s own timezone; an overdue task is simply still open, never a failure to report.',
      inputSchema: z.object({
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe('YYYY-MM-DD in the family’s zone. Defaults to today.'),
        memberId: z.uuid().optional().describe('Only tasks assigned to this member.'),
      }),
    },
    async ({ date, memberId }) => {
      if (!hasAllScopes(grantedScopes, [MCP_TASKS_READ])) return toolError(SCOPE_READ);

      const family = await getFamily(principal.familyId);
      const timeZone = family?.timezone ?? 'Europe/Amsterdam';
      const anchor = date ? new Date(`${date}T12:00:00Z`) : new Date();
      const todayKey = date ?? todayKeyIn(timeZone, anchor);

      const rows = await listTodayTasks({
        familyId: principal.familyId,
        todayKey,
        since: startOfDay(anchor, timeZone),
      });

      const filtered = memberId ? rows.filter((row) => row.assigneeMemberId === memberId) : rows;
      return ok(filtered.map(taskView));
    }
  );

  server.registerTool(
    'get_task',
    {
      title: 'Get one task',
      description: 'One task. Unknown or other-family ids return notFound.',
      inputSchema: z.object({ taskId: z.uuid() }),
    },
    async ({ taskId }) => {
      if (!hasAllScopes(grantedScopes, [MCP_TASKS_READ])) return toolError(SCOPE_READ);

      const row = await getTask(principal.familyId, taskId);
      if (!row) return toolError('taskNotFound');

      return ok(taskView(row));
    }
  );

  server.registerTool(
    'create_task',
    {
      title: 'Create a task',
      description:
        'Create a one-off family task, optionally assigned to a member with a due date. Tasks pay no stars — use a routine when a child should earn for repeated, tedious effort.',
      inputSchema: z.object({
        title: z.string().min(1).max(200),
        assigneeMemberId: z.uuid().nullable().optional(),
        dueDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
        icon: z
          .enum(ACTIVITY_ICONS)
          .nullable()
          .optional()
          .describe(
            'Which icon the board shows for this task. Omit to suggest one from the title automatically.'
          ),
      }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_TASKS_WRITE])) return toolError(SCOPE_WRITE);
      if (!canWrite()) return toolError('forbidden');

      const result = await createTask(principal, input as CreateTaskInput);
      if (!result.ok) return toolError(result.error);
      return ok({ taskId: result.taskId });
    }
  );

  server.registerTool(
    'toggle_task',
    {
      title: 'Tick a task off, or take it back',
      description:
        'Set a task’s done state to a target value (never a flip), so a replayed call is a no-op. On completion, reply with specific praise for what was done — tasks carry no star, so the praise is the whole reward.',
      inputSchema: z.object({ taskId: z.uuid(), completed: z.boolean() }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_TASKS_WRITE])) return toolError(SCOPE_WRITE);
      if (!canComplete()) return toolError('forbidden');

      const result = await toggleTask(principal, input as ToggleTaskInput);
      if (!result.ok) return toolError(result.error);
      return ok({ taskId: result.taskId });
    }
  );

  server.registerTool(
    'delete_task',
    {
      title: 'Delete a task',
      description:
        'Delete a task outright. Deleting is not a consequence: an unfinished task should be left open or rescheduled, never removed to mark a miss.',
      inputSchema: z.object({ taskId: z.uuid() }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_TASKS_WRITE])) return toolError(SCOPE_WRITE);
      if (!canWrite()) return toolError('forbidden');

      const result = await deleteTask(principal, input as DeleteTaskInput);
      if (!result.ok) return toolError(result.error);
      return ok({ taskId: result.taskId });
    }
  );
}
