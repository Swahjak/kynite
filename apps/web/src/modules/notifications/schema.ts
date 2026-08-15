import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, primaryId, timestamps } from '@/server/db/columns';
import { family, member } from '@/modules/family/schema';
import { device } from '@/modules/devices/schema';
import { routine } from '@/modules/routines/schema';

/** docs/architecture.md §3 "Sharing, push, devices" — the push half. */

/**
 * One Web Push endpoint per browser install. `failureCount` is the pruning
 * signal: a subscription that keeps returning 404/410 is dead and gets dropped
 * rather than retried forever.
 */
export const pushSubscription = pgTable(
  'push_subscription',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    /** Null for a subscription made outside a paired device (a plain browser). */
    deviceId: uuid('device_id').references(() => device.id, { onDelete: 'set null' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    /**
     * Consecutive failures. Reset to 0 on every success — the signal is
     * "three in a row", not "three ever", so one flaky night never costs a
     * parent their notifications (§6: "3 consecutive failures → disable").
     */
    failureCount: integer('failure_count').notNull().default(0),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    /**
     * Set when the endpoint was disabled after `MAX_CONSECUTIVE_FAILURES`.
     * Disabled, not deleted: a `404`/`410` is the push service saying the
     * subscription is *gone* and that deletes the row, but a run of 500s is
     * only evidence, and keeping the row means a re-subscribe from the same
     * browser upserts back onto it instead of silently duplicating.
     */
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('push_subscription_endpoint_unique').on(table.endpoint),
    index('push_subscription_family_member_idx').on(table.familyId, table.memberId),
  ]
);

/**
 * The idempotency ledger for reminder dispatch (docs/architecture.md §8:
 * "`reminders:scan` runs every minute with a 90s look-ahead and an idempotency
 * key of `(routineId, occurrenceDate, memberId)` so a restart can't
 * double-notify").
 *
 * A separate table rather than a column on `routine`: the look-ahead window is
 * 90s and the cadence is 60s, so *every* occurrence is seen at least twice by
 * design. The unique index is what turns "seen twice" into "sent once", and it
 * has to survive a process restart mid-dispatch — which a row does and an
 * in-memory set does not.
 *
 * Append-only; the nightly `maintenance:trim` job prunes it.
 */
export const reminderDispatch = pgTable(
  'reminder_dispatch',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    routineId: uuid('routine_id')
      .notNull()
      .references(() => routine.id, { onDelete: 'cascade' }),
    /** The logical day the reminder is for, in the family's timezone. */
    occurrenceDate: date('occurrence_date').notNull(),
    /**
     * Who it went to. This is the routine's `ownerMemberId` — never the
     * creator (research §Decisions 10, PRD FR10) — and it is part of the key
     * so re-assigning a routine tomorrow does not suppress tomorrow's
     * reminder to its new owner.
     */
    memberId: uuid('member_id')
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex('reminder_dispatch_key_unique').on(
      table.routineId,
      table.occurrenceDate,
      table.memberId
    ),
    index('reminder_dispatch_created_at_idx').on(table.createdAt),
  ]
);

/**
 * What one member wants to be notified about (M16).
 *
 * Per *member*, not per subscription: a parent with a phone and a laptop has
 * one opinion about being told a child asked to spend stars, and switching it
 * off on one device only would be a setting that appears not to work. The
 * endpoints stay in `push_subscription`; this is the policy above them.
 *
 * **An absent row means everything on.** That is what makes this migration
 * safe for the families that already exist — nobody's reminders stop because
 * a table was added — and it is why the dispatch path asks "is there a row
 * that says no" rather than "is there a row that says yes". A member who has
 * never opened the settings page has no row and is notified exactly as before.
 *
 * The three switches are the three notifications this product sends
 * (docs/architecture.md §6, PRD FR22): the routine reminder that goes to a
 * routine's owner, the redemption request that fans out to every adult, and
 * the completion update that tells the *other* adults a step was ticked off.
 */
export const notificationPreference = pgTable(
  'notification_preference',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    /** §6: "a routine starts in a minute", to the routine's owner. */
    routineReminders: boolean('routine_reminders').notNull().default(true),
    /** §6 step 4: "may I spend my stars", to every adult. */
    redemptionRequests: boolean('redemption_requests').notNull().default(true),
    /**
     * PRD FR22 (M18): "a significant participant action", which in this
     * product means a routine step being ticked off — to every adult *other
     * than whoever tapped*.
     *
     * A third column rather than a reuse of `routineReminders`, and the
     * distinction is not pedantic: a reminder is addressed to the person who
     * owns the routine and arrives *before* it, while this is addressed to the
     * other adults and arrives *after* — the second parent who is not at home
     * and would otherwise learn nothing. A household that wants the first and
     * not the second is a completely ordinary household, and one switch could
     * not express it.
     *
     * Defaults `true`, and — like its two neighbours — an absent row means on,
     * so this migration turns the notification on for existing families
     * without anybody having to opt in to the feature FR22 already promised.
     */
    completionUpdates: boolean('completion_updates').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    // One opinion per member — the upsert's conflict target.
    uniqueIndex('notification_preference_member_unique').on(table.memberId),
    index('notification_preference_family_id_idx').on(table.familyId),
  ]
);

export type PushSubscription = typeof pushSubscription.$inferSelect;
export type ReminderDispatch = typeof reminderDispatch.$inferSelect;
export type NotificationPreference = typeof notificationPreference.$inferSelect;
