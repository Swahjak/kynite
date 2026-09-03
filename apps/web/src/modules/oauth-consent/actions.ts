'use server';

import { headers } from 'next/headers';
import { redirect as externalRedirect } from 'next/navigation';
import { getPrincipal } from '@/modules/family';
import { getAuth } from '@/server/auth';
import { env } from '@/server/env';

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

  /**
   * `auth.api.*` calls don't carry a raw `Request` unless one is passed
   * explicitly, but the oauth-provider plugin's authorize continuation
   * (reached from the accept branch of `/oauth2/consent`) requires
   * `ctx.request` unconditionally — see `authorizeEndpoint` in the installed
   * `@better-auth/oauth-provider` dist (`dist/authorize-*.mjs`):
   * `if (!ctx.request) throw new APIError('UNAUTHORIZED', {error_description:
   * 'request not found', error: 'invalid_request'})`. Without it, clicking
   * approve threw that error before ever reaching the redirect it was meant
   * to build.
   *
   * We satisfy it with a synthetic `Request`, built from a *copy* of the
   * incoming headers rather than the object `next/headers()` hands back:
   * `consentEndpoint` mutates `ctx.headers` (`.set('accept',
   * 'application/json')`) to steer the shared authorize continuation toward
   * returning `{redirect, url}` instead of throwing an HTTP redirect —
   * Next's `ReadonlyHeaders` throws on any mutation, so the same object
   * can't be handed through as `headers` either. better-call's context
   * builder (`node_modules/better-call/dist/context.mjs`) assigns
   * `request` and `headers` straight from what's passed in, so a fresh
   * `Headers` copy shared between both fields keeps `ctx.headers` and
   * `ctx.request.headers` consistent.
   *
   * Passing a real `Request` has a side effect one layer up, though:
   * `dispatchAuthEndpoint` (`better-auth/dist/api/dispatch.mjs`) decides
   * whether to hand back the endpoint's plain return value or wrap it in an
   * HTTP `Response` via `shouldReturnResponse = input.asResponse ??
   * isRequestLike(input.request)` — and `isRequestLike` (`better-auth/dist/
   * utils/url.mjs`) is `true` for any `instanceof Request`. Without an
   * explicit `asResponse: false`, our own `request` flips that default and
   * `oauth2Consent` returns a `Response` built by `toResponse()`
   * (`better-call/dist/to-response.mjs`) instead of the `{redirect, url}`
   * object — and a `Response` built with `new Response(...)` (never fetched)
   * always reports `.url === ''` per the Fetch spec, which is exactly the
   * `Invalid URL, input: ''` crash. `asResponse: false` keeps the plain
   * object shape regardless of `request` being present. The nested
   * `/oauth2/authorize` continuation the accept path runs through
   * (`runOAuth2Authorize` in the oauth-provider dist) already forces its own
   * `asResponse: false`, so that hop was never affected — only this
   * top-level call was.
   */
  const requestHeaders = new Headers(await headers());
  const consentUrl = new URL('/api/auth/oauth2/consent', env.BETTER_AUTH_URL);

  const result = await getAuth().api.oauth2Consent({
    body: { accept, oauth_query: oauthQuery },
    headers: requestHeaders,
    request: new Request(consentUrl, { method: 'POST', headers: requestHeaders }),
    asResponse: false,
  });

  if (!result.url) {
    throw new Error('OAuth consent did not return a redirect URL.');
  }

  externalRedirect(asExternalUrl(result.url));
  // `redirect()` throws — unreachable, but the signature must stay total.
}
