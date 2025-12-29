import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { accounts } from "./auth";
import { families, familyMembers } from "./families";

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
  eventType: text("event_type"), // 'default' | 'birthday' | 'fromGmail' | null for manual events
  color: text("color"),
  category: text("category"), // 'sports' | 'work' | 'school' | 'family' | 'social' | 'home'
  isCompleted: boolean("is_completed").notNull().default(false),
  // Google Sync Metadata
  googleCalendarId: text("google_calendar_id").references(
    () => googleCalendars.id,
    { onDelete: "cascade" }
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

// ============================================================================
// Type Exports
// ============================================================================

export type GoogleCalendar = typeof googleCalendars.$inferSelect;
export type NewGoogleCalendar = typeof googleCalendars.$inferInsert;
export type GoogleCalendarChannel = typeof googleCalendarChannels.$inferSelect;
export type NewGoogleCalendarChannel =
  typeof googleCalendarChannels.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventParticipant = typeof eventParticipants.$inferSelect;
export type NewEventParticipant = typeof eventParticipants.$inferInsert;
