import 'server-only';
import { z } from 'zod';
import { locales } from '@/i18n/routing';
import { FORMATTING_LOCALES } from '@/i18n/formatting-locale';
import {
  MCP_CALENDAR_READ,
  MCP_FAMILY_READ,
  MCP_FAMILY_WRITE,
  MCP_TASKS_READ,
  hasAllScopes,
  hasAnyScope,
} from '@/server/mcp-auth';
import {
  MEMBER_COLORS,
  MEMBER_ROLES,
  REWARD_HORIZONS,
  can,
  createMember,
  deleteMember,
  getFamily,
  getMember,
  listMembers,
  updateFamily,
  updateMember,
  type Family,
  type Member,
  type Principal,
} from '@/modules/family';
import { ok, toolError, type McpToolServer } from './shared';

/**
 * The family domain's MCP tools (MCP-parity M4) — the roster and the
 * household's own identity.
 *
 * Same discipline as `./rewards.ts` and `./timers.ts`: every write goes
 * through `modules/family/write.ts`, never through a Server Action, and each
 * mutating tool re-checks `can()` itself before calling the seam —
 * deliberately redundant with the seam's own check.
 */

const SCOPE_READ = 'insufficientScope: requires kynite:family.read';
const SCOPE_WRITE = 'insufficientScope: requires kynite:family.write';

/** A member as an MCP client sees it: no `familyId`, no `userId`, no `birthDate` — same subset `list_members` and the app's roster UI already show. */
function memberView(row: Member) {
  return {
    id: row.id,
    name: row.displayName,
    role: row.role,
    color: row.color,
    avatarUrl: row.avatarUrl,
    rewardHorizon: row.rewardHorizon,
  };
}

/** The household's own identity: no `id` (the caller already knows their own family). */
function familyView(row: Family) {
  return {
    name: row.name,
    locale: row.locale,
    formattingLocale: row.formattingLocale,
    timezone: row.timezone,
    weekStartsOn: row.weekStartsOn,
    hubDefaultView: row.hubDefaultView,
  };
}

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

  server.registerTool(
    'get_family',
    {
      title: 'Get the household',
      description: 'The household’s own identity: name, language, clock, week start, hub board.',
      inputSchema: z.object({}),
    },
    async () => {
      if (!hasAllScopes(grantedScopes, [MCP_FAMILY_READ])) return toolError(SCOPE_READ);

      const row = await getFamily(principal.familyId);
      if (!row) return toolError('familyNotFound');

      return ok(familyView(row));
    }
  );

  server.registerTool(
    'get_member',
    {
      title: 'Get one member',
      description: 'One family member. Unknown or other-family ids return notFound.',
      inputSchema: z.object({ memberId: z.uuid() }),
    },
    async ({ memberId }) => {
      if (!hasAllScopes(grantedScopes, [MCP_FAMILY_READ])) return toolError(SCOPE_READ);

      const row = await getMember(principal.familyId, memberId);
      if (!row) return toolError('memberNotFound');

      return ok(memberView(row));
    }
  );

  server.registerTool(
    'create_member',
    {
      title: 'Add a family member',
      description: 'Add a non-owner member (adult, child or caregiver) to the household.',
      inputSchema: z.object({
        displayName: z.string().min(1).max(80),
        // `owner` is a legal enum member but never a legal input here — the
        // seam itself rejects it (`singleOwner`), same defence-in-depth as
        // `update_member` relying on the seam for the role-immutability check.
        role: z.enum(MEMBER_ROLES),
        color: z.enum(MEMBER_COLORS),
        rewardHorizon: z.enum(REWARD_HORIZONS),
        avatarUrl: z.string().max(20000).default(''),
        birthDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_FAMILY_WRITE])) return toolError(SCOPE_WRITE);
      if (!can(principal, 'member:manage', { familyId: principal.familyId })) {
        return toolError('forbidden');
      }

      const result = await createMember(principal, input);
      if (result.status === 'error') return toolError(result.error);
      return ok({ created: true });
    }
  );

  server.registerTool(
    'update_member',
    {
      title: 'Update a family member',
      description: 'Replace a member’s whole profile. A role can never cross the owner line.',
      inputSchema: z.object({
        memberId: z.uuid(),
        displayName: z.string().min(1).max(80),
        role: z.enum(MEMBER_ROLES),
        color: z.enum(MEMBER_COLORS),
        rewardHorizon: z.enum(REWARD_HORIZONS),
        avatarUrl: z.string().max(20000).default(''),
        birthDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
      }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_FAMILY_WRITE])) return toolError(SCOPE_WRITE);
      if (
        !can(principal, 'member:manage', {
          familyId: principal.familyId,
          memberId: input.memberId,
        })
      ) {
        return toolError('forbidden');
      }

      const result = await updateMember(principal, input);
      if (result.status === 'error') return toolError(result.error);
      return ok({ updated: true });
    }
  );

  server.registerTool(
    'delete_member',
    {
      title: 'Remove a family member',
      description: 'Remove a member from the household. The owner row can never be removed.',
      inputSchema: z.object({ memberId: z.uuid() }),
    },
    async ({ memberId }) => {
      if (!hasAllScopes(grantedScopes, [MCP_FAMILY_WRITE])) return toolError(SCOPE_WRITE);
      if (!can(principal, 'member:manage', { familyId: principal.familyId, memberId })) {
        return toolError('forbidden');
      }

      const result = await deleteMember(principal, { memberId });
      if (result.status === 'error') return toolError(result.error);
      return ok({ deleted: true });
    }
  );

  server.registerTool(
    'update_family',
    {
      title: 'Update the household',
      description: 'Replace the household’s own identity: name, language, clock, week start.',
      inputSchema: z.object({
        name: z.string().min(1).max(80),
        locale: z.enum(locales),
        formattingLocale: z.enum(FORMATTING_LOCALES),
        timezone: z.string().min(1).max(64),
        weekStartsOn: z.number().int().min(1).max(7),
      }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_FAMILY_WRITE])) return toolError(SCOPE_WRITE);
      if (!can(principal, 'family:manage', { familyId: principal.familyId })) {
        return toolError('forbidden');
      }

      const result = await updateFamily(principal, input);
      if (result.status === 'error') return toolError(result.error);
      return ok({ updated: true });
    }
  );
}
