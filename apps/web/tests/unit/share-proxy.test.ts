import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

/**
 * next-intl's middleware factory is stubbed with the identity of what it
 * actually returns here — a `NextResponse.next()` — because the real module
 * resolves `next/server` in a way plain Node cannot follow. Nothing under test
 * depends on what next-intl does with the request: the criteria are the headers
 * this file sets *on* whatever response comes back, and the 405 it returns
 * before next-intl is ever called.
 */
vi.mock('next-intl/middleware', () => ({
  default: () => () => NextResponse.next(),
}));

const { default: proxy, config } = await import('@/proxy');
const { DEVICE_SESSION_COOKIE } = await import('@/lib/device-session');

/**
 * The transport-level half of M13, asserted where it can be asserted without a
 * server: `src/proxy.ts` itself.
 *
 * Two criteria live here. **Headers** — every `(share)` response carries
 * `noindex` and `Referrer-Policy: no-referrer`, because the token is in the
 * path and both an index entry and a `Referer` leak are a credential leak.
 * **Mutation blocking** — a Server Action invocation is a POST to the page that
 * rendered it, so refusing every non-GET to `/s/*` closes the mutation path at
 * the transport, underneath whatever the route tree happens to import.
 *
 * The e2e suite asserts the same two things end to end. This asserts them
 * cheaply, on every `pnpm test:run`, where a regression is found in seconds
 * rather than after a browser boots.
 */

const TOKEN = '2XZ1qsSPBLc0y2i8s8OXY0N2gZ2mLcQOgVaVsGxOaWo';

function request(path: string, method = 'GET'): NextRequest {
  return new NextRequest(`https://kynite.test${path}`, { method });
}

