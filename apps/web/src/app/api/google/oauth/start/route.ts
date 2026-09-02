import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { getLocale } from 'next-intl/server';
import { ForbiddenError, assertCan, getPrincipal } from '@/modules/family';
import {
  OAUTH_NONCE_COOKIE,
  authorizationUrl,
  createOAuthState,
  decodeOAuthNonces,
  encodeOAuthNonces,
  isGoogleConfigured,
  isOAuthReturnTo,
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

  /**
   * Where the callback should land (M14). Validated against a closed set here
   * and then carried *inside the signed state*, never as a query parameter on
   * the callback — so it cannot be swapped after consent, and an unrecognised
   * value silently falls back to settings rather than becoming a redirect.
   */
  const requested = request.nextUrl.searchParams.get('returnTo');
  const returnTo = isOAuthReturnTo(requested) ? requested : undefined;

  /**
   * Which account the consent screen should preselect — the reconnect path for
   * an account whose refresh token died. Deliberately *not* in the signed
   * state: it has no security meaning (the user may pick another account, and
   * the callback reads the real identity from userinfo either way), so it is
   * only length-bounded to keep a junk query string out of Google's URL.
   */
  const hint = request.nextUrl.searchParams.get('email');
  const loginHint = hint && hint.length <= 254 ? hint : undefined;

  const { state, nonce } = createOAuthState(principal.familyId, principal.memberId, { returnTo });

  const store = await cookies();
  // A *set* of nonces, not one value: a duplicated start request or a second
  // flow started before the first completes must not overwrite the nonce the
  // other one needs — that race is what produced `state_verification_failed`
  // immediately followed by `missing_nonce_cookie` in production. Keep only
  // the newest few; the 15-minute maxAge already bounds the risk.
  const existing = decodeOAuthNonces(store.get(OAUTH_NONCE_COOKIE)?.value);
  store.set(OAUTH_NONCE_COOKIE, encodeOAuthNonces([...existing, nonce]), {
    httpOnly: true,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 15 * 60,
  });

  // The one absolute redirect: it leaves our origin for Google's consent screen.
  return NextResponse.redirect(authorizationUrl(state, { loginHint }));
}
