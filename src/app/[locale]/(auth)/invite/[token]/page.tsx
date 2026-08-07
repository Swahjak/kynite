import { headers } from 'next/headers';
import {
  InviteAcceptStep,
  InviteGone,
  InviteGoogleStep,
  InviteProfileStep,
  inviteStateOf,
  resolveInvite,
} from '@/modules/family';
import { isGoogleConfigured, listLinkedAccounts } from '@/modules/google';
import { redirect } from '@/i18n/navigation';
import { getAuth } from '@/server/auth';

/**
 * The second-parent onboarding flow (PRD FR26, milestone M14).
 *
 * One route, three screens, and the screen you get is derived from state rather
 * than from a step counter in the URL. That shape is what makes the third
 * acceptance criterion ("cannot be replayed") and the third *interaction*
 * (an off-site round trip to Google's consent screen) coexist: the invitee
 * leaves for Google and comes back, and there is no half-finished wizard to
 * resume because there was never a wizard — only a set of facts about the
 * household, re-read on every request.
 *
 *   invite not pending          → the friendly gone screen
 *   pending                     → 1. accept
 *   claimed by *this* session    → 2. pick avatar/colour, then
 *                                 3. connect Google
 *   claimed and everything done → the calendar, which is the point
 *
 * "Claimed by *this* session" is the replay guard. The token stays in the URL
 * after acceptance so the browser that used it can finish; anyone else
 * presenting the same link — a forwarded message, a shoulder-surfer, the
 * invitee's own second browser — sees the already-claimed screen, because the
 * session's user id will not match `claimedByUserId`. The token is spent the
 * instant it is accepted; what survives is one browser's right to finish what
 * it started.
 */
export const dynamic = 'force-dynamic';

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;

  const resolved = await resolveInvite(token);
  if (!resolved) return <InviteGone state="notFound" />;

  const { invite, member, familyName } = resolved;
  const state = inviteStateOf(invite, new Date());

  if (state === 'pending') {
    return (
      <InviteAcceptStep
        token={token}
        familyName={familyName}
        displayName={member.displayName}
        color={member.color}
      />
    );
  }

  if (state !== 'claimed') return <InviteGone state={state} />;

  const session = await getAuth().api.getSession({ headers: await headers() });

  // Claimed, but not by whoever is holding this URL now. This is the replay
  // path, and it is deliberately indistinguishable from any other spent link.
  if (!session || session.user.id !== invite.claimedByUserId) {
    return <InviteGone state="claimed" />;
  }

  // Step 2 is done when *this invite* has been marked complete — not when
  // `member.avatarUrl` happens to be set (F10). The two look equivalent and
  // are not: an owner who pre-sets an avatar on the member row (or edits it
  // while the invite is outstanding) would otherwise make this branch skip
  // the profile step entirely, and the invitee never gets their own tap at
  // "this is me." `profileCompletedAt` is written exactly once, by
  // `chooseProfileAction`, and only in response to that tap.
  if (!invite.profileCompletedAt) {
    return <InviteProfileStep token={token} displayName={member.displayName} />;
  }

  const accounts = await listLinkedAccounts(invite.familyId);
  const hasOwnGoogle = accounts.some((account) => account.ownerMemberId === member.id);

  if (!hasOwnGoogle) {
    return <InviteGoogleStep displayName={member.displayName} configured={isGoogleConfigured()} />;
  }

  // Three interactions done. FR26's payoff is the family view with their own
  // calendar already in it, so that is where the flow ends — no confirmation
  // screen, no fourth tap.
  redirect({ href: '/calendar', locale });
}
