import {
  pgTable,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./auth";

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
export const familyMembers = pgTable(
  "family_members",
  {
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
    avatarSvg: text("avatar_svg"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("family_members_user_id_unique").on(table.userId)]
);

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
export const childUpgradeTokens = pgTable(
  "child_upgrade_tokens",
  {
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
  },
  (table) => [
    index("child_upgrade_tokens_child_user_id_idx").on(table.childUserId),
  ]
);

// ============================================================================
// Drizzle Relations
// ============================================================================

export const familiesRelations = relations(families, ({ many }) => ({
  members: many(familyMembers),
  invites: many(familyInvites),
}));

export const familyMembersRelations = relations(familyMembers, ({ one }) => ({
  family: one(families, {
    fields: [familyMembers.familyId],
    references: [families.id],
  }),
  user: one(users, {
    fields: [familyMembers.userId],
    references: [users.id],
  }),
}));

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

// ============================================================================
// Type Exports
// ============================================================================

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
