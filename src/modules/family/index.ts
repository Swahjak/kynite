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
  HUB_VIEWS,
  MEMBER_COLORS,
  MEMBER_ROLES,
  REWARD_HORIZONS,
  family,
  formerMember,
  member,
  memberColor,
  memberInvite,
  memberRole,
  rewardHorizon,
  type Family,
  type FormerMember,
  type HubView,
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

export {
  AFTERNOON_FROM_HOUR,
  EVENING_FROM_HOUR,
  firstNameOf,
  greetingSlotFor,
  hourIn,
  type GreetingSlot,
} from './domain/greeting';

export { getFamily, getMember, getMemberByUserId, hasEverBeenMember, listMembers } from './queries';

export {
  loadFamilyPage,
  loadFamilySettings,
  type FamilyPageData,
  type FamilySettingsData,
} from './page-data';

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
  createFamilyForSocialUserAction,
  createInviteAction,
  createMemberAction,
  deleteFamilyAction,
  deleteMemberAction,
  revokeInviteAction,
  setHubDisplayAction,
  signInAction,
  signInWithGoogleAction,
  signOutAction,
  signUpAction,
  updateFamilyAction,
  updateMemberAction,
} from './actions';

export { CreateFamilyForm } from './ui/create-family-form';
export { DeleteFamilyForm } from './ui/delete-family-form';
export { FamilySettingsForm } from './ui/family-settings-form';
export { HubDisplayForm } from './ui/hub-display-form';
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
