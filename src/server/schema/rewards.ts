import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { families, familyMembers } from "./families";

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
// Drizzle Relations
// ============================================================================

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

export type Reward = typeof rewards.$inferSelect;
export type NewReward = typeof rewards.$inferInsert;
export type Redemption = typeof redemptions.$inferSelect;
export type NewRedemption = typeof redemptions.$inferInsert;
