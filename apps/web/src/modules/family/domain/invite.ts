/**
 * Pure invite-state rules (M14). No database, no React, no `server-only` — so
 * the owner's settings list, the `(auth)/invite/[token]` route and the unit
 * tests all read the same rules instead of each re-deriving them from three
 * nullable timestamps.
 */

/**
 * Where an invite is in its life.
 *
 * The precedence is deliberate and is the reason this is a function rather than
 * three inline ternaries:
 *
 * - `claimed` outranks everything. It is the terminal success state and it
 *   already happened; an invite that was accepted on Monday does not become
 *   "expired" on Friday, and revoking it afterwards cannot un-attach the login
 *   it created. Showing anything else would be a lie about the household.
 * - `revoked` outranks `expired`, matching `shareLinkStateOf` in the sharing
 *   slice: a deliberate act by a parent is more informative than a deadline
 *   that passed on its own.
 * - `pending` is what is left, and it is the only state `claimInvite` accepts.
 */
export type InviteState = 'pending' | 'claimed' | 'revoked' | 'expired';

export type InviteLifecycle = {
  claimedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
};

export function inviteStateOf(invite: InviteLifecycle, now: Date): InviteState {
  if (invite.claimedAt) return 'claimed';
  if (invite.revokedAt) return 'revoked';
  if (invite.expiresAt.getTime() <= now.getTime()) return 'expired';
  return 'pending';
}

/**
 * The only roles a second-parent invite may target.
 *
 * A single-element list today, and that is the point: the invite never carries a
 * role from the client, so there is nothing to escalate. It carries a *member
 * id*, and the role is whatever that already-existing row says it is — which
 * this predicate then has to agree with. An owner cannot be invited (the owner
 * is the person sending the invite), a child never logs in (§3), and a caregiver
 * reaches the household through a share link with no account at all (§7).
 */
export const INVITABLE_ROLES = ['adult'] as const;

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export function isInvitableRole(role: string): role is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(role);
}
