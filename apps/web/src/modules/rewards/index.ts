/**
 * Public surface of the rewards slice (docs/architecture.md §2).
 * Cross-module imports go through this file only.
 *
 * Like the calendar and routines barrels, this re-exports the slice's *client*
 * components alongside `server-only` reads: fine for a route file, fatal for
 * another slice's server module. Anything that needs only tables takes them
 * from `@/server/db/schema`; anything that needs only pure logic deep-imports
 * `domain/` (the sanctioned exception in `eslint.config.mjs`).
 */

export {
  REDEMPTION_STATUSES,
  REWARD_CATEGORIES,
  SPENDING_REDEMPTION_STATUSES,
  redemption,
  redemptionStatus,
  reward,
  rewardCategory,
  type Redemption,
  type RedemptionStatus,
  type Reward,
  type RewardCategory,
} from './schema';

export {
  REWARD_PRESETS,
  canAfford,
  rewardStateOf,
  savingsGoalOf,
  starTotals,
  starsShort,
  type Goal,
  type GoalCandidate,
  type RewardPreset,
  type RewardState,
  type StarTotals,
} from './domain/economy';

export {
  REDEMPTION_DECISIONS,
  REDEMPTION_TRANSITIONS,
  canTransition,
  isGrantable,
  isOpen,
  isTerminal,
  redemptionSeed,
  spendsStars,
  statusForDecision,
  type RedemptionDecision,
} from './domain/redemption';

export {
  getReward,
  getStarTotals,
  listRedemptions,
  listRewards,
  listStarHistory,
  listStarsEarnedSince,
  listStarTotals,
  starsPerDay,
  type RedemptionWithReward,
  type StarEntry,
} from './queries';

export {
  idleState,
  redemptionFailure,
  type ActionState,
  type RedemptionState,
} from './action-state';

export {
  awardStarsAction,
  createRewardAction,
  decideRedemptionAction,
  deleteRewardAction,
  fulfillRedemptionAction,
  requestRedemptionAction,
  seedRewardPresetsAction,
  updateRewardAction,
  type RequestRedemptionInput,
} from './actions';

export {
  loadRewardsPage,
  loadStarChart,
  loadStore,
  type GraduatedRoutine,
  type RewardsPageData,
  type StarChartData,
  type StarChartOptions,
  type StoreChip,
  type StoreData,
  type StoreOptions,
  type StoreTile,
  type WeekBar,
} from './page-data';

export { ApprovalQueue } from './ui/approval-queue';
export { AwardStarsDialog } from './ui/award-stars-dialog';
export { DeleteRewardButton } from './ui/delete-reward-button';
export { RewardCard, type RewardCardCopy, type RewardCardProps } from './ui/reward-card';
export { RewardDialog } from './ui/reward-dialog';
export { RewardList } from './ui/reward-list';
export { RewardStore } from './ui/reward-store';
export { SavingsGoalCard } from './ui/savings-goal-card';
export { SeedPresetsButton } from './ui/seed-presets-button';
export { StarChart } from './ui/star-chart';
export {
  CATEGORY_TILE,
  DEFAULT_REWARD_ICON,
  REWARD_ICONS,
  REWARD_TILE_MIN_HEIGHT,
  isRewardIcon,
  rewardIconOf,
  type RewardIcon,
} from './ui/tokens';
