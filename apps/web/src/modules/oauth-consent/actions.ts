'use server';

import { headers } from 'next/headers';
import { redirect as externalRedirect } from 'next/navigation';
import { getPrincipal } from '@/modules/family';
import { getAuth } from '@/server/auth';

/**
 * Next 16's typed routes accept an off-site destination only as a literal
 * carrying a protocol; better-auth hands back a plain `string`. Safe by
 * construction: the value is a `redirect_uri` better-auth itself built from
 * the requesting client's own registered redirect URI (or its own
 * error-redirect), never anything the browser supplied. Same pattern as
 * `asExternalUrl` in `modules/family/actions.ts`.
 */
function asExternalUrl(url: string): `${string}:${string}` {
  return url as `${string}:${string}`;
}

/**
 * M-C. Approves or denies one MCP/OAuth authorization request from
 * `(app)/oauth/consent`.
 *
 * @public-action Not a family-matrix capability — there is no family
 * `Resource` here to grade `assertCan` against. This is the account holder
 * deciding on *their own* OAuth grant, the same self-authorizing class as
 * `signInAction`/`signOutAction`: the better-auth session cookie (checked
 * directly below, since `getPrincipal()` reads it) is the whole of the
 * authorization. Listed in
 * `tests/unit/server-action-authorization.test.ts`'s `PUBLIC_ACTIONS`.
 *
 * `oauthQuery` is the consent page's own incoming query string, forwarded
 * verbatim as the plugin's `oauth_query` body field — see
 * `@better-auth/oauth-provider`'s `/oauth2/consent` endpoint doc comment
 * ("the redirected page's query parameters").
 *
 * The endpoint's JSDoc describes its response body as `{ redirect_uri }`;
 * the installed `.d.mts` (`OAuthRedirectResult`, `oauth-D8xpKR0_.d.mts`) says
 * otherwise — `{ redirect: true; url: string }` — and that is what is used
 * here, per this repo's standing rule to trust installed source over docs
 * prose for this 1.7 upgrade.
 */
export async function oauthConsentAction(accept: boolean, oauthQuery: string): Promise<void> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') {
    throw new Error('OAuth consent requires a signed-in member.');
  }

  const requestHeaders = await headers();
  const result = await getAuth().api.oauth2Consent({
    body: { accept, oauth_query: oauthQuery },
    headers: requestHeaders,
  });

  externalRedirect(asExternalUrl(result.url));
  // `redirect()` throws — unreachable, but the signature must stay total.
}
