import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================================================
// Better-Auth Required Tables
// ============================================================================

/**
 * Users table - Core user information
 */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  type: text("type").notNull().default("human"), // 'human' | 'device'
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Sessions table - Active user sessions
 */
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Accounts table - OAuth provider accounts (prepared for Google OAuth)
 */
export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: "date" }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    mode: "date",
  }),
  scope: text("scope"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Verifications table - Required by Better-Auth adapter (unused with Google SSO only)
 */
export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ============================================================================
// Family Management Tables
// ============================================================================

/**
 * Families table - Core household information
 */
export const families = pgTable("families", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Family Members table - User membership in families with roles
 */
export const familyMembers = pgTable("family_members", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'manager' | 'participant' | 'caregiver' | 'device'
  displayName: text("display_name"),
  avatarColor: text("avatar_color"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Family Invites table - Shareable invitation links
 */
export const familyInvites = pgTable("family_invites", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Device Pairing Codes table - Short-lived codes for device pairing
 */
export const devicePairingCodes = pgTable("device_pairing_codes", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  deviceName: text("device_name").notNull(),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Child Upgrade Tokens table - One-time tokens for linking a child to an account
 */
export const childUpgradeTokens = pgTable("child_upgrade_tokens", {
  id: text("id").primaryKey(),
  childUserId: text("child_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  usedAt: timestamp("used_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ============================================================================
// Reward Charts
// ============================================================================

/**
 * Reward Charts table - Per-child reward chart configuration
 */
export const rewardCharts = pgTable("reward_charts", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Reward Chart Tasks table - Recurring tasks on a reward chart
 */
export const rewardChartTasks = pgTable("reward_chart_tasks", {
  id: text("id").primaryKey(),
  chartId: text("chart_id")
    .notNull()
    .references(() => rewardCharts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  icon: text("icon").notNull(),
  iconColor: text("icon_color").notNull(),
  starValue: integer("star_value").notNull().default(1),
  daysOfWeek: text("days_of_week").notNull(), // JSON array: [0,1,2,3,4,5,6]
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Reward Chart Completions table - Daily task completion tracking
 */
export const rewardChartCompletions = pgTable("reward_chart_completions", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => rewardChartTasks.id, { onDelete: "cascade" }),
  date: date("date", { mode: "string" }).notNull(),
  status: text("status").notNull(), // 'completed' | 'missed' | 'skipped'
  completedAt: timestamp("completed_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Reward Chart Goals table - Savings goals for earned stars
 */
export const rewardChartGoals = pgTable("reward_chart_goals", {
  id: text("id").primaryKey(),
  chartId: text("chart_id")
    .notNull()
    .references(() => rewardCharts.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  emoji: text("emoji").notNull(),
  starTarget: integer("star_target").notNull(),
  starsCurrent: integer("stars_current").notNull().default(0),
  status: text("status").notNull().default("active"), // 'active' | 'achieved' | 'cancelled'
  achievedAt: timestamp("achieved_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Reward Chart Messages table - Parent messages to children
 */
export const rewardChartMessages = pgTable("reward_chart_messages", {
  id: text("id").primaryKey(),
  chartId: text("chart_id")
    .notNull()
    .references(() => rewardCharts.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  authorId: text("author_id")
    .notNull()
    .references(() => familyMembers.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ============================================================================
// Chores
// ============================================================================

/**
 * Chores table - Household tasks assigned to family members
 */
export const chores = pgTable("chores", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  assignedToId: text("assigned_to_id").references(() => familyMembers.id, {
    onDelete: "set null",
  }),
  dueDate: date("due_date", { mode: "string" }),
  dueTime: text("due_time"), // HH:mm format
  recurrence: text("recurrence").notNull().default("once"), // once | daily | weekly | weekdays | weekends | monthly
  isUrgent: boolean("is_urgent").notNull().default(false),
  status: text("status").notNull().default("pending"), // pending | completed | skipped
  starReward: integer("star_reward").notNull().default(10),
  completedAt: timestamp("completed_at", { mode: "date" }),
  completedById: text("completed_by_id").references(() => familyMembers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ============================================================================
// Timers
// ============================================================================

/**
 * Timer Templates table - Reusable timer definitions
 */
export const timerTemplates = pgTable("timer_templates", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().default("chore"), // "screen" | "chore" | "activity"
  durationSeconds: integer("duration_seconds").notNull(),
  starReward: integer("star_reward").notNull().default(0),
  controlMode: text("control_mode").notNull().default("anyone"), // "parents_only" | "anyone"
  alertMode: text("alert_mode").notNull().default("completion"), // "none" | "completion" | "escalating"
  cooldownSeconds: integer("cooldown_seconds"), // time to confirm for reward
  showAsQuickAction: boolean("show_as_quick_action").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Active Timers table - Running timer instances
 */
export const activeTimers = pgTable("active_timers", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  templateId: text("template_id").references(() => timerTemplates.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  description: text("description"),
  assignedToId: text("assigned_to_id").references(() => familyMembers.id, {
    onDelete: "set null",
  }),
  category: text("category").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  starReward: integer("star_reward").notNull().default(0),
  alertMode: text("alert_mode").notNull(),
  cooldownSeconds: integer("cooldown_seconds"),
  status: text("status").notNull().default("running"), // "running" | "paused" | "completed" | "expired" | "cancelled"
  remainingSeconds: integer("remaining_seconds").notNull(),
  startedAt: timestamp("started_at", { mode: "date" }).notNull(),
  pausedAt: timestamp("paused_at", { mode: "date" }),
  completedAt: timestamp("completed_at", { mode: "date" }),
  startedById: text("started_by_id").references(() => familyMembers.id, {
    onDelete: "set null",
  }),
  confirmedById: text("confirmed_by_id").references(() => familyMembers.id, {
    onDelete: "set null",
  }),
  ownerDeviceId: text("owner_device_id"),
  lastSyncAt: timestamp("last_sync_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

// ============================================================================
// Star Transactions
// ============================================================================

/**
 * Star Transactions table - Central ledger for all star activity
 */
export const starTransactions = pgTable("star_transactions", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  type: text("type").notNull(), // 'reward_chart' | 'chore' | 'bonus' | 'redemption'
  referenceId: text("reference_id"), // FK to source (taskId, choreId, rewardId)
  description: text("description").notNull(),
  awardedById: text("awarded_by_id").references(() => familyMembers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Member Star Balances table - Cached balance for fast reads
 */
export const memberStarBalances = pgTable("member_star_balances", {
  memberId: text("member_id")
    .primaryKey()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Member Primary Goals table - Tracks each child's current goal
 */
export const memberPrimaryGoals = pgTable("member_primary_goals", {
  memberId: text("member_id")
    .primaryKey()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  rewardId: text("reward_id")
    .notNull()
    .references(() => rewards.id, { onDelete: "cascade" }), // Now has proper FK
  setAt: timestamp("set_at", { mode: "date" }).notNull().defaultNow(),
});

// ============================================================================
// Rewards Store
// ============================================================================

/**
 * Rewards table - Family reward marketplace items
 */
export const rewards = pgTable("rewards", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  emoji: text("emoji").notNull(),
  starCost: integer("star_cost").notNull(),
  limitType: text("limit_type").notNull().default("none"), // 'none' | 'daily' | 'weekly' | 'monthly' | 'once'
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Redemptions table - Records of reward claims
 */
export const redemptions = pgTable("redemptions", {
  id: text("id").primaryKey(),
  rewardId: text("reward_id")
    .notNull()
    .references(() => rewards.id, { onDelete: "cascade" }),
  memberId: text("member_id")
    .notNull()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  starCost: integer("star_cost").notNull(), // Snapshot of cost at redemption time
  redeemedAt: timestamp("redeemed_at", { mode: "date" }).notNull().defaultNow(),
});

// ============================================================================
// Google Calendar Sync Tables
// ============================================================================

/**
 * Google Calendars table - Tracks synced calendars per family
 */
export const googleCalendars = pgTable("google_calendars", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  accountId: text("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "cascade" }),
  googleCalendarId: text("google_calendar_id").notNull(),
  name: text("name").notNull(),
  color: text("color"),
  accessRole: text("access_role").notNull().default("reader"), // 'owner' | 'writer' | 'reader'
  syncEnabled: boolean("sync_enabled").notNull().default(true),
  isPrivate: boolean("is_private").notNull().default(false),
  lastSyncedAt: timestamp("last_synced_at", { mode: "date" }),
  syncCursor: text("sync_cursor"), // Google's sync token for incremental updates
  paginationToken: text("pagination_token"), // Stored pageToken for resuming interrupted syncs
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Google Calendar Webhook Channels table - Tracks active push notification subscriptions
 */
export const googleCalendarChannels = pgTable("google_calendar_channels", {
  id: text("id").primaryKey(), // Our UUID, sent to Google as channel id
  googleCalendarId: text("google_calendar_id")
    .notNull()
    .references(() => googleCalendars.id, { onDelete: "cascade" }),
  resourceId: text("resource_id").notNull(), // Google's resource identifier (from watch response)
  token: text("token").notNull(), // Verification token (X-Goog-Channel-Token)
  expiration: timestamp("expiration", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Events table - Calendar events with Google sync metadata
 */
export const events = pgTable("events", {
  id: text("id").primaryKey(),
  familyId: text("family_id")
    .notNull()
    .references(() => families.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  startTime: timestamp("start_time", { mode: "date" }).notNull(),
  endTime: timestamp("end_time", { mode: "date" }).notNull(),
  allDay: boolean("all_day").notNull().default(false),
  color: text("color"),
  // Google Sync Metadata
  googleCalendarId: text("google_calendar_id").references(
    () => googleCalendars.id,
    { onDelete: "set null" }
  ),
  googleEventId: text("google_event_id"),
  syncStatus: text("sync_status").default("synced"), // 'synced' | 'pending' | 'conflict' | 'error'
  localUpdatedAt: timestamp("local_updated_at", { mode: "date" }),
  remoteUpdatedAt: timestamp("remote_updated_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

/**
 * Event Participants table - Junction table for multi-participant events
 */
export const eventParticipants = pgTable("event_participants", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  familyMemberId: text("family_member_id")
    .notNull()
    .references(() => familyMembers.id, { onDelete: "cascade" }),
  isOwner: boolean("is_owner").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// ============================================================================
// Drizzle Relations
// ============================================================================

export const familiesRelations = relations(families, ({ many }) => ({
  members: many(familyMembers),
  invites: many(familyInvites),
}));

export const familyMembersRelations = relations(
  familyMembers,
  ({ one, many }) => ({
    family: one(families, {
      fields: [familyMembers.familyId],
      references: [families.id],
    }),
    user: one(users, {
      fields: [familyMembers.userId],
      references: [users.id],
    }),
    rewardCharts: many(rewardCharts),
  })
);

export const familyInvitesRelations = relations(familyInvites, ({ one }) => ({
  family: one(families, {
    fields: [familyInvites.familyId],
    references: [families.id],
  }),
  createdBy: one(users, {
    fields: [familyInvites.createdById],
    references: [users.id],
  }),
}));

export const devicePairingCodesRelations = relations(
  devicePairingCodes,
  ({ one }) => ({
    family: one(families, {
      fields: [devicePairingCodes.familyId],
      references: [families.id],
    }),
    createdBy: one(users, {
      fields: [devicePairingCodes.createdById],
      references: [users.id],
    }),
  })
);

export const childUpgradeTokensRelations = relations(
  childUpgradeTokens,
  ({ one }) => ({
    childUser: one(users, {
      fields: [childUpgradeTokens.childUserId],
      references: [users.id],
      relationName: "childUpgradeTokens",
    }),
    createdBy: one(users, {
      fields: [childUpgradeTokens.createdById],
      references: [users.id],
      relationName: "createdUpgradeTokens",
    }),
  })
);

export const googleCalendarsRelations = relations(
  googleCalendars,
  ({ one }) => ({
    family: one(families, {
      fields: [googleCalendars.familyId],
      references: [families.id],
    }),
    account: one(accounts, {
      fields: [googleCalendars.accountId],
      references: [accounts.id],
    }),
  })
);

export const googleCalendarChannelsRelations = relations(
  googleCalendarChannels,
  ({ one }) => ({
    calendar: one(googleCalendars, {
      fields: [googleCalendarChannels.googleCalendarId],
      references: [googleCalendars.id],
    }),
  })
);

export const eventsRelations = relations(events, ({ one, many }) => ({
  family: one(families, {
    fields: [events.familyId],
    references: [families.id],
  }),
  googleCalendar: one(googleCalendars, {
    fields: [events.googleCalendarId],
    references: [googleCalendars.id],
  }),
  participants: many(eventParticipants),
}));

export const eventParticipantsRelations = relations(
  eventParticipants,
  ({ one }) => ({
    event: one(events, {
      fields: [eventParticipants.eventId],
      references: [events.id],
    }),
    familyMember: one(familyMembers, {
      fields: [eventParticipants.familyMemberId],
      references: [familyMembers.id],
    }),
  })
);

export const rewardChartsRelations = relations(
  rewardCharts,
  ({ one, many }) => ({
    family: one(families, {
      fields: [rewardCharts.familyId],
      references: [families.id],
    }),
    member: one(familyMembers, {
      fields: [rewardCharts.memberId],
      references: [familyMembers.id],
    }),
    tasks: many(rewardChartTasks),
    goals: many(rewardChartGoals),
    messages: many(rewardChartMessages),
  })
);

export const rewardChartTasksRelations = relations(
  rewardChartTasks,
  ({ one, many }) => ({
    chart: one(rewardCharts, {
      fields: [rewardChartTasks.chartId],
      references: [rewardCharts.id],
    }),
    completions: many(rewardChartCompletions),
  })
);

export const rewardChartCompletionsRelations = relations(
  rewardChartCompletions,
  ({ one }) => ({
    task: one(rewardChartTasks, {
      fields: [rewardChartCompletions.taskId],
      references: [rewardChartTasks.id],
    }),
  })
);

export const rewardChartGoalsRelations = relations(
  rewardChartGoals,
  ({ one }) => ({
    chart: one(rewardCharts, {
      fields: [rewardChartGoals.chartId],
      references: [rewardCharts.id],
    }),
  })
);

export const rewardChartMessagesRelations = relations(
  rewardChartMessages,
  ({ one }) => ({
    chart: one(rewardCharts, {
      fields: [rewardChartMessages.chartId],
      references: [rewardCharts.id],
    }),
    author: one(familyMembers, {
      fields: [rewardChartMessages.authorId],
      references: [familyMembers.id],
    }),
  })
);

export const choresRelations = relations(chores, ({ one }) => ({
  family: one(families, {
    fields: [chores.familyId],
    references: [families.id],
  }),
  assignedTo: one(familyMembers, {
    fields: [chores.assignedToId],
    references: [familyMembers.id],
    relationName: "assignedChores",
  }),
  completedBy: one(familyMembers, {
    fields: [chores.completedById],
    references: [familyMembers.id],
    relationName: "completedChores",
  }),
}));

export const timerTemplatesRelations = relations(timerTemplates, ({ one }) => ({
  family: one(families, {
    fields: [timerTemplates.familyId],
    references: [families.id],
  }),
}));

export const activeTimersRelations = relations(activeTimers, ({ one }) => ({
  family: one(families, {
    fields: [activeTimers.familyId],
    references: [families.id],
  }),
  template: one(timerTemplates, {
    fields: [activeTimers.templateId],
    references: [timerTemplates.id],
  }),
  assignedTo: one(familyMembers, {
    fields: [activeTimers.assignedToId],
    references: [familyMembers.id],
    relationName: "assignedTimers",
  }),
  startedBy: one(familyMembers, {
    fields: [activeTimers.startedById],
    references: [familyMembers.id],
    relationName: "startedTimers",
  }),
  confirmedBy: one(familyMembers, {
    fields: [activeTimers.confirmedById],
    references: [familyMembers.id],
    relationName: "confirmedTimers",
  }),
}));

export const starTransactionsRelations = relations(
  starTransactions,
  ({ one }) => ({
    family: one(families, {
      fields: [starTransactions.familyId],
      references: [families.id],
    }),
    member: one(familyMembers, {
      fields: [starTransactions.memberId],
      references: [familyMembers.id],
    }),
    awardedBy: one(familyMembers, {
      fields: [starTransactions.awardedById],
      references: [familyMembers.id],
    }),
  })
);

export const memberStarBalancesRelations = relations(
  memberStarBalances,
  ({ one }) => ({
    member: one(familyMembers, {
      fields: [memberStarBalances.memberId],
      references: [familyMembers.id],
    }),
  })
);

export const memberPrimaryGoalsRelations = relations(
  memberPrimaryGoals,
  ({ one }) => ({
    member: one(familyMembers, {
      fields: [memberPrimaryGoals.memberId],
      references: [familyMembers.id],
    }),
    reward: one(rewards, {
      fields: [memberPrimaryGoals.rewardId],
      references: [rewards.id],
    }),
  })
);

export const rewardsRelations = relations(rewards, ({ one, many }) => ({
  family: one(families, {
    fields: [rewards.familyId],
    references: [families.id],
  }),
  redemptions: many(redemptions),
}));

export const redemptionsRelations = relations(redemptions, ({ one }) => ({
  reward: one(rewards, {
    fields: [redemptions.rewardId],
    references: [rewards.id],
  }),
  member: one(familyMembers, {
    fields: [redemptions.memberId],
    references: [familyMembers.id],
  }),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Family = typeof families.$inferSelect;
export type NewFamily = typeof families.$inferInsert;
export type FamilyMember = typeof familyMembers.$inferSelect;
export type NewFamilyMember = typeof familyMembers.$inferInsert;
export type FamilyInvite = typeof familyInvites.$inferSelect;
export type NewFamilyInvite = typeof familyInvites.$inferInsert;
export type DevicePairingCode = typeof devicePairingCodes.$inferSelect;
export type NewDevicePairingCode = typeof devicePairingCodes.$inferInsert;
export type ChildUpgradeToken = typeof childUpgradeTokens.$inferSelect;
export type NewChildUpgradeToken = typeof childUpgradeTokens.$inferInsert;
export type GoogleCalendar = typeof googleCalendars.$inferSelect;
export type NewGoogleCalendar = typeof googleCalendars.$inferInsert;
export type GoogleCalendarChannel = typeof googleCalendarChannels.$inferSelect;
export type NewGoogleCalendarChannel =
  typeof googleCalendarChannels.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventParticipant = typeof eventParticipants.$inferSelect;
export type NewEventParticipant = typeof eventParticipants.$inferInsert;
export type RewardChart = typeof rewardCharts.$inferSelect;
export type NewRewardChart = typeof rewardCharts.$inferInsert;
export type RewardChartTask = typeof rewardChartTasks.$inferSelect;
export type NewRewardChartTask = typeof rewardChartTasks.$inferInsert;
export type RewardChartCompletion = typeof rewardChartCompletions.$inferSelect;
export type NewRewardChartCompletion =
  typeof rewardChartCompletions.$inferInsert;
export type RewardChartGoal = typeof rewardChartGoals.$inferSelect;
export type NewRewardChartGoal = typeof rewardChartGoals.$inferInsert;
export type RewardChartMessage = typeof rewardChartMessages.$inferSelect;
export type NewRewardChartMessage = typeof rewardChartMessages.$inferInsert;
export type Chore = typeof chores.$inferSelect;
export type NewChore = typeof chores.$inferInsert;
export type StarTransaction = typeof starTransactions.$inferSelect;
export type NewStarTransaction = typeof starTransactions.$inferInsert;
export type MemberStarBalance = typeof memberStarBalances.$inferSelect;
export type NewMemberStarBalance = typeof memberStarBalances.$inferInsert;
export type MemberPrimaryGoal = typeof memberPrimaryGoals.$inferSelect;
export type NewMemberPrimaryGoal = typeof memberPrimaryGoals.$inferInsert;
export type Reward = typeof rewards.$inferSelect;
export type NewReward = typeof rewards.$inferInsert;
export type Redemption = typeof redemptions.$inferSelect;
export type NewRedemption = typeof redemptions.$inferInsert;
export type TimerTemplate = typeof timerTemplates.$inferSelect;
export type NewTimerTemplate = typeof timerTemplates.$inferInsert;
export type ActiveTimer = typeof activeTimers.$inferSelect;
export type NewActiveTimer = typeof activeTimers.$inferInsert;
