import 'server-only';
import { z } from 'zod';
import { MCP_TASKS_WRITE, hasAllScopes } from '@/server/mcp-auth';
import { type Principal } from '@/modules/family';
import { createTask, type CreateTaskInput } from '@/modules/tasks';
import { ok, toolError, type McpToolServer } from './shared';

/** The tasks domain's MCP tools. See `./shared.ts` for the split. */
export function registerTasksTools(
  server: McpToolServer,
  principal: Principal,
  grantedScopes: ReadonlySet<string>
): void {
  server.registerTool(
    'create_task',
    {
      title: 'Create a task',
      description: 'Create a one-off family task, optionally assigned to a member with a due date.',
      inputSchema: z.object({
        title: z.string().min(1).max(200),
        assigneeMemberId: z.uuid().nullable().optional(),
        dueDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional(),
      }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_TASKS_WRITE])) {
        return toolError('insufficientScope: requires kynite:tasks.write');
      }
      const result = await createTask(principal, input as CreateTaskInput);
      if (!result.ok) return toolError(result.error);
      return ok({ taskId: result.taskId });
    }
  );
}
