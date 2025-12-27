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
// Drizzle Relations
// ============================================================================

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

// ============================================================================
// Type Exports
// ============================================================================

export type TimerTemplate = typeof timerTemplates.$inferSelect;
export type NewTimerTemplate = typeof timerTemplates.$inferInsert;
export type ActiveTimer = typeof activeTimers.$inferSelect;
export type NewActiveTimer = typeof activeTimers.$inferInsert;
