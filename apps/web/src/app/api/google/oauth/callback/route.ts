import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { getLocale } from 'next-intl/server';
import { getPrincipal } from '@/modules/family';
import {
  OAUTH_NONCE_COOKIE,
  bootstrapAccount,
  decodeOAuthNonces,
  encodeOAuthNonces,
  exchangeCode,
  fetchIdentity,
  isGoogleConfigured,
  linkGoogleAccount,
  verifyOAuthState,
} from '@/modules/google';

/**
 * OAuth callback (docs/architecture.md §5).
 *
 * Three things must agree before a single token is stored: the signed `state`
 * (tamper-proof), the nonce cookie (this browser started the flow) and the
 * current session (the consent lands in the family that asked for it, not in
 * whichever family the browser has since switched to).
 */
export const dynamic = 'force-dynamic';

/**
 * A *relative* `Location` (see the start route): `request.nextUrl.origin` is
 * normalised to `localhost` by `next dev`, and redirecting through it would
 * move the browser to another host and drop the session cookie.
 */
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 307, headers: { location: path } });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const locale = await getLocale();
  const settings = (query = ''): string => `/${locale}/settings/google${query}`;

  const fail = (reason: string): NextResponse =>
    redirectTo(settings(`?error=${encodeURIComponent(reason)}`));

  const store = await cookies();
  // A *set* of nonces (see `start/route.ts`), so a concurrent second flow's
  // nonce survives this one's callback. Single-use per nonce, not per
  // cookie: on success only the matched nonce is removed below; on failure
  // the cookie is left untouched entirely — a failed attempt must not spend
  // a nonce a genuine concurrent attempt still needs, and the 15-minute TTL
  // already bounds how long a stale nonce can matter.
  const nonces = decodeOAuthNonces(store.get(OAUTH_NONCE_COOKIE)?.value);

  const params = request.nextUrl.searchParams;
  if (params.get('error')) return fail('consentDenied');
  if (!isGoogleConfigured()) return fail('notConfigured');

  const state = verifyOAuthState(params.get('state'), nonces);
  const code = params.get('code');
  if (!state || !code) {
    console.warn('[google] oauth callback rejected', {
      reason: !code
        ? 'missing_code'
        : !params.get('state')
          ? 'missing_state_param'
          : nonces.length === 0
            ? 'missing_nonce_cookie'
            : 'state_verification_failed',
      hadStateParam: Boolean(params.get('state')),
      nonceCount: nonces.length,
    });
    return fail('invalidState');
  }

  // Spend only the nonce this callback consumed; rewrite (or clear) the
  // cookie so a concurrent second flow keeps its own nonce alive.
  const remaining = nonces.filter((candidate) => candidate !== state.nonce);
  if (remaining.length === 0) {
    store.delete(OAUTH_NONCE_COOKIE);
  } else {
    store.set(OAUTH_NONCE_COOKIE, encodeOAuthNonces(remaining), {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
      maxAge: 15 * 60,
    });
  }

  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return redirectTo(`/${locale}/sign-in`);
  if (principal.familyId !== state.familyId || principal.memberId !== state.memberId) {
    console.warn('[google] oauth callback rejected', { reason: 'principal_mismatch' });
    return fail('invalidState');
  }

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refreshToken) {
      // `access_type=offline&prompt=consent` should make this impossible; if it
      // happens the link would die within the hour, so refuse it now.
      return fail('noRefreshToken');
    }

    const identity = await fetchIdentity(tokens.accessToken);
    const { account, relinked } = await linkGoogleAccount({
      familyId: state.familyId,
      memberId: state.memberId,
      identity,
      tokens,
    });

    // Discovery is synchronous so the settings page already lists the
    // calendars; the initial per-calendar sync is queued, not awaited.
    //
    // A relink switches *nothing* on. `removeCalendar` hard-deletes the row, so
    // a calendar a parent took out of Kynite looks brand new to the next
    // discovery pass — defaulting it on would resurrect, on every reconnect,
    // exactly the calendars the household said it did not want. A first link
    // gets the account's own calendar and nothing else; the picker on the
    // settings page (`?linked=`) is where the rest is chosen.
    await bootstrapAccount(account.id, {
      newCalendarDefault: relinked ? 'none' : 'primary-only',
    });

    const linked = encodeURIComponent(account.email || '1');

    // M14: the second parent's third and final interaction ends here. FR26 says
    // their own calendar is merged into the family view "immediately", so that
    // is where they land — not on a settings page they never asked for.
    return redirectTo(
      state.returnTo === 'onboarding'
        ? `/${locale}/calendar?linked=${linked}`
        : settings(`?linked=${linked}`)
    );
  } catch (error) {
    console.error('[google] link failed', error);
    return fail('linkFailed');
  }
}
