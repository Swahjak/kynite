import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { getLocale } from 'next-intl/server';
import { ForbiddenError, assertCan, getPrincipal } from '@/modules/family';
import {
  OAUTH_NONCE_COOKIE,
  authorizationUrl,
  createOAuthState,
  isGoogleConfigured,
} from '@/modules/google';

/**
 * OAuth start (docs/architecture.md §5).
 *
 * A GET route rather than a Server Action because the response *is* a
 * cross-origin redirect to Google's consent screen. It is still an authorized
 * mutation entry point: `google:link` is checked here, the state is signed, and
 * its nonce is mirrored into an httpOnly cookie so the callback can prove the
 * consent belongs to this browser.
 */
export const dynamic = 'force-dynamic';

/**
 * A *relative* `Location`, which RFC 7231 allows and which is the only form
 * that survives both a reverse proxy and `next dev` — `request.nextUrl.origin`
 * is normalised to `localhost` in dev, so redirecting through it moves the
 * browser to a different host and silently drops the session cookie.
 */
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 307, headers: { location: path } });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const locale = await getLocale();
  const settings = (reason?: string): string =>
    `/${locale}/settings/google${reason ? `?error=${reason}` : ''}`;

  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return redirectTo(`/${locale}/sign-in`);

  try {
    await assertCan('google:link', { ownerMemberId: principal.memberId });
  } catch (error) {
    if (!(error instanceof ForbiddenError)) throw error;
    return redirectTo(settings('forbidden'));
  }

  // No credentials configured: linking is switched off, and the settings page
  // says which variables are missing rather than bouncing to a broken consent.
  if (!isGoogleConfigured()) return redirectTo(settings('notConfigured'));

  const { state, nonce } = createOAuthState(principal.familyId, principal.memberId);

  const store = await cookies();
  store.set(OAUTH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 15 * 60,
  });

  // The one absolute redirect: it leaves our origin for Google's consent screen.
  return NextResponse.redirect(authorizationUrl(state));
}
