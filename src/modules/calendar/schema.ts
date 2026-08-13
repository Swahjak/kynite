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
 * What an event *is*, in the vocabulary a family actually uses (M23).
 *
 * The first cut of this enum was a shape a developer recognises —
 * `appointment`, `routine`, `reward` — which is a statement about where a row
 * came from rather than about what is happening. A parent scanning the wall at
 * 07:45 is not looking for "an appointment"; they are looking for gym kit,
 * a dentist, or the day somebody is turning seven.
 *
 * So the eleven values below are the owner-approved taxonomy, and they are the
 * *only* dimension that colours an event anywhere in the app: type carries the
 * hue and the glyph (`domain/event-type.ts`), member colour carries identity
 * and nothing else, and a calendar's own colour is demoted to a dot in
 * settings. One fact, one cue — the reason the per-event colour override and
 * the per-calendar colour that used to compete with it are gone.
 */
export const eventType = pgEnum('event_type', [
  'school',
  'childcare',
  'sport',
  'music',
  'play',
  'health',
  'family',
  'birthday',
  'holiday',
  'work',
  'other',
]);

/**
 * The eight design-system category colors (src/app/globals.css) — the palette
 * itself, not a per-row choice.
 *
 * It was a column on `event` until M23, one of three competing colour sources
 * (per-event override, per-calendar choice, Google's own hex). The taxonomy
 * above replaced all three: the hue of an event is a function of its type, so
 * nothing writes a colour any more. The enum survives as the *type* of a hue —
 * `domain/event-type.ts` maps into it, and the tokens table keys off it.
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
    eventType: eventType('event_type').notNull().default('other'),
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
     * Null for a native override, where the parent's EXDATE already covers the
     * slot. A row imported before this column existed is also null until the
     * sync engine backfills it (`needsExceptionBackfill`), and a null subtracts
     * nothing — guessing the slot from the child's own start would delete a
     * legitimate occurrence whenever the override was *moved* onto one.
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

export type Event = typeof event.$inferSelect;
export type EventType = (typeof eventType.enumValues)[number];
export type EventCategory = (typeof eventCategory.enumValues)[number];

export const EVENT_TYPES = eventType.enumValues;
export const EVENT_CATEGORIES = eventCategory.enumValues;
