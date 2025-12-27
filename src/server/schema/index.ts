// ============================================================================
// Barrel Export - All schema modules
// ============================================================================

// Auth (Better-Auth tables)
export {
  users,
  sessions,
  accounts,
  verifications,
  type User,
  type NewUser,
  type Session,
  type NewSession,
  type Account,
  type NewAccount,
  type Verification,
  type NewVerification,
} from "./auth";

// Families
export {
  families,
  familyMembers,
  familyInvites,
  devicePairingCodes,
  childUpgradeTokens,
  familiesRelations,
  familyMembersRelations,
  familyInvitesRelations,
  devicePairingCodesRelations,
  childUpgradeTokensRelations,
  type Family,
  type NewFamily,
  type FamilyMember,
  type NewFamilyMember,
  type FamilyInvite,
  type NewFamilyInvite,
  type DevicePairingCode,
  type NewDevicePairingCode,
  type ChildUpgradeToken,
  type NewChildUpgradeToken,
} from "./families";

// Calendars
export {
  googleCalendars,
  googleCalendarChannels,
  events,
  eventParticipants,
  googleCalendarsRelations,
  googleCalendarChannelsRelations,
  eventsRelations,
  eventParticipantsRelations,
  type GoogleCalendar,
  type NewGoogleCalendar,
  type GoogleCalendarChannel,
  type NewGoogleCalendarChannel,
  type Event,
  type NewEvent,
  type EventParticipant,
  type NewEventParticipant,
} from "./calendars";

// Reward Charts
export {
  rewardCharts,
  rewardChartTasks,
  rewardChartCompletions,
  rewardChartGoals,
  rewardChartMessages,
  rewardChartsRelations,
  rewardChartTasksRelations,
  rewardChartCompletionsRelations,
  rewardChartGoalsRelations,
  rewardChartMessagesRelations,
  type RewardChart,
  type NewRewardChart,
  type RewardChartTask,
  type NewRewardChartTask,
  type RewardChartCompletion,
  type NewRewardChartCompletion,
  type RewardChartGoal,
  type NewRewardChartGoal,
  type RewardChartMessage,
  type NewRewardChartMessage,
} from "./reward-charts";

// Chores
export { chores, choresRelations, type Chore, type NewChore } from "./chores";

// Timers
export {
  timerTemplates,
  activeTimers,
  timerTemplatesRelations,
  activeTimersRelations,
  type TimerTemplate,
  type NewTimerTemplate,
  type ActiveTimer,
  type NewActiveTimer,
} from "./timers";

// Stars
export {
  starTransactions,
  memberStarBalances,
  memberPrimaryGoals,
  starTransactionsRelations,
  memberStarBalancesRelations,
  memberPrimaryGoalsRelations,
  type StarTransaction,
  type NewStarTransaction,
  type MemberStarBalance,
  type NewMemberStarBalance,
  type MemberPrimaryGoal,
  type NewMemberPrimaryGoal,
} from "./stars";

// Rewards
export {
  rewards,
  redemptions,
  rewardsRelations,
  redemptionsRelations,
  type Reward,
  type NewReward,
  type Redemption,
  type NewRedemption,
} from "./rewards";
