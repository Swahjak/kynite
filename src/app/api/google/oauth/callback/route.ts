import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { getLocale } from 'next-intl/server';
import { getPrincipal } from '@/modules/family';
import {
  OAUTH_NONCE_COOKIE,
  bootstrapAccount,
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
  const nonce = store.get(OAUTH_NONCE_COOKIE)?.value ?? null;
  // Single-use: whatever happens below, this nonce is spent.
  store.delete(OAUTH_NONCE_COOKIE);

  const params = request.nextUrl.searchParams;
  if (params.get('error')) return fail('consentDenied');
  if (!isGoogleConfigured()) return fail('notConfigured');

  const state = verifyOAuthState(params.get('state'), nonce);
  const code = params.get('code');
  if (!state || !code) return fail('invalidState');

  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return redirectTo(`/${locale}/sign-in`);
  if (principal.familyId !== state.familyId || principal.memberId !== state.memberId) {
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
    const account = await linkGoogleAccount({
      familyId: state.familyId,
      memberId: state.memberId,
      identity,
      tokens,
    });

    // Discovery is synchronous so the settings page already lists the
    // calendars; the initial per-calendar sync is queued, not awaited.
    await bootstrapAccount(account.id);

    return redirectTo(settings(`?linked=${encodeURIComponent(account.email || '1')}`));
  } catch (error) {
    console.error('[google] link failed', error);
    return fail('linkFailed');
  }
}
