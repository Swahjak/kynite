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
