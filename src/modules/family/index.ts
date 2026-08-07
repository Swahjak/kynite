/**
 * Public surface of the family slice (docs/architecture.md §2).
 * Cross-module imports go through this file only.
 */

export {
  CAPABILITIES,
  ForbiddenError,
  can,
  canOwn,
  decide,
  grade,
  type Capability,
  type Grade,
  type Principal,
  type Resource,
  type ShareRole,
  type ShareScope,
} from './authorize';

export { assertCan, getPrincipal, requireDevicePrincipal } from './principal';

export {
  MEMBER_COLORS,
  MEMBER_ROLES,
  REWARD_HORIZONS,
  family,
  member,
  memberColor,
  memberInvite,
  memberRole,
  rewardHorizon,
  type Family,
  type Member,
  type MemberColor,
  type MemberInvite,
  type MemberRole,
  type RewardHorizon,
} from './schema';

export {
  INVITABLE_ROLES,
  inviteStateOf,
  isInvitableRole,
  type InvitableRole,
  type InviteState,
} from './domain/invite';

export { getFamily, getMember, getMemberByUserId, listMembers } from './queries';

export { loadFamilyPage, type FamilyPageData } from './page-data';

export {
  findLiveInvite,
  listInvites,
  resolveInvite,
  type InviteWithMember,
  type MintedInvite,
} from './invites';

export {
  createInviteIdle,
  idleState,
  type ActionState,
  type CreateInviteState,
} from './action-state';

export {
  acceptInviteAction,
  chooseProfileAction,
  createInviteAction,
  createMemberAction,
  deleteMemberAction,
  revokeInviteAction,
  signInAction,
  signOutAction,
  signUpAction,
  updateMemberAction,
} from './actions';

export { MemberAvatar } from './ui/member-avatar';
export { MemberDialog } from './ui/member-dialog';
export { MemberInvite as MemberInviteControl, type MemberInviteView } from './ui/member-invite';
export { MemberList } from './ui/member-list';
export { InviteGone } from './ui/invite-gone';
export { InviteAcceptStep, InviteGoogleStep, InviteProfileStep } from './ui/invite-steps';
export { SignInForm } from './ui/sign-in-form';
export { SignOutButton } from './ui/sign-out-button';
export { SignUpForm } from './ui/sign-up-form';
export { MEMBER_AVATARS, MEMBER_COLOR_CLASSES, avatarUrlFor, initialsOf } from './ui/tokens';