describe('(share) responses carry noindex and no-referrer', () => {
  it.each([
    `/nl/s/${TOKEN}`,
    `/en/s/${TOKEN}`,
    // Unprefixed: next-intl redirects to the default locale, and the redirect
    // itself carries the token in its `Location` — so it needs the headers too.
    `/s/${TOKEN}`,
  ])('%s', (path) => {
    const response = proxy(request(path));

    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('does not put them on the parent app', () => {
    // The headers are scoped to the share tree, not global: `no-referrer`
    // repo-wide would be a different (and unreviewed) decision.
    const response = proxy(request('/nl/sign-in'));
    expect(response.headers.get('Referrer-Policy')).toBeNull();
  });
});

describe('(share) refuses every mutation', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('%s is 405', (method) => {
    const response = proxy(request(`/nl/s/${TOKEN}`, method));

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, HEAD');
  });

  it('allows GET and HEAD', () => {
    for (const method of ['GET', 'HEAD']) {
      expect(proxy(request(`/nl/s/${TOKEN}`, method)).status).not.toBe(405);
    }
  });

  it('refuses a POST even to a nonsense token — no probe distinguishes them', () => {
    expect(proxy(request('/nl/s/whatever', 'POST')).status).toBe(405);
    expect(proxy(request('/nl/s', 'POST')).status).toBe(405);
  });

  it('leaves the contributor write path alone', () => {
    // `POST /api/share/completions` is how a contributor tick actually lands.
    // The matcher skips `api/`, so the proxy never runs for it at all — this
    // asserts the config, which is the thing that makes that true.
    // Next anchors a matcher at both ends; `new RegExp` does not, so the
    // anchors go in explicitly or every path matches by substring.
    const matcher = new RegExp(`^${config.matcher}$`);

    expect(matcher.test('/api/share/completions')).toBe(false);
    // …and the share tree itself is inside the matcher, or none of the above
    // would ever run.
    expect(matcher.test(`/nl/s/${TOKEN}`)).toBe(true);
  });
});

/**
 * F3: the `(auth)/invite/[token]` tree (M14, PRD FR26) carries the same
 * `noindex` / `no-referrer` / `no-store` headers as `(share)` — the raw token
 * lives in the path here too. Headers only: unlike `(share)` this tree is
 * *not* funnelled through the 405 mutation guard, because `acceptInviteAction`
 * and `chooseProfileAction` submit as `POST` to this same URL by design.
 */
describe('(invite) responses carry noindex and no-referrer', () => {
  it.each([
    `/nl/invite/${TOKEN}`,
    `/en/invite/${TOKEN}`,
    // Unprefixed: next-intl redirects to the default locale, and the redirect
    // itself carries the token in its `Location` — so it needs the headers too.
    `/invite/${TOKEN}`,
  ])('%s', (path) => {
    const response = proxy(request(path));

    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('does not 405 a POST — the flow submits Server Actions to this tree', () => {
    const response = proxy(request(`/nl/invite/${TOKEN}`, 'POST'));

    expect(response.status).not.toBe(405);
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
  });

  it('is inside the matcher', () => {
    const matcher = new RegExp(`^${config.matcher}$`);
    expect(matcher.test(`/nl/invite/${TOKEN}`)).toBe(true);
  });
});

describe('/manage is member-only at the proxy (H4)', () => {
  function withCookie(path: string, name: string): NextRequest {
    return new NextRequest(`https://kynite.test${path}`, { headers: { cookie: `${name}=x` } });
  }

  it('sends a paired device to /today, not to sign-in', () => {
    const response = proxy(withCookie('/nl/manage/rewards', DEVICE_SESSION_COOKIE));

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get('location')!).pathname).toBe('/nl/today');
  });

  it('sends a credential-less request to sign-in', () => {
    const response = proxy(request('/nl/manage'));

    expect(new URL(response.headers.get('location')!).pathname).toBe('/nl/sign-in');
  });
});

/**
 * H4: the pre-Beheer `(app)` roots redirect permanently. A signed-out visitor
 * is redirected *first* (308, before any cookie rule), so after sign-in the
 * `callbackUrl` the proxy writes is the new path — the visitor ends on the
 * right page.
 */
describe('legacy (app) roots redirect permanently (H4)', () => {
  it.each([
    ['/nl/settings', '/nl/manage/settings'],
    ['/en/settings', '/en/manage/settings'],
    ['/nl/settings/devices', '/nl/manage/settings/devices'],
    ['/nl/settings/google', '/nl/manage/settings/google'],
    ['/nl/settings/sharing', '/nl/manage/settings/sharing'],
    ['/nl/settings/subscriptions', '/nl/manage/settings/subscriptions'],
    ['/nl/settings/notifications', '/nl/account/notifications'],
    ['/en/settings/notifications', '/en/account/notifications'],
    ['/nl/family', '/nl/manage/family'],
    ['/en/rewards', '/en/manage/rewards'],
  ])('%s -> %s', (from, to) => {
    const response = proxy(request(from));

    expect(response.status).toBe(308);
    expect(new URL(response.headers.get('location')!).pathname).toBe(to);
  });

  it('keeps the query string', () => {
    const response = proxy(request('/nl/settings/google?google=connected'));

    const location = new URL(response.headers.get('location')!);
    expect(location.pathname).toBe('/nl/manage/settings/google');
    expect(location.search).toBe('?google=connected');
  });

  it('redirects regardless of credentials, then sign-in carries the new path', () => {
    const first = proxy(request('/nl/settings/google'));
    expect(first.status).toBe(308);

    const second = proxy(request(new URL(first.headers.get('location')!).pathname));
    const location = new URL(second.headers.get('location')!);
    expect(location.pathname).toBe('/nl/sign-in');
    expect(location.searchParams.get('callbackUrl')).toBe('/nl/manage/settings/google');
  });
});

describe('/account is member-only at the proxy (H4)', () => {
  it('sends a credential-less request to sign-in with the callback', () => {
    const location = new URL(proxy(request('/nl/account')).headers.get('location')!);

    expect(location.pathname).toBe('/nl/sign-in');
    expect(location.searchParams.get('callbackUrl')).toBe('/nl/account');
  });

  it('sends a paired device to /today', () => {
    const response = proxy(
      new NextRequest('https://kynite.test/nl/account', {
        headers: { cookie: `${DEVICE_SESSION_COOKIE}=x` },
      })
    );

    expect(new URL(response.headers.get('location')!).pathname).toBe('/nl/today');
  });

  it('lets a session cookie through (no redirect)', () => {
    const response = proxy(
      new NextRequest('https://kynite.test/nl/account', {
        headers: { cookie: 'better-auth.session_token=x' },
      })
    );

    expect(response.headers.get('location')).toBeNull();
  });
});
