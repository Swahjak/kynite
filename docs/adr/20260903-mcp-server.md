# ADR: MCP Server for Agentic Access

**Date:** 2026-09-03
**Status:** Accepted
**Context:** M-A through M-E — better-auth 1.7 upgrade, OAuth 2.1 provider, `/api/mcp` route + tools, hardening

## Decision

Expose the family's calendar and tasks to MCP clients (Claude Desktop, and any other
OAuth 2.1 MCP host) through a resource route built **inside this app**
(`src/app/api/mcp/route.ts`), authorized by better-auth's own OAuth provider plugin
(`mcp()` + `cimd()` in `src/server/auth.ts`), rather than as a separate server.

## Context

"Let an agent read/write the family calendar and tasks" needed an OAuth-authorized
surface. Two shapes were on the table:

- **Option A — in-app.** Add `mcp()`/`cimd()` to the existing `betterAuth()` instance and
  a resource route in the same Next app, reusing the app's session/member model, its
  database connection, and its existing write seams (`createEvent`, `createTask`) for
  every mutation.
- **Option B — separate server.** A standalone MCP server (its own process or deployment)
  that talks to this app's database or a private API, with its own auth story.

**Chosen: A.** The alternative would have meant either a second authorization system (a
new source of truth for "who is this token for") or a private internal API whose sole
consumer is the MCP server — both add a network hop and a second deployable for a
single-instance family app with no scaling need. Building it in-app means every MCP tool
call can go through the *same* `can()` chokepoint and the *same* write seams the web app's
Server Actions already call, so a bug fixed once (or a permission rule changed once) can't
drift between two authorization implementations.

## Decisions

- **better-auth 1.7 + `@better-auth/oauth-provider` (`mcp()`) as the OAuth 2.1 authorization
  server.** It is the OAuth server outright — it cannot run alongside a separate
  `oauthProvider()` plugin — and it owns the RFC 9728/8414 discovery documents,
  `/oauth2/authorize`, `/oauth2/token`, consent, and JWT-signed access tokens (via the
  `jwt()` plugin it depends on).
- **Client ID Metadata Documents (`cimd()`), not Dynamic Client Registration.** A client
  identifies itself with an HTTPS URL and the plugin fetches/validates the document there,
  per MCP's 2026-07-28 spec revision — no registration round-trip, no client secret to
  store or rotate.
- **Split read/write scopes, one pair per domain**: `kynite:calendar.read`,
  `kynite:calendar.write`, `kynite:tasks.read`, `kynite:tasks.write`. A client requests only
  what it needs; a calendar-only integration can never even attempt a task write regardless
  of what the member behind it is allowed to do.
- **`can()` — the same family-role chokepoint every Server Action calls — decides actual
  access, scopes only gate which tool runs.** A token's scope is HTTP-layer authorization
  (does this *grant* cover this tool); `can()` is member-layer authorization (does this
  *person's role* permit this action). Both must pass. A stolen calendar-only token cannot
  touch tasks even if the member behind it is the owner; an owner's own token cannot bypass
  `can()` by carrying a scope, because every mutating tool still calls the write seam
  (`createEvent`/`createTask`), which re-checks `can()` against the resolved `Principal`
  regardless of what the token claims.
- **v1 tool surface is deliberately narrow**: `list_members`, `list_calendars`,
  `list_events`, `create_event` (native calendars only), `create_task`. No update/delete
  tools yet, no recurrence editing beyond `create_event`'s presets.
- **`create_event` refuses any `calendarId` backed by Google or an ICS subscription** —
  native Kynite calendars only (`nativeCalendarCheck` in `route.ts`). Google/ICS calendars
  stay read-only through this surface; writing into someone's real Google Calendar from an
  MCP tool call was judged too surprising for a v1.
- **Multi-family accounts are refused, not guessed at.** A bearer token carries no family
  selector the way a session cookie's `activeFamilyId` does. `principalForMcpUser`
  (`src/server/mcp-auth.ts`) looks up every live `member` row for the token's `sub`; more
  than one live row (the separated-parent case) is a hard refusal
  (`multipleFamilies`, HTTP 403) rather than binding to whichever row a `limit 1` query
  happened to return first, which would risk exposing or writing into the wrong household.

## M-E hardening

- **Rate limiting.** `@better-auth/oauth-provider` already rate-limits the OAuth *flow*
  endpoints a client hits before it holds a token (`/oauth2/token`, `/authorize`,
  `/introspect`, `/revoke`, `/register`, `/userinfo` — 20-100 req/min by default). None of
  that covers `/api/mcp` itself, which `requireMcpAuth` hands off to independently of the
  provider plugin. `checkMcpRateLimit` (`src/server/mcp-auth.ts`) adds a per-token-`sub`
  in-memory sliding window (60 req/min), returning 429 with `Retry-After` when exceeded.
- **Response headers.** Both `/api/mcp` and `/.well-known/[...all]` now set
  `Cache-Control: no-store` and `X-Robots-Tag: noindex` on every response — these are
  agent-authorization surfaces, not content, and nothing about them should be cached by an
  intermediary or indexed by a crawler that happens to reach them.

## Consequences

- **Migrate-on-boot risk.** better-auth 1.7's `account.issuer` column and the OAuth
  provider's own tables are added via the same drizzle-migrate-on-boot path
  (`docs/architecture.md`) every other schema change uses. A failed migration on deploy
  takes the whole app down, not just MCP — same trade-off as every prior migration, not a
  new one this feature introduces.
- **`.well-known` route ownership.** better-auth's discovery matchers key off the raw
  request URL, not Next's router, so `src/app/.well-known/[...all]/route.ts` exists purely
  to give Next *a* file route at that path before better-auth's own prefix matching runs.
  It forwards only the two known OAuth discovery prefixes
  (`oauth-protected-resource`, `oauth-authorization-server`) and 404s everything else
  directly — it must not become a general `.well-known` proxy.
- **Rate limiter is a single-instance assumption.** `checkMcpRateLimit`'s `Map` lives in
  process memory. This app runs single-instance on Railway today, so one process sees every
  request. If the app ever scales horizontally, this needs a shared store (Redis, Postgres)
  or the limiter silently becomes per-instance instead of per-account — revisit then, same
  posture `docs/adr/20251225-rate-limiting.md` already documents for other endpoints.
- **No update/delete tools yet.** A client that wants to correct or remove something it
  created still has no MCP tool for that; today's answer is "use the app." Revisit once
  real usage shows which mutation is missing most.

## Related

- `src/server/auth.ts` (`mcp()`, `cimd()`, `MCP_SCOPES`)
- `src/server/mcp-auth.ts` (`principalForMcpUser`, scope helpers, `checkMcpRateLimit`)
- `src/app/api/mcp/route.ts` (tool registration, `nativeCalendarCheck`)
- `src/app/.well-known/[...all]/route.ts` (discovery document forwarding)
- `docs/adr/20251225-rate-limiting.md` (prior rate-limiting decisions, same single-instance
  caveat)
- Tests: `tests/unit/server/mcp-auth.test.ts`
