import { NextResponse, type NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';
import createMiddleware from 'next-intl/middleware';
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

/**
 * Optimistic guard: a missing session cookie is turned away here so the app
 * tree is never even rendered. Cookie *presence* is not proof of a session —
 * `(app)/layout.tsx` re-checks against the database and is authoritative.
 */
export default function proxy(request: NextRequest): NextResponse {
  const segments = request.nextUrl.pathname.split('/').filter(Boolean);
  const locale = isLocale(segments[0]) ? segments[0] : routing.defaultLocale;
  const section = isLocale(segments[0]) ? segments[1] : segments[0];

  if (section && PROTECTED_SECTIONS.has(section) && !getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/sign-in`;
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
