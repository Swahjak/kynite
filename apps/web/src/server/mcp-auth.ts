import 'server-only';
import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { member } from '@/server/db/schema';
import { type Principal } from '@/modules/family';

/**
 * The subset of a verified MCP access token's JWT claims this module reads.
 * `requireMcpAuth`'s handler hands back `jose`'s full `JWTPayload`, but `jose`
 * is a transitive dependency (of `better-auth`/`@better-auth/mcp`) rather
 * than one this app declares directly — pulling in its types for two fields
 * would mean a `jose` version bump elsewhere in the tree could silently
 * change what this file sees. `JWTPayload` is a structural (all-optional)
 * type, so this narrower shape is assignable from it either way.
 */
export type McpAccessTokenClaims = { sub?: string; scope?: string };

/**
 * MCP scope names (M-D, `/api/mcp`). Mirrors the literal strings
 * `MCP_SCOPES` in `src/server/auth.ts` declares to the OAuth provider — kept
 * as a second, independent copy rather than exporting that private const,
 * per the milestone's constraint against touching `auth.ts` for anything but
 * a genuine plugin-config need. If the two ever drift, `pnpm typecheck` stays
 * green (both are just `string`), so a scope rename in one place is only
 * caught by the smoke script / manual testing — grep both files together
 * when renaming a scope.
 */
export const MCP_CALENDAR_READ = 'kynite:calendar.read';
export const MCP_CALENDAR_WRITE = 'kynite:calendar.write';
export const MCP_TASKS_READ = 'kynite:tasks.read';
export const MCP_TASKS_WRITE = 'kynite:tasks.write';

/**
 * Parses the space-delimited `scope` claim an MCP access token JWT carries
 * (RFC 9068 JWT access-token profile — verified against
 * `@better-auth/core`'s `oauth2/verify.mjs#parseGrantedScopes`, which builds
 * that claim from exactly this format) into the set a tool handler checks
 * membership against.
 */
export function grantedScopesOf(claims: McpAccessTokenClaims): Set<string> {
  const raw = claims.scope;
  if (typeof raw !== 'string' || raw.length === 0) return new Set();
  return new Set(raw.split(' '));
}

/** True when the token carries every one of `required`. */
export function hasAllScopes(granted: ReadonlySet<string>, required: readonly string[]): boolean {
  return required.every((scope) => granted.has(scope));
}

/** True when the token carries at least one of `anyOf`. */
export function hasAnyScope(granted: ReadonlySet<string>, anyOf: readonly string[]): boolean {
  return anyOf.some((scope) => granted.has(scope));
}

/** Why `principalForMcpUser` refused to mint a `Principal`. */
export type McpPrincipalRefusal =
  /** The user exists in better-auth but never joined or was removed from a family. */
  | 'noMember'
  /**
   * The user holds a *live* member row in more than one family (the
   * separated-parent case — `src/modules/family/actions.ts:427-436` documents
   * the same account belonging to two households at once). A bearer token
   * carries no family selector the way a session cookie's `activeFamilyId`
   * does, so there is no principled way to pick one household over the
   * other — binding to either would silently expose or write into the wrong
   * family. Refused rather than guessed at, until MCP has a way to select a
   * family per-connection.
   */
  | 'multipleFamilies';

export type McpPrincipalResult =
  { ok: true; principal: Principal } | { ok: false; reason: McpPrincipalRefusal };

/**
 * Maps an MCP access token's `sub` claim (a better-auth user id — the token
 * was minted by `mcp()`'s own OAuth provider, whose subject is always a
 * `user.id`) to the real family member behind it, and builds the same
 * `Principal` shape `getPrincipal()` builds from a session cookie.
 *
 * Deliberately *not* `getPrincipal()`: that helper resolves
 * `activeFamilyId`/`memberId` off the session cookie cache, which an MCP
 * bearer-token request never carries.
 *
 * Deliberately *not* `getMemberByUserId()` either: that query is `limit 1`
 * with no `orderBy`, which is fine for its own callers (each resolves a
 * member within an already-known family) but wrong here. The schema's unique
 * index is `(familyId, userId)` — **not** `userId` alone
 * (`src/modules/family/schema.ts:127`, `member_family_user_unique`) — because
 * one login can hold a live member row in more than one family at once (a
 * separated parent with two households, `actions.ts:427-436`). A bare
 * `limit 1` would bind the token to whichever row the database happened to
 * return first, nondeterministically, which is a cross-family exposure: the
 * MCP client could read or write into a household its holder never chose.
 * So every live row for this `userId` is fetched, and more than one is a
 * refusal (`multipleFamilies`), not a guess.
 *
 * Any adult member (owner or adult role) may use write scopes; a child or
 * caregiver member authenticating an MCP client still gets a `Principal` —
 * `can()` inside each write seam is what actually confines what they may do,
 * exactly as it does for the web app.
 */
export async function principalForMcpUser(userId: string): Promise<McpPrincipalResult> {
  const rows = await getDb().select().from(member).where(eq(member.userId, userId));

  if (rows.length === 0) return { ok: false, reason: 'noMember' };
  if (rows.length > 1) return { ok: false, reason: 'multipleFamilies' };

  const row = rows[0];
  return {
    ok: true,
    principal: { kind: 'member', familyId: row.familyId, memberId: row.id, role: row.role },
  };
}
