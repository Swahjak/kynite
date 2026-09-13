import { createMcpHandler } from 'mcp-handler';
import { requireMcpAuth } from '@better-auth/mcp';
import { auth } from '@/server/auth';
import { env } from '@/server/env';
import {
  checkMcpRateLimit,
  grantedScopesOf,
  principalForMcpUser,
  type McpPrincipalRefusal,
} from '@/server/mcp-auth';
import { type Principal } from '@/modules/family';
import { registerCalendarTools } from './tools/calendar';
import { registerFamilyTools } from './tools/family';
import { KYNITE_MCP_INSTRUCTIONS } from './tools/instructions';
import { registerRewardsTools } from './tools/rewards';
import { registerRoutinesTools } from './tools/routines';
import { registerTasksTools } from './tools/tasks';
import { registerTimersTools } from './tools/timers';
import { type McpToolServer } from './tools/shared';

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
 * `list_members` accepts *any* of the family/calendar/tasks read scopes — an OR a
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
 * independent verifier, not that helper). Re-registering the tool set per
 * request is cheap; this is the same trade-off Vercel's own reference
 * implementation makes for any handler that needs request-scoped state.
 */
export const dynamic = 'force-dynamic';

/**
 * Applied to every response this route sends, success or error. This is an
 * agent-authorization endpoint, not a page or a public API — nothing about it
 * should be cached by an intermediary or indexed by a crawler that somehow
 * reaches it. `next.config.ts`'s `headers()` only covers static/asset routes
 * (`/serwist/:path*`); a dynamic route sets its own, the same pattern
 * `jsonRpcError` already used for `Cache-Control` before this hardening pass.
 */
const MCP_RESPONSE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
};

function withMcpHeaders(response: Response): Response {
  for (const [key, value] of Object.entries(MCP_RESPONSE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

function jsonRpcError(status: number, message: string, extraHeaders?: HeadersInit): Response {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }),
    {
      status,
      headers: { 'Content-Type': 'application/json', ...MCP_RESPONSE_HEADERS, ...extraHeaders },
    }
  );
}

function registerTools(
  server: McpToolServer,
  principal: Principal,
  grantedScopes: ReadonlySet<string>
): void {
  registerFamilyTools(server, principal, grantedScopes);
  registerCalendarTools(server, principal, grantedScopes);
  registerTasksTools(server, principal, grantedScopes);
  registerRoutinesTools(server, principal, grantedScopes);
  registerTimersTools(server, principal, grantedScopes);
  registerRewardsTools(server, principal, grantedScopes);
}

/** The 403 body for each way `principalForMcpUser` can refuse. */
const PRINCIPAL_REFUSAL_MESSAGES: Record<McpPrincipalRefusal, string> = {
  noMember: 'No family member is associated with this account.',
  multipleFamilies:
    'This account belongs to multiple families; MCP access is not yet supported for multi-family accounts.',
};

type McpRequestHandler = (request: Request) => Promise<Response>;

let handleMcpRequest: McpRequestHandler | undefined;

/**
 * Builds (and memoises) the `requireMcpAuth`-wrapped handler on first use,
 * the same lazy-singleton shape as `getAuth()`/`getEnv()`: `MCP_RESOURCE`
 * reads `env.BETTER_AUTH_URL`, and `env` validates on first property read
 * (`src/server/env.ts`), so building this at module scope would make
 * importing this route throw the moment `next build` collects its
 * page-data — the builder stage has no runtime environment at all. Every
 * request after the first reuses the same handler instance, matching the
 * previous eager behaviour.
 */
function getHandleMcpRequest(): McpRequestHandler {
  if (handleMcpRequest) return handleMcpRequest;

  /**
   * Must match `mcp({ resource })` in `src/server/auth.ts` exactly: that
   * value is what every issued access token's `aud` claim is bound to, and
   * `requireMcpAuth`'s own default (`opts.resource` unset) is the auth
   * instance's resolved *base* URL — `${BETTER_AUTH_URL}/api/auth` — not
   * this resource. Leaving this unset would verify every token against the
   * wrong audience and reject them all.
   */
  const mcpResource = `${env.BETTER_AUTH_URL}/api/mcp`;

  handleMcpRequest = requireMcpAuth(
    auth,
    async (request, claims) => {
      const userId = typeof claims.sub === 'string' ? claims.sub : undefined;

      // Rate-limit before the member lookup: `sub` is already verified by
      // `requireMcpAuth` at this point (this callback only runs for a
      // signature/issuer/audience/expiry-valid token), so keying off it here
      // is safe, and a client hammering the endpoint with a valid token gets
      // turned away before it costs a `member` SELECT — see
      // `checkMcpRateLimit`'s doc comment (`src/server/mcp-auth.ts`) for why
      // this is in-memory and keyed by `sub` rather than by IP.
      if (userId) {
        const rateLimit = checkMcpRateLimit(userId);
        if (rateLimit.limited) {
          return jsonRpcError(429, 'rateLimited: too many requests, slow down', {
            'Retry-After': String(rateLimit.retryAfterSeconds),
          });
        }
      }

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
        {
          serverInfo: { name: 'kynite', version: '1.0.0' },
          // Sent on `initialize`, before the host has seen a single tool: the
          // star economy's rules (per-step payout, never a deduction, praise
          // before star, ask the parent) are product decisions a host cannot
          // infer from tool names. See `./tools/instructions.ts`.
          instructions: KYNITE_MCP_INSTRUCTIONS,
        }
      );

      return withMcpHeaders(await mcpHandler(request));
    },
    { resource: mcpResource }
  );

  return handleMcpRequest;
}

export const GET = (request: Request) => getHandleMcpRequest()(request);
export const POST = (request: Request) => getHandleMcpRequest()(request);
export const DELETE = (request: Request) => getHandleMcpRequest()(request);
