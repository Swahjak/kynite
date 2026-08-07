import { headers } from 'next/headers';
import { SignInForm, getPrincipal, hasEverBeenMember } from '@/modules/family';
import { CALLBACK_URL_PARAM, sanitizeCallbackUrl, withoutLocalePrefix } from '@/lib/callback-url';
import { redirect } from '@/i18n/navigation';
import { getAuth, isSocialSignInConfigured } from '@/server/auth';
import { MEMBERSHIP_REMOVED_NOTICE, SIGN_IN_NOTICE_PARAM } from '../notice';

/** Session-dependent: never prerendered, so `next build` needs no secrets. */
export const dynamic = 'force-dynamic';

/** Anyone who already has a scoped session has no business on this form. */
export default async function SignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const query = await searchParams;

  // M18: `src/proxy.ts` puts the intended destination here when it turns a
  // cookie-less request away. Sanitized on the way in as well as on the way
  // out — a page that renders an unvalidated value into a hidden input has
  // already handed the attacker the redirect, whatever the action does later.
  const raw = query[CALLBACK_URL_PARAM];
  const callbackUrl = sanitizeCallbackUrl(Array.isArray(raw) ? raw[0] : raw);

  // A session that is already scoped goes straight where it was headed — the
  // form has nothing to ask it.
  const principal = await getPrincipal();
  if (principal) {
    redirect({ href: callbackUrl ? withoutLocalePrefix(callbackUrl) : '/family', locale });
  }

  /**
   * M19 phase 2: no principal is not the same as no session. A Google account
   * that abandoned onboarding still holds a valid, *unscoped* session — showing
   * it this form would be a dead end, since the credential it is being asked
   * for does not exist.
   *
   * F4, two corrections:
   *
   *  - The `isSocialSignInConfigured()` gate is gone. Whether `/onboarding` is
   *    *reachable* is a fact about this browser's session, not about which
   *    environment variables happen to be set: an install that drops its Google
   *    credentials still has social users holding unscoped sessions, and gating
   *    the redirect on the env left exactly them on a form they cannot use.
   *  - A user who *used to* be a member reaches this state too (their member
   *    row was removed), and they are not onboarding anybody. They stay on this
   *    form and get told so — `(auth)/onboarding` sends them straight back here
   *    with `?notice=` if they arrive there by hand.
   */
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (session && !(await hasEverBeenMember(session.user.id))) {
    redirect({ href: '/onboarding', locale });
  }

  const rawNotice = query[SIGN_IN_NOTICE_PARAM];
  const notice =
    (Array.isArray(rawNotice) ? rawNotice[0] : rawNotice) === MEMBERSHIP_REMOVED_NOTICE
      ? MEMBERSHIP_REMOVED_NOTICE
      : null;

  // better-auth's callback routes every OAuth failure through `?error=<code>`
  // (`oauth2/errors.ts`). The codes are not translated one by one on purpose:
  // the only one a household can act on is a refused account link, and the rest
  // ("please try again") are indistinguishable to the person reading them.
  const oauthError = typeof query.error === 'string' ? query.error : undefined;

  /**
   * One slot, two producers. `SignInForm`'s banner renders any key under
   * `auth.errors`, and the removal notice is the same shape of message as an
   * OAuth bounce: a sentence explaining why this form is being shown again. The
   * notice wins when both are present — it is the more specific answer to "why
   * am I here".
   */
  const message =
    notice ??
    (oauthError === 'account_not_linked' ? 'oauthNotLinked' : oauthError ? 'oauthFailed' : null);

  return (
    <SignInForm
      callbackUrl={callbackUrl}
      socialEnabled={isSocialSignInConfigured()}
      oauthError={message}
    />
  );
}
