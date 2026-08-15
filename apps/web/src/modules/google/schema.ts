import {
  boolean,
  type AnyPgColumn,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from '@/server/db/columns';
import { eventType } from '@/server/db/enums';
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
    /**
     * Null for the household's own "Gezin" calendar (M23), which is the one
     * calendar row that came from us rather than from Google. Everything else
     * about a calendar — its events, its colour, its default type, its place
     * in the settings list — is the same whether Google is behind it or not,
     * which is why it is this table rather than a second one.
     */
    googleAccountId: uuid('google_account_id').references(() => googleAccount.id, {
      onDelete: 'cascade',
    }),
    /** Null for the same reason, and for the same row. */
    googleCalendarId: text('google_calendar_id'),
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
     * It is persisted rather than derived because it is one of the two inputs
     * `ownerMemberId` below is computed from, and because a calendar list pass
     * is the only place it can be observed.
     */
    isPrimary: boolean('is_primary').notNull().default(false),
    /**
     * The member whose calendar this *is* — the attribution target for every
     * event on it that names no family member of its own (M23).
     *
     * It exists because `isPrimary` was doing this job and could not. The rule
     * it encoded — "the account owner participates in everything on their
     * primary calendar, and in nothing else on the account" — is right about
     * subscriptions ("Nederlandse feestdagen") and colleagues' diaries and
     * wrong about the case a second parent hits on day one: a *secondary*
     * calendar they created themselves, "Werk", whose events therefore landed
     * attributed to nobody and rendered in the shared "Iedereen" block instead
     * of in their own column.
     *
     * Discovery fills it from Google's own answer to "is this person's own
     * calendar": `primary`, or `accessRole: 'owner'` — which is true of every
     * calendar the account holder created and false for everything they merely
     * subscribed to or were granted access on. Null means "attribute from the
     * event's own organizer/attendees only", which is what a holiday feed and
     * a colleague's diary deserve.
     */
    ownerMemberId: uuid('owner_member_id').references(() => member.id, { onDelete: 'set null' }),
    /**
     * The type every event on this calendar inherits when it has none of its
     * own (M23).
     *
     * This is what makes the taxonomy survive contact with Google. A synced
     * event carries no type — there is no such field in the API — so without a
     * per-calendar answer, a household that links "Schoolagenda Mila" and
     * "Sportclub" gets two hundred identical purple "Overig" rows and the
     * eleven categories exist only for the handful of events somebody typed by
     * hand. One choice per calendar, made once in settings, types all of them.
     *
     * `other` by default, including for a newly linked calendar: Overig is the
     * honest answer until a parent gives a better one, and it is a dropdown in
     * the calendars list away.
     */
    defaultType: eventType('default_type').notNull().default('other'),
    /**
     * The household's built-in calendar: exactly one per family, created with
     * the family and never deletable or hideable (M23).
     *
     * It exists to give "this is for all of us" a home. Before it, a family
     * dinner was an event with no owner and no attendees — shared by accident,
     * because nothing claimed it — and there was nowhere to *put* one on
     * purpose. Events on this calendar are household-wide by construction:
     * every board treats them as everyone's, whatever attribution says.
     */
    isHousehold: boolean('is_household').notNull().default(false),
    /**
     * The Google calendar this household calendar is *bound to*, if the owner
     * has bound one (M23). Null = a plain native Kynite calendar.
     *
     * A pointer rather than a merge, and that is the whole design. The bound
     * calendar keeps its own row, its own sync token, its own channel and its
     * own events, so the sync engine is untouched: reads come through the
     * existing pass and writes go out through the existing push. All this
     * column changes is *meaning* — events on the target read as the
     * household's rather than as one member's, and unbinding is one write that
     * takes nothing with it.
     */
    boundCalendarId: uuid('bound_calendar_id').references((): AnyPgColumn => calendar.id, {
      onDelete: 'set null',
    }),
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
