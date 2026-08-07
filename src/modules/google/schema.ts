import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from '@/server/db/columns';
import { family, member } from '@/modules/family/schema';

/** docs/architecture.md §3 "Devices & Google". */

export const googleAccountStatus = pgEnum('google_account_status', ['active', 'reauth_required']);

/** `private` calendars render busy-only on the hub (§3, §7 `calendar:view_private`). */
export const calendarVisibility = pgEnum('calendar_visibility', ['family', 'private']);

/**
 * A linked Google identity. Multiple per family (both parents), each owned by a
 * member — `google:link` grades `own` for an adult, so ownership is the
 * authorization input, not a convenience column.
 *
 * `accessToken`/`refreshToken` hold AES-GCM ciphertext with a versioned prefix
 * (M05); the column type is text because that is what a ciphertext string is.
 */
export const googleAccount = pgTable(
  'google_account',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    ownerMemberId: uuid('owner_member_id')
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    googleUserId: text('google_user_id').notNull(),
    email: text('email').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    scopes: text('scopes').array().notNull().default([]),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    status: googleAccountStatus('status').notNull().default('active'),
    ...timestamps,
  },
  (table) => [
    // Composite, not global: the same Google identity can link into more than
    // one family (divorced-parent persona), but only once per family.
    uniqueIndex('google_account_family_google_user_unique').on(table.familyId, table.googleUserId),
    index('google_account_family_id_idx').on(table.familyId),
  ]
);

/**
 * One row per Google calendar we discovered. Holds the incremental cursor
 * (`syncToken`) and the push channel registration, so a renewal job can find
 * every channel expiring soon with one predicate.
 */
export const calendar = pgTable(
  'calendar',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    googleAccountId: uuid('google_account_id')
      .notNull()
      .references(() => googleAccount.id, { onDelete: 'cascade' }),
    googleCalendarId: text('google_calendar_id').notNull(),
    summary: text('summary').notNull(),
    color: text('color'),
    /**
     * The calendar's own IANA zone, as Google reports it. It is the fallback
     * `fromGoogleEvent()` uses for an event that carries no zone of its own —
     * all-day events usually do not, and defaulting those to Europe/Amsterdam
     * silently mis-places a family whose calendar lives anywhere else (M05
     * carry-forward). Null until a discovery pass has seen the calendar.
     */
    timeZone: text('time_zone'),
    visibility: calendarVisibility('visibility').notNull().default('family'),
    writable: boolean('writable').notNull().default(false),
    /**
     * Google's `primary` flag from the calendar list — "this is the account
     * holder's own calendar", exactly one per account.
     *
     * It is persisted rather than derived because attribution keys off it
     * (M18): the account owner is a participant of everything on *their own*
     * calendar, and of nothing on the subscriptions and colleagues' diaries
     * that hang off the same account. Without the distinction, "Nederlandse
     * feestdagen" put a national holiday in one parent's person column every
     * single time.
     */
    isPrimary: boolean('is_primary').notNull().default(false),
    syncEnabled: boolean('sync_enabled').notNull().default(true),
    /** Google's incremental cursor; null forces the next sync to be a full one. */
    syncToken: text('sync_token'),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    channelId: text('channel_id'),
    channelResourceId: text('channel_resource_id'),
    channelExpiration: timestamp('channel_expiration', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('calendar_google_account_calendar_unique').on(
      table.googleAccountId,
      table.googleCalendarId
    ),
    index('calendar_family_id_idx').on(table.familyId),
    // The renewal job's predicate: channels expiring within the hour.
    index('calendar_channel_expiration_idx').on(table.channelExpiration),
  ]
);

export type GoogleAccount = typeof googleAccount.$inferSelect;
export type Calendar = typeof calendar.$inferSelect;
export type GoogleAccountStatus = (typeof googleAccountStatus.enumValues)[number];
export type CalendarVisibility = (typeof calendarVisibility.enumValues)[number];

export const GOOGLE_ACCOUNT_STATUSES = googleAccountStatus.enumValues;
export const CALENDAR_VISIBILITIES = calendarVisibility.enumValues;
