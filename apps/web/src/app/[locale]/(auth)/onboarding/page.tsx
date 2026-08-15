import { headers } from 'next/headers';
import { CreateFamilyForm, getPrincipal, hasEverBeenMember } from '@/modules/family';
import { redirect } from '@/i18n/navigation';
import { getAuth } from '@/server/auth';
import { MEMBERSHIP_REMOVED_NOTICE, SIGN_IN_NOTICE_PARAM } from '../notice';

/** Session-dependent: never prerendered, so `next build` needs no secrets. */
export const dynamic = 'force-dynamic';

/**
 * First run for a Google account (M19 phase 2).
 *
 * The one screen in the app that exists for a state nothing else can represent:
 * a valid better-auth session whose user has **no member row**, and which
 * therefore resolves to no principal at all. Only the social flow can produce
 * it — `signUpAction` and `acceptInviteAction` both attach the member before
 * they issue a session, and Google's callback has no seam to do that in (see
 * `session.create.before` in `src/server/auth.ts`).
 *
 * Both exits are guards rather than branches inside the form:
 *
 *  - a principal already exists → they are not in this state; send them on. A
 *    paired kiosk goes to the board for the same reason `(app)/layout.tsx`
 *    sends it there — a wall tablet is never an owner-level session.
 *  - no session at all → nothing to onboard; the sign-in form is the entry.
 *  - a session whose user *used to* be a member → not a first run at all. See
 *    below; this is F4.
 *
 * `newUserCallbackURL` in `signInWithGoogleAction` points here, so a brand new
 * Google account lands on this page directly out of the OAuth callback.
 */
export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  const principal = await getPrincipal();
  if (principal?.kind === 'device') redirect({ href: '/hub', locale });
  if (principal?.kind === 'member') redirect({ href: '/family', locale });

  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect({ href: '/sign-in', locale });

  /**
   * F4. "Session but no principal" is not, on its own, a first run. A parent
   * whose member row was removed by the owner presents the exact same state,
   * and this form would silently make them the owner of a household of their
   * own — a data-creating action nobody asked for, reached by being *removed*.
   *
   * `hasEverBeenMember` is what separates the two: it reads the tombstone
   * `deleteMemberAction` writes as well as the live rows, so it can answer
   * "never had one" rather than only "has none right now". A removed user goes
   * back to the sign-in form with a neutral notice; the session is not revoked
   * here, because a Server Component may not write cookies (it was already
   * revoked at removal time, so in practice this path is only reached by a
   * cookie the cache is still serving).
   */
  // `redirect()` throws, so the `session` above is non-null here — but it
  // returns `void`, so the compiler does not know that; the extra `session &&`
  // is for its benefit, exactly like the `session?.` in the render below.
  if (session && (await hasEverBeenMember(session.user.id))) {
    redirect({
      href: {
        pathname: '/sign-in',
        query: { [SIGN_IN_NOTICE_PARAM]: MEMBERSHIP_REMOVED_NOTICE },
      },
      locale,
    });
  }

  return <CreateFamilyForm displayName={session?.user.name ?? ''} />;
}
