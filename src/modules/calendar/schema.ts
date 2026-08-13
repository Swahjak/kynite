import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from '@/server/db/columns';
import { family, member } from '@/modules/family/schema';
import { calendar } from '@/modules/google/schema';

/** docs/architecture.md §3 "Calendar events". */

/**
 * §3 lists `'appointment'|'custody'|'reward'|…`; the tail is filled in here.
 * `custody` is first-class because the custody-week recurrence patterns (FR5)
 * are the reason the recurrence model is stored verbatim rather than expanded.
 */
export const eventType = pgEnum('event_type', [
  'appointment',
  'custody',
  'reward',
  'routine',
  'birthday',
  'other',
]);

/**
 * The eight design-system category colors (src/app/globals.css), as the
 * *visual* dimension of an event. Deliberately its own enum rather than a
 * reuse of `member_color`: a member's color is their identity across every
 * surface, an event's category is a property of the event, and the day one of
 * the two palettes gains a value the other must not follow.
 *
 * Nullable on purpose — an event with no category inherits its calendar's
 * color (`modules/calendar/domain/category.ts`), so a synced Google event does
 * not need a per-row decision before it can render.
 */
export const eventCategory = pgEnum('event_category', [
  'blue',
  'purple',
  'orange',
  'green',
  'red',
  'yellow',
  'pink',
  'teal',
]);

/**
 * An occurrence *series*, not an instance: RRULE + RDATE/EXDATE are stored
 * verbatim as RFC-5545 strings and expanded on read against a cached view
 * window. Rationale (§3): it round-trips Google losslessly and it is the only
 * model that expresses custody weeks. A single edited instance becomes a child
 * row via `recurrenceParentId` plus an EXDATE on the parent — the same shape
 * Google uses, so sync stays a passthrough.
 */
export const event = pgTable(
  'event',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    /** Null = a Kynite-native event that lives in no Google calendar. */
    calendarId: uuid('calendar_id').references(() => calendar.id, { onDelete: 'cascade' }),
    googleEventId: text('google_event_id'),
    title: text('title').notNull(),
    description: text('description'),
    location: text('location'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    allDay: boolean('all_day').notNull().default(false),
    /** The *original* zone, so recurrence expansion stays DST-safe. */
    tz: text('tz').notNull().default('Europe/Amsterdam'),
    /** Ownership routes reminders; null = a household-wide event. */
    ownerMemberId: uuid('owner_member_id').references(() => member.id, { onDelete: 'set null' }),
    attendeeMemberIds: uuid('attendee_member_ids').array().notNull().default([]),
    eventType: eventType('event_type').notNull().default('appointment'),
    /** Per-event override of the calendar's color; null = inherit (M06). */
    category: eventCategory('category'),
    rrule: text('rrule'),
    rdates: text('rdates').array().notNull().default([]),
    exdates: text('exdates').array().notNull().default([]),
    /** Override instance → its series parent. Dies with the parent. */
    recurrenceParentId: uuid('recurrence_parent_id').references((): AnyPgColumn => event.id, {
      onDelete: 'cascade',
    }),
    /**
     * The slot an override instance *replaces* — Google's `originalStartTime`.
     *
     * A Kynite-authored "this occurrence only" edit writes an EXDATE onto the
     * parent (see `modules/calendar/actions.ts`), so the parent stops
     * generating that instant. Google does **not**: it leaves the master's
     * recurrence untouched and expresses the exception as a separate instance
     * resource. Without this column an imported override was therefore stored
     * as a child row while its parent kept generating the very slot the child
     * replaces — the "every recurring event shows twice" duplicate.
     *
     * Null for a native override (the parent's EXDATE already covers it) and
     * for rows imported before this column existed; `listEvents` falls back to
     * the child's own start for those.
     */
    recurrenceOriginalStart: timestamp('recurrence_original_start', { withTimezone: true }),
    /** Last-write-wins inputs: our `If-Match` token and Google's `updated`. */
    etag: text('etag'),
    updatedAtRemote: timestamp('updated_at_remote', { withTimezone: true }),
    /** Soft delete = a Google tombstone; the row stays so sync can echo it. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    /** Bumped on every write; carried in the realtime payload for reconciliation. */
    version: integer('version').notNull().default(0),
    /**
     * Set when a push to Google failed and the retry job owns the write
     * (docs/architecture.md §5 "Write path"); cleared on the next success.
     * A nullable timestamp rather than a boolean: "since when" is the only
     * extra fact the pip could ever want, and it comes free.
     */
    pendingSyncAt: timestamp('pending_sync_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    // The one index every calendar read uses: a family's window of time.
    index('event_family_starts_at_idx').on(table.familyId, table.startsAt),
    // Sync identity: one row per Google event per calendar.
    uniqueIndex('event_calendar_google_event_unique').on(table.calendarId, table.googleEventId),
    index('event_recurrence_parent_id_idx').on(table.recurrenceParentId),
    index('event_owner_member_id_idx').on(table.ownerMemberId),
  ]
);

/**
 * Per-calendar display preferences (PRD FR28, M16).
 *
 * A *separate* table rather than a column on `calendar`, for one structural
 * reason: `calendar` is owned by the google slice, whose `schema.ts` this file
 * already imports for the foreign key. Putting an `event_category` column
 * there would mean google importing this file back for the enum — a module
 * cycle between two `pgTable` modules, which drizzle evaluates at import time
 * and would leave one side holding `undefined`. The category dimension belongs
 * to the calendar slice anyway (`domain/category.ts` is what resolves it), so
 * the row lives with the code that reads it.
 *
 * Null `category` means "keep deriving from Google's own colour" — the same
 * inherit-by-default rule `event.category` follows, one level up. A calendar a
 * parent has never recoloured therefore has no row at all, and a sync that
 * changes Google's colour still moves it.
 */
export const calendarDisplay = pgTable(
  'calendar_display',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    calendarId: uuid('calendar_id')
      .notNull()
      .references(() => calendar.id, { onDelete: 'cascade' }),
    /** The parent's colour choice; null = inherit Google's. */
    category: eventCategory('category'),
    ...timestamps,
  },
  (table) => [
    // One preference row per calendar: the upsert's conflict target.
    uniqueIndex('calendar_display_calendar_unique').on(table.calendarId),
    index('calendar_display_family_id_idx').on(table.familyId),
  ]
);

export type Event = typeof event.$inferSelect;
export type CalendarDisplay = typeof calendarDisplay.$inferSelect;
export type EventType = (typeof eventType.enumValues)[number];
export type EventCategory = (typeof eventCategory.enumValues)[number];

export const EVENT_TYPES = eventType.enumValues;
export const EVENT_CATEGORIES = eventCategory.enumValues;
