import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import createMiddleware from 'next-intl/middleware';
import { DEVICE_SESSION_COOKIE } from '@/lib/device-session';
import { routing } from '@/i18n/routing';

// Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`.
const intl = createMiddleware(routing);

/**
 * First URL segment (after the locale) of every `(app)` route: the parent PWA,
 * which requires an account session (docs/architecture.md §2).
 */
const PROTECTED_SECTIONS = new Set([
  'today',
  'calendar',
  'routines',
  'rewards',
  'family',
  'settings',
]);

function isLocale(segment: string | undefined): segment is (typeof routing.locales)[number] {
  return routing.locales.includes(segment as (typeof routing.locales)[number]);
}

/** The kiosk tree's own first segment (M12). */
const HUB_SECTION = 'hub';

/**
 * Optimistic guard: a missing session cookie is turned away here so the tree
 * behind it is never even rendered. Cookie *presence* is not proof of a
 * session — `(app)/layout.tsx` and `requireHubDevice()` re-check against the
 * database and are authoritative. Both checks exist because the cheap one
 * saves a render and the expensive one is the one that is true.
 *
 * The two trees are mirror images: `(app)` needs an *account* cookie and
 * bounces to sign-in without one; `(hub)` needs a *device* cookie and bounces
 * to the pair screen without one. `/hub/pair` is exempt for the obvious reason
 * — it is where the device cookie comes from.
 */
export default function proxy(request: NextRequest): NextResponse {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const locale = isLocale(segments[0]) ? segments[0] : routing.defaultLocale;
  const rest = isLocale(segments[0]) ? segments.slice(1) : segments;
  const section = rest[0];

  if (section && PROTECTED_SECTIONS.has(section) && !getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/sign-in`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (
    section === HUB_SECTION &&
    rest[1] !== 'pair' &&
    !request.cookies.has(DEVICE_SESSION_COOKIE) &&
    // A signed-in parent is not redirected from here: `requireHubDevice()`
    // sends them to their own surface instead, and it is the only one of the
    // two that can tell a member principal from an unpaired tablet.
    !getSessionCookie(request)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/hub/pair`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return intl(request);
}

export const config = {
  // Skip API routes, Next internals, the internal /dev tooling routes (which
  // are not localised) and anything with a file extension.
  matcher: '/((?!api|dev|_next|_vercel|.*\\..*).*)',
};
