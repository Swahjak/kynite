import { createMcpHandler } from 'mcp-handler';
import { requireMcpAuth } from '@better-auth/mcp';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb } from '@/server/db';
import { icsSubscription } from '@/server/db/schema';
import { auth } from '@/server/auth';
import { env } from '@/server/env';
import {
  MCP_CALENDAR_READ,
  MCP_CALENDAR_WRITE,
  MCP_TASKS_READ,
  MCP_TASKS_WRITE,
  grantedScopesOf,
  hasAllScopes,
  hasAnyScope,
  principalForMcpUser,
  type McpPrincipalRefusal,
} from '@/server/mcp-auth';
import {
  RECURRENCE_PRESETS,
  WEEKDAYS,
  createEvent,
  EVENT_TYPES,
  listEvents,
  type CreateEventInput,
} from '@/modules/calendar';
import { type Calendar, listFamilyCalendars } from '@/modules/google';
import { can, decide, listMembers, type Principal } from '@/modules/family';
import { createTask, type CreateTaskInput } from '@/modules/tasks';

/**
 * `/api/mcp` (M-D): the family's data reachable by an MCP client (Claude
 * Desktop, or any other OAuth 2.1 MCP host) that has been through the
 * `mcp()`/`cimd()` authorization flow `src/server/auth.ts` sets up (M-C).
 *
 * **Never cached, never proxied.** `src/proxy.ts`'s matcher excludes `api/`
 * wholesale, so this route sees every request unmodified — including the
 * unauthenticated ones `requireMcpAuth` itself turns into a 401 carrying the
 * RFC 9728 `WWW-Authenticate` challenge MCP clients start their OAuth flow
 * from.
 *
 * **Two authorization layers, same shape as the web app's.** `requireMcpAuth`
 * verifies the bearer token's signature/issuer/audience/expiry against the
 * provider's own JWKS and hands back the verified claims — that is *token*
 * authorization (which scopes this specific grant carries). Each tool below
 * then calls the same `can()` chokepoint every Server Action and write seam
 * calls — that is *member* authorization (what this family member's role
 * permits). A tool never trusts one without the other: a stolen calendar-only
 * token cannot touch tasks even if the member behind it is the owner, and an
 * owner's own token cannot bypass `can()` by carrying a scope, because scopes
 * only gate which tool *runs* — every tool that mutates still calls the write
 * seam (`createEvent`/`createTask`), which re-checks `can()` against the
 * resolved `Principal` regardless of what the token claims.
 *
 * **No requiredScopes at the HTTP layer.** `requireMcpAuth`'s `requiredScopes`
 * enforces one scope set for the whole route (AND semantics), but
 * `list_members` accepts *either* a calendar or a tasks read scope — an OR a
 * single route-level requirement cannot express. So the token is verified
 * with no scope requirement here, and every tool checks its own scopes (and
 * the family-level `can()`) before it does anything, returning a normal
 * (non-throwing) MCP tool error when either check fails — that is what "a
 * proper MCP error" means for a `tools/call`, as opposed to the 401/403 HTTP
 * response `requireMcpAuth` already owns for the *no token* / *token entirely
 * invalid* cases.
 *
 * **A fresh `McpServer` per request.** `createMcpHandler`'s `initializeServer`
 * callback only receives the `server` to register tools on, not the verified
 * claims — so the principal and granted scopes are captured by closing over
 * them when `initializeServer` is built inside the (per-request)
 * `requireMcpAuth` handler, rather than reaching for `ctx.http.authInfo`
 * (which `mcp-handler`'s *own* `withMcpAuth` populates from `request.auth`,
 * a field this route never sets — `requireMcpAuth` is better-auth's
 * independent verifier, not that helper). Re-registering five tools per
 * request is cheap; this is the same trade-off Vercel's own reference
 * implementation makes for any handler that needs request-scoped state.
 */
export const dynamic = 'force-dynamic';

function jsonRpcError(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }),
    {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    }
  );
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

function toolError(message: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

/** Whether `calendarId` names a calendar this MCP tool may write to. */
async function nativeCalendarCheck(
  familyId: string,
  calendarId: string | undefined
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!calendarId) return { ok: true };

  const calendars = await listFamilyCalendars(familyId);
  const row = calendars.find((c: Calendar) => c.id === calendarId);
  if (!row) return { ok: false, error: 'calendarNotFound' };
  if (row.googleAccountId) {
    return {
      ok: false,
      error:
        'nativeOnly: calendar is linked to Google — create_event only writes to native Kynite calendars',
    };
  }

  const [subscription] = await getDb()
    .select({ id: icsSubscription.id })
    .from(icsSubscription)
    .where(eq(icsSubscription.calendarId, calendarId))
    .limit(1);
  if (subscription) {
    return {
      ok: false,
      error:
        'nativeOnly: calendar is an ICS subscription — create_event only writes to native Kynite calendars',
    };
  }

  return { ok: true };
}

