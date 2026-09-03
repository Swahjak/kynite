import 'server-only';
import { headers } from 'next/headers';
import { getPrincipal } from '@/modules/family';
import { getAuth } from '@/server/auth';

/**
 * The scopes `messages/{nl,en}.json`'s `oauth.scopes` has a label for —
 * mirrors `MCP_SCOPES` in `server/auth.ts` (not imported from there: the
 * consent page's job is "what can I explain to a human", which is a UI
 * concern, not an auth-config one). A scope outside this set — should not
 * happen, since the AS only grants what it was configured to accept — falls
 * back to `oauth.unknownScope` instead of a raw, untranslated key.
 */
export const KNOWN_OAUTH_SCOPES: ReadonlySet<string> = new Set([
  'openid',
  'profile',
  'email',
  'offline_access',
  'kynite:calendar.read',
  'kynite:calendar.write',
  'kynite:tasks.read',
  'kynite:tasks.write',
]);

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
