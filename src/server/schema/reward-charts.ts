import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { families, familyMembers } from "./families";

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
// Drizzle Relations
// ============================================================================

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

// ============================================================================
// Type Exports
// ============================================================================

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
