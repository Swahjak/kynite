import 'server-only';
import { z } from 'zod';
import { MCP_CALENDAR_READ, MCP_FAMILY_READ, MCP_TASKS_READ, hasAnyScope } from '@/server/mcp-auth';
import { listMembers, type Principal } from '@/modules/family';
import { ok, toolError, type McpToolServer } from './shared';

/** The family domain's MCP tools. See `./shared.ts` for the split. */
export function registerFamilyTools(
  server: McpToolServer,
  principal: Principal,
  grantedScopes: ReadonlySet<string>
): void {
  server.registerTool(
    'list_members',
    {
      title: 'List family members',
      description: 'List this family’s members (id, name, role, colour).',
      inputSchema: z.object({}),
    },
    async () => {
      // Any-of, not all-of: naming the family's members is the lookup table
      // every other domain's ids resolve against, so a calendar-only or
      // tasks-only token has always been able to ask. `kynite:family.read`
      // joins that set rather than replacing it — a client that only holds
      // the older scopes keeps working.
      if (!hasAnyScope(grantedScopes, [MCP_FAMILY_READ, MCP_CALENDAR_READ, MCP_TASKS_READ])) {
        return toolError(
          'insufficientScope: requires kynite:family.read, kynite:calendar.read or kynite:tasks.read'
        );
      }
      const members = await listMembers(principal.familyId);
      return ok(
        members.map((m) => ({ id: m.id, name: m.displayName, role: m.role, color: m.color }))
      );
    }
  );
}
