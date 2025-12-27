import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { families, familyMembers } from "./families";
import { rewards } from "./rewards";

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
    .references(() => rewards.id, { onDelete: "cascade" }),
  setAt: timestamp("set_at", { mode: "date" }).notNull().defaultNow(),
});

// ============================================================================
// Drizzle Relations
// ============================================================================

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

// ============================================================================
// Type Exports
// ============================================================================

export type StarTransaction = typeof starTransactions.$inferSelect;
export type NewStarTransaction = typeof starTransactions.$inferInsert;
export type MemberStarBalance = typeof memberStarBalances.$inferSelect;
export type NewMemberStarBalance = typeof memberStarBalances.$inferInsert;
export type MemberPrimaryGoal = typeof memberPrimaryGoals.$inferSelect;
export type NewMemberPrimaryGoal = typeof memberPrimaryGoals.$inferInsert;
