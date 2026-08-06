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

export { assertCan, getPrincipal } from './principal';

export {
  MEMBER_COLORS,
  MEMBER_ROLES,
  REWARD_HORIZONS,
  family,
  member,
  memberColor,
  memberRole,
  rewardHorizon,
  type Family,
  type Member,
  type MemberColor,
  type MemberRole,
  type RewardHorizon,
} from './schema';

export { getFamily, getMember, getMemberByUserId, listMembers } from './queries';

export { idleState, type ActionState } from './action-state';

export {
  createMemberAction,
  deleteMemberAction,
  signInAction,
  signOutAction,
  signUpAction,
  updateMemberAction,
} from './actions';

export { MemberAvatar } from './ui/member-avatar';
export { MemberDialog } from './ui/member-dialog';
export { MemberList } from './ui/member-list';
export { SignInForm } from './ui/sign-in-form';
export { SignOutButton } from './ui/sign-out-button';
export { SignUpForm } from './ui/sign-up-form';
export { MEMBER_AVATARS, MEMBER_COLOR_CLASSES, avatarUrlFor } from './ui/tokens';
