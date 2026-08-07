import {
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

export type PushSubscription = typeof pushSubscription.$inferSelect;
export type ReminderDispatch = typeof reminderDispatch.$inferSelect;
