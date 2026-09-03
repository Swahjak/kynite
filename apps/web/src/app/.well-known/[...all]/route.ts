import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '@/server/auth';

/**
 * OAuth discovery documents `mcp()`/`oauth-provider` (`src/server/auth.ts`,
 * M-C) serve at the origin root rather than under `/api/auth`:
 *
 *  - RFC 9728 protected resource metadata,
 *    `/.well-known/oauth-protected-resource/api/mcp` — the document the 401
 *    challenge from `/api/mcp` (`WWW-Authenticate`'s `resource_metadata`)
 *    points an MCP client at. Served by an `onRequest` hook in `mcp()` that
 *    matches the raw `request.url` pathname directly (checked against
 *    `@better-auth/mcp`'s `dist/index.mjs`), because the *resource* it
 *    describes (`${BETTER_AUTH_URL}/api/mcp`) has a different path than the
 *    auth server's own issuer does.
 *  - RFC 8414 authorization server metadata,
 *    `/.well-known/oauth-authorization-server/api/auth` — `oauth-provider`'s
 *    `handleIssuerMetadataRequest` registers this same *origin-rooted* form
 *    (`authServerMetadataPaths` in `@better-auth/oauth-provider`'s dist
 *    includes both `/.well-known/oauth-authorization-server<issuerPath>` and
 *    `<issuerPath>/.well-known/oauth-authorization-server` — the second is
 *    already reachable through `/api/auth/[...all]`, this route is only for
 *    the first) via the same raw-pathname matching.
 *
 * Both match against the incoming request's literal URL, not against
 * anything Next's router strips — so Next still needs *a* file route at this
 * path before better-auth's own matching ever runs, and this file is that
 * route, forwarding unmodified. It deliberately does **not** forward every
 * `/.well-known/*` request: better-auth's raw-pathname matchers fall through
 * (return nothing, `onRequest` continues to the normal 404) for anything they
 * don't recognise, but this route has no business proxying unrelated
 * `/.well-known/*` traffic (a future `security.txt`, `apple-app-site-association`,
 * …) into the auth handler on the offhand chance better-auth might one day
 * claim that path too — so only the two known OAuth discovery prefixes are
 * forwarded, and everything else 404s directly, no auth instance involved.
 *
 * `src/proxy.ts`'s matcher already excludes `\.well-known` wholesale, so this
 * never passes through the locale/auth proxy.
 */
const FORWARDED_PREFIXES = ['oauth-protected-resource', 'oauth-authorization-server'];

function isForwardedWellKnownPath(request: Request): boolean {
  const pathname = new URL(request.url).pathname;
  const segment = pathname.replace(/^\/\.well-known\//, '');
  return FORWARDED_PREFIXES.some(
    (prefix) => segment === prefix || segment.startsWith(`${prefix}/`)
  );
}

function notFound(): Response {
  return new Response(null, { status: 404, headers: WELL_KNOWN_RESPONSE_HEADERS });
}

/**
 * OAuth discovery metadata (M-E hardening): never cached by an intermediary
 * and never indexed, same reasoning as `/api/mcp`'s own
 * `MCP_RESPONSE_HEADERS` (`src/app/api/mcp/route.ts`) — these documents
 * describe an internal agent-authorization flow, not public content.
 */
const WELL_KNOWN_RESPONSE_HEADERS: HeadersInit = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
};

function withWellKnownHeaders(response: Response): Response {
  for (const [key, value] of Object.entries(WELL_KNOWN_RESPONSE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

const authHandler = toNextJsHandler((request: Request) => getAuth().handler(request));

export const GET = async (request: Request) =>
  isForwardedWellKnownPath(request)
    ? withWellKnownHeaders(await authHandler.GET(request))
    : notFound();

export const POST = async (request: Request) =>
  isForwardedWellKnownPath(request)
    ? withWellKnownHeaders(await authHandler.POST(request))
    : notFound();
