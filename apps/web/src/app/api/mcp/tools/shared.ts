import 'server-only';

/**
 * The pieces every `/api/mcp` tool module shares (MCP-parity M1).
 *
 * `route.ts` used to hold `registerTools` for all five tools; with routines,
 * rewards, family and timers on the way that file would be the only file in
 * the app nobody could read. The tools now live one module per domain
 * (`./calendar.ts`, `./tasks.ts`, `./family.ts`, `./routines.ts`), each
 * exporting a single `register<Domain>Tools(server, principal, grantedScopes)`
 * that `route.ts` wires. Nothing about the authorization model changed: each
 * handler still checks its own scopes and calls `can()` before a write seam.
 */

/**
 * The MCP server a `register…Tools` function registers onto.
 *
 * Typed through `import(...)` rather than a value import so a tool module
 * never pulls the SDK into its own module graph — `createMcpHandler` in
 * `route.ts` is the only thing that constructs one.
 */
export type McpToolServer = import('@modelcontextprotocol/server').McpServer;

/** A successful tool result: the payload as JSON text, MCP's only content type here. */
export function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

/**
 * A refusal the MCP client can read — a normal `tools/call` error result, not
 * an HTTP status. The 401/403 layer belongs to `requireMcpAuth` (no token, or
 * a token that does not verify at all); everything a *verified* caller is not
 * allowed to do comes back through here.
 */
export function toolError(message: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}