function registerTools(
  server: import('@modelcontextprotocol/server').McpServer,
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
      if (!hasAnyScope(grantedScopes, [MCP_CALENDAR_READ, MCP_TASKS_READ])) {
        return toolError('insufficientScope: requires kynite:calendar.read or kynite:tasks.read');
      }
      const members = await listMembers(principal.familyId);
      return ok(
        members.map((m) => ({ id: m.id, name: m.displayName, role: m.role, color: m.color }))
      );
    }
  );

  server.registerTool(
    'list_calendars',
    {
      title: 'List calendars',
      description:
        'List this family’s calendars, including whether each is a native Kynite calendar or backed by Google/ICS (read-only).',
      inputSchema: z.object({}),
    },
    async () => {
      if (!hasAllScopes(grantedScopes, [MCP_CALENDAR_READ])) {
        return toolError('insufficientScope: requires kynite:calendar.read');
      }
      const calendars = await listFamilyCalendars(principal.familyId);
      return ok(
        calendars.map((c) => ({
          id: c.id,
          summary: c.summary,
          native: c.googleAccountId === null,
          writable: c.writable,
          visibility: c.visibility,
        }))
      );
    }
  );

  server.registerTool(
    'list_events',
    {
      title: 'List events',
      description: 'List calendar events in a date range, optionally filtered to one member.',
      inputSchema: z.object({
        from: z.iso.datetime({ offset: true }).or(z.iso.date()),
        to: z.iso.datetime({ offset: true }).or(z.iso.date()),
        memberId: z.uuid().optional(),
      }),
    },
    async ({ from, to, memberId }) => {
      if (!hasAllScopes(grantedScopes, [MCP_CALENDAR_READ])) {
        return toolError('insufficientScope: requires kynite:calendar.read');
      }
      const privateGrade = decide(principal, 'calendar:view_private', {
        familyId: principal.familyId,
      });
      const privateDetail = privateGrade === 'allow';
      const privateDetailFor =
        privateGrade === 'own' && principal.kind === 'member' ? principal.memberId : null;

      const window = { from: new Date(from), to: new Date(to) };
      if (Number.isNaN(window.from.getTime()) || Number.isNaN(window.to.getTime())) {
        return toolError('invalidInput: from/to must be ISO dates or datetimes');
      }

      const events = await listEvents({
        familyId: principal.familyId,
        window,
        privateDetail,
        privateDetailFor,
      });
      const filtered = memberId
        ? events.filter(
            (e) => e.ownerMemberId === memberId || e.attendeeMemberIds.includes(memberId)
          )
        : events;

      return ok(
        filtered.map((e) => ({
          key: e.key,
          title: e.title,
          startsAt: e.startsAt.toISOString(),
          endsAt: e.endsAt.toISOString(),
          allDay: e.allDay,
          ownerMemberId: e.ownerMemberId,
          attendeeMemberIds: e.attendeeMemberIds,
          eventType: e.eventType,
          calendarId: e.calendarId,
          recurring: e.recurring,
          busyOnly: e.busyOnly,
        }))
      );
    }
  );

  server.registerTool(
    'create_event',
    {
      title: 'Create a calendar event',
      description:
        'Create an event on a native Kynite calendar. Refuses any calendarId backed by Google or an ICS subscription — use the app for those.',
      inputSchema: z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(4000).optional(),
        location: z.string().max(400).optional(),
        startsAt: z.string().min(1),
        endsAt: z.string().min(1),
        allDay: z.boolean(),
        ownerMemberId: z.uuid().optional(),
        attendeeMemberIds: z.array(z.uuid()).max(50).default([]),
        eventType: z.enum(EVENT_TYPES),
        calendarId: z.uuid().optional(),
        recurrence: z.enum(RECURRENCE_PRESETS),
        byweekday: z.array(z.enum(WEEKDAYS)).min(1).max(7).optional(),
      }),
    },
    async (input) => {
      if (!hasAllScopes(grantedScopes, [MCP_CALENDAR_WRITE])) {
        return toolError('insufficientScope: requires kynite:calendar.write');
      }
      if (!can(principal, 'event:write', { familyId: principal.familyId })) {
        return toolError('forbidden');
      }

      const nativeCheck = await nativeCalendarCheck(principal.familyId, input.calendarId);
      if (!nativeCheck.ok) return toolError(nativeCheck.error);

      const result = await createEvent(principal, input as CreateEventInput);
      if (!result.ok) return toolError(result.error);
      return ok({ eventId: result.eventId });
    }
  );

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

/**
 * Must match `mcp({ resource })` in `src/server/auth.ts` exactly: that value
 * is what every issued access token's `aud` claim is bound to, and
 * `requireMcpAuth`'s own default (`opts.resource` unset) is the auth
 * instance's resolved *base* URL — `${BETTER_AUTH_URL}/api/auth` — not this
 * resource. Leaving this unset would verify every token against the wrong
 * audience and reject them all.
 */
const MCP_RESOURCE = `${env.BETTER_AUTH_URL}/api/mcp`;

/** The 403 body for each way `principalForMcpUser` can refuse. */
const PRINCIPAL_REFUSAL_MESSAGES: Record<McpPrincipalRefusal, string> = {
  noMember: 'No family member is associated with this account.',
  multipleFamilies:
    'This account belongs to multiple families; MCP access is not yet supported for multi-family accounts.',
};

const handleMcpRequest = requireMcpAuth(
  auth,
  async (request, claims) => {
    const userId = typeof claims.sub === 'string' ? claims.sub : undefined;
    const principalResult = userId
      ? await principalForMcpUser(userId)
      : ({ ok: false, reason: 'noMember' } as const);
    if (!principalResult.ok) {
      return jsonRpcError(403, PRINCIPAL_REFUSAL_MESSAGES[principalResult.reason]);
    }
    const principal = principalResult.principal;

    const grantedScopes = grantedScopesOf(claims);

    const mcpHandler = createMcpHandler(
      (server) => registerTools(server, principal, grantedScopes),
      { serverInfo: { name: 'kynite', version: '1.0.0' } }
    );

    return mcpHandler(request);
  },
  { resource: MCP_RESOURCE }
);

export const GET = handleMcpRequest;
export const POST = handleMcpRequest;
export const DELETE = handleMcpRequest;
