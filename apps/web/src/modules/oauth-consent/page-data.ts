import 'server-only';
import { headers } from 'next/headers';
import { getPrincipal } from '@/modules/family';
import { getAuth } from '@/server/auth';

/**
 * Maps a granted scope string to its `messages/{nl,en}.json` `oauth.scopes`
 * key — mirrors `MCP_SCOPES` in `server/auth.ts` (not imported from there:
 * the consent page's job is "what can I explain to a human", which is a UI
 * concern, not an auth-config one).
 *
 * The message key is deliberately *not* the scope string itself: next-intl
 * treats a `.` in a message key as a nesting separator, so a raw
 * `oauth.scopes.${scope}` lookup for e.g. `kynite:calendar.read` resolves to
 * `oauth.scopes.kynite:calendar.read` → nested under `scopes.kynite:calendar`
 * → `read`, which doesn't exist, and next-intl throws `MISSING_MESSAGE`
 * rather than returning undefined. Every scope this consent page can display
 * is routed through this dot/colon-free key instead.
 */
export const SCOPE_MESSAGE_KEYS: Readonly<Record<string, string>> = {
  openid: 'openid',
  profile: 'profile',
  email: 'email',
  offline_access: 'offlineAccess',
  'kynite:calendar.read': 'calendarRead',
  'kynite:calendar.write': 'calendarWrite',
  'kynite:tasks.read': 'tasksRead',
  'kynite:tasks.write': 'tasksWrite',
};

/**
 * The scopes `messages/{nl,en}.json`'s `oauth.scopes` has a label for. A
 * scope outside this set — should not happen, since the AS only grants what
 * it was configured to accept — falls back to `oauth.unknownScope` instead
 * of a raw, untranslated key.
 */
export const KNOWN_OAUTH_SCOPES: ReadonlySet<string> = new Set(Object.keys(SCOPE_MESSAGE_KEYS));

/**
 * Resolves a scope string to its safe `oauth.scopes` message key, or `null`
 * for a scope this consent page doesn't know how to label — the caller
 * should fall back to `oauth.unknownScope` rather than attempt a dynamic
 * lookup keyed on the raw scope string.
 */
export function scopeMessageKey(scope: string): string | null {
  return SCOPE_MESSAGE_KEYS[scope] ?? null;
}

export type OAuthConsentClient = {
  clientId: string;
  name: string | null;
  uri: string | null;
  logoUri: string | null;
  tosUri: string | null;
  policyUri: string | null;
};

export type OAuthConsentPageData = {
  client: OAuthConsentClient;
  /** Requested scopes, space-split from the `scope` query parameter. */
  scopes: string[];
  /**
   * The consent page's own incoming query string, forwarded verbatim to
   * `/oauth2/consent` as `oauth_query` (see `actions.ts`).
   */
  oauthQuery: string;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildOAuthQuery(searchParams: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value === undefined) continue;
    for (const entry of Array.isArray(value) ? value : [value]) params.append(key, entry);
  }
  return params.toString();
}

/**
 * The server-side read `(app)/oauth/consent` composes (architecture §2 rule
 * 4: route files hold no logic).
 *
 * `null` covers every "cannot show consent" case alike (no member principal,
 * no `client_id`, an unknown or disabled client) — the page turns all of them
 * into the same `notFound()`, deliberately: distinguishing "no such client"
 * from "not signed in" to an unauthenticated caller is exactly the kind of
 * detail an authorization-server consent screen should not leak.
 */
export async function loadOAuthConsentPage(
  searchParams: Record<string, string | string[] | undefined>
): Promise<OAuthConsentPageData | null> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return null;

  const clientId = firstValue(searchParams.client_id);
  if (!clientId) return null;

  const client = await getAuth()
    .api.getOAuthClientPublic({
      query: { client_id: clientId },
      headers: await headers(),
    })
    .catch(() => null);
  if (!client) return null;

  const scope = firstValue(searchParams.scope) ?? '';

  return {
    client: {
      clientId: client.client_id,
      name: client.client_name ?? null,
      uri: client.client_uri ?? null,
      logoUri: client.logo_uri ?? null,
      tosUri: client.tos_uri ?? null,
      policyUri: client.policy_uri ?? null,
    },
    scopes: scope.split(' ').filter(Boolean),
    oauthQuery: buildOAuthQuery(searchParams),
  };
}
