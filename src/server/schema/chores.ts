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
// Drizzle Relations
// ============================================================================

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

// ============================================================================
// Type Exports
// ============================================================================

export type Chore = typeof chores.$inferSelect;
export type NewChore = typeof chores.$inferInsert;
