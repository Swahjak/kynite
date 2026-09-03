#!/usr/bin/env node
/**
 * Smoke test for `/api/mcp` (M-D) against a running dev server.
 *
 * Checks the two things a fresh MCP client needs before it can even start an
 * OAuth flow:
 *
 *   1. An unauthenticated request to `/api/mcp` is refused with `401` and
 *      carries a `WWW-Authenticate` header pointing at the RFC 9728 protected
 *      resource metadata (`resource_metadata=...`).
 *   2. The OAuth discovery documents that header points at — and the
 *      standard `/.well-known/oauth-authorization-server` metadata `mcp()`
 *      serves as the authorization server — are actually reachable and
 *      return JSON.
 *
 * Usage:
 *   pnpm dev                                  # in one shell
 *   node scripts/mcp-smoke.mjs                # in another
 *
 * `BASE_URL` defaults to `http://localhost:3000`; override for a different
 * port. This talks to a real server over HTTP — it does not start or stop
 * one, and does not touch the database. Kill the dev server when done; do
 * not leave it running.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

let failures = 0;

function report(label, condition, detail) {
  if (condition) {
    console.log(`ok   - ${label}`);
  } else {
    failures += 1;
    console.log(`FAIL - ${label}${detail ? `\n       ${detail}` : ''}`);
  }
}

async function main() {
  console.log(`Smoke-testing MCP against ${BASE_URL}\n`);

  // 1. Unauthenticated /api/mcp: 401 + WWW-Authenticate → resource metadata.
  const mcpRes = await fetch(`${BASE_URL}/api/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1, params: {} }),
  });
  report('POST /api/mcp (unauthenticated) → 401', mcpRes.status === 401, `got ${mcpRes.status}`);

  const wwwAuth = mcpRes.headers.get('www-authenticate');
  report('WWW-Authenticate header present', Boolean(wwwAuth), `got ${wwwAuth}`);
  report(
    'WWW-Authenticate points at resource metadata',
    Boolean(wwwAuth && /resource_metadata=/.test(wwwAuth)),
    `got ${wwwAuth}`
  );

  let resourceMetadataUrl;
  if (wwwAuth) {
    const match = wwwAuth.match(/resource_metadata="([^"]+)"/);
    resourceMetadataUrl = match?.[1];
  }
  resourceMetadataUrl ??= `${BASE_URL}/.well-known/oauth-protected-resource/api/mcp`;

  // 2. Protected resource metadata (RFC 9728) — reachable, JSON, names an
  //    authorization server.
  const resourceRes = await fetch(resourceMetadataUrl);
  report(
    `GET ${resourceMetadataUrl.replace(BASE_URL, '')} → 200`,
    resourceRes.status === 200,
    `got ${resourceRes.status}`
  );
  let resourceMetadata;
  try {
    resourceMetadata = await resourceRes.json();
  } catch {
    resourceMetadata = null;
  }
  report(
    'protected resource metadata names an authorization server',
    Array.isArray(resourceMetadata?.authorization_servers) &&
      resourceMetadata.authorization_servers.length > 0,
    `got ${JSON.stringify(resourceMetadata)}`
  );

  // 3. Authorization server metadata (RFC 8414) — the standard discovery
  //    document an MCP client fetches next. better-auth's issuer is
  //    `${BETTER_AUTH_URL}/api/auth` (the auth instance's basePath), so this
  //    document lives under `/api/auth/.well-known/*`, not the origin root —
  //    only the protected-resource metadata above is origin-rooted (RFC
  //    9728, keyed off the *resource* rather than the issuer).
  const authServerUrl = resourceMetadata?.authorization_servers?.[0]
    ? `${resourceMetadata.authorization_servers[0]}/.well-known/oauth-authorization-server`
    : `${BASE_URL}/api/auth/.well-known/oauth-authorization-server`;
  const authServerRes = await fetch(authServerUrl);
  report(
    `GET ${authServerUrl.replace(BASE_URL, '')} → 200`,
    authServerRes.status === 200,
    `got ${authServerRes.status}`
  );
  let authServerMetadata;
  try {
    authServerMetadata = await authServerRes.json();
  } catch {
    authServerMetadata = null;
  }
  report(
    'authorization server metadata advertises the MCP scopes',
    Array.isArray(authServerMetadata?.scopes_supported) &&
      authServerMetadata.scopes_supported.includes('kynite:calendar.write'),
    `got ${JSON.stringify(authServerMetadata?.scopes_supported)}`
  );

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error('Smoke script crashed:', error);
  process.exitCode = 1;
});
