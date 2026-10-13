import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

// Same stub as share-proxy.test.ts: only the proxy's own redirects are under test.
const seen = vi.hoisted(() => ({ request: null as NextRequest | null }));
vi.mock('next-intl/middleware', () => ({
  default: () => (request: NextRequest) => {
    seen.request = request;
    return NextResponse.next();
  },
}));

const { default: proxy } = await import('@/proxy');
const { DEVICE_SESSION_COOKIE } = await import('@/lib/device-session');
const { INTENDED_PATH_HEADER } = await import('@/lib/callback-url');

const SESSION = 'better-auth.session_token=abc';
const DEVICE = `${DEVICE_SESSION_COOKIE}=xyz`;

/** `[location | 'pass']` of the proxy's decision for a GET with the given cookies. */
function decide(path: string, cookies: string[]): string {
  const response = proxy(
    new NextRequest(`https://kynite.test${path}`, {
      headers: cookies.length ? { cookie: cookies.join('; ') } : {},
    })
  );
  const location = response.headers.get('location');
  return location ? `${location.replace('https://kynite.test', '')}` : 'pass';
}

const signIn = (callback: string) => `/nl/sign-in?callbackUrl=${encodeURIComponent(callback)}`;

describe('proxy decision table: shared tree and member sections', () => {
  it.each([
    // No cookie at all: a parent with an expired session -> sign-in, callback kept.
    ['/nl/today', [], signIn('/nl/today')],
    ['/nl/today?date=2026-08-14', [], signIn('/nl/today?date=2026-08-14')],
    ['/nl/calendar', [], signIn('/nl/calendar')],
    // Device-only surfaces stay on /pair: kiosk cold boot.
    ['/nl/clock', [], '/nl/pair'],
    // Either cookie passes the cheap bounce; the page gate is authoritative.
    ['/nl/today', [SESSION], 'pass'],
    ['/nl/today', [DEVICE], 'pass'],
    ['/nl/clock', [DEVICE], 'pass'],
    ['/nl/pair', [], 'pass'],
    // Member routes: no session -> sign-in with callbackUrl, stale device cookie or not.
    ['/nl/manage', [], signIn('/nl/manage')],
    ['/nl/manage/settings/devices', [DEVICE], signIn('/nl/manage/settings/devices')],
    ['/nl/account', [DEVICE], signIn('/nl/account')],
    ['/nl/manage', [SESSION], 'pass'],
  ])('%s with cookies %j -> %s', (path, cookies, expected) => {
    expect(decide(path, cookies)).toBe(expected);
  });
});

describe('proxy intended-path header', () => {
  it('overwrites a client-supplied x-kynite-path with the real path', () => {
    proxy(
      new NextRequest('https://kynite.test/nl/manage', {
        headers: { cookie: SESSION, 'x-kynite-path': '//evil' },
      })
    );
    expect(seen.request?.headers.get(INTENDED_PATH_HEADER)).toBe('/nl/manage');
  });
});
