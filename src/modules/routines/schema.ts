import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  pgView,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, primaryId, timestamps } from '@/server/db/columns';
import { family, member } from '@/modules/family/schema';
import { event } from '@/modules/calendar/schema';
import { redemption } from '@/modules/rewards/schema';

/** docs/architecture.md §3 "Routines, completions, stars". */

export const completionSource = pgEnum('completion_source', ['hub', 'mobile', 'auto']);

export const starReason = pgEnum('star_reason', ['routine', 'bonus', 'manual', 'surprise']);

/** The `schedule` jsonb: an RRULE plus the day's shape around it. */
export type RoutineSchedule = {
  /** RFC-5545 RRULE, e.g. `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`. */
  rrule: string;
  /** Local wall-clock `HH:mm` the routine is due at. */
  timeOfDay?: string;
  /** Days after the due date a completion still counts (never a penalty). */
  graceDays?: number;
};

/**
 * A recurring set of steps owned by one member. Fade is per-routine state
 * (`rewardEnabled`, `fadedAt`), not a global setting — research §Decisions 7:
 * a routine that has become a habit stops paying stars without the child
 * losing anything anywhere else.
 */
export const routine = pgTable(
  'routine',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    /** Whose routine it is — also where its reminders route. */
    ownerMemberId: uuid('owner_member_id')
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    icon: text('icon'),
    schedule: jsonb('schedule').$type<RoutineSchedule>().notNull(),
    starsPerCompletion: integer('stars_per_completion').notNull().default(1),
    rewardEnabled: boolean('reward_enabled').notNull().default(true),
    /** Set when the routine faded: "you do this on your own now". */
    fadedAt: timestamp('faded_at', { withTimezone: true }),
    active: boolean('active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    index('routine_family_id_idx').on(table.familyId),
    index('routine_family_owner_idx').on(table.familyId, table.ownerMemberId),
    check('routine_stars_per_completion_non_negative', sql`${table.starsPerCompletion} >= 0`),
  ]
);

/**
 * One tap on the hub. Scoped to the family transitively through its routine —
 * a step has no independent existence.
 */
export const routineStep = pgTable(
  'routine_step',
  {
    id: primaryId(),
    routineId: uuid('routine_id')
      .notNull()
      .references(() => routine.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    icon: text('icon'),
    sortOrder: integer('sort_order').notNull().default(0),
    /** Timer prescription in seconds — null = untimed. */
    timerSeconds: integer('timer_seconds'),
    ...timestamps,
  },
  (table) => [index('routine_step_routine_sort_idx').on(table.routineId, table.sortOrder)]
);

/**
 * The record that a step was satisfied on a logical day.
 *
 * There is no "uncompleted" state: undo deletes the row within a short window,
 * and a missed task is the *absence* of a row (rendered dimmed, never a red X).
 * `unique(memberId, routineStepId, occurrenceDate)` makes a double tap a no-op
 * and `unique(clientId)` makes an offline outbox replay a no-op — the two
 * halves of the optimistic completion flow in §4.
 */
export const completion = pgTable(
  'completion',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    routineId: uuid('routine_id').references(() => routine.id, { onDelete: 'cascade' }),
    routineStepId: uuid('routine_step_id').references(() => routineStep.id, {
      onDelete: 'cascade',
    }),
    eventId: uuid('event_id').references(() => event.id, { onDelete: 'cascade' }),
    /** The logical day satisfied — not the wall clock of the tap. */
    occurrenceDate: date('occurrence_date').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
    source: completionSource('source').notNull(),
    /** Idempotency key minted by the client before the request leaves the device. */
    clientId: text('client_id').notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    // NULLS DISTINCT (the Postgres default) is deliberate: a completion with no
    // step (a whole-routine or event completion) is deduplicated by `clientId`,
    // not by this index — otherwise two different routines completed by one
    // member on one day would collide.
    uniqueIndex('completion_member_step_date_unique').on(
      table.memberId,
      table.routineStepId,
      table.occurrenceDate
    ),
    uniqueIndex('completion_client_id_unique').on(table.clientId),
    index('completion_family_member_date_idx').on(
      table.familyId,
      table.memberId,
      table.occurrenceDate
    ),
  ]
);

/**
 * Append-only, non-negative star awards. **Hard invariant** (research
 * §Decisions 1: no star removal, ever):
 *
 * - rows are never updated or deleted;
 * - `CHECK (amount > 0)` enforces it in the database, not in a Server Action;
 * - spending is a `redemption`, never a negative row here, so "stars earned"
 *   is monotonic forever and "stars available" is derived by
 *   `member_star_balance`.
 *
 * No parent action can lower earned stars — `stars:remove` is `deny` in every
 * column of the §7 matrix, and this constraint is what makes that unbypassable.
 * There is no `updatedAt`: an append-only table has nothing to update.
 */
export const starLedger = pgTable(
  'star_ledger',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    reason: starReason('reason').notNull(),
    completionId: uuid('completion_id').references(() => completion.id, { onDelete: 'set null' }),
    routineId: uuid('routine_id').references(() => routine.id, { onDelete: 'set null' }),
    redemptionId: uuid('redemption_id').references(() => redemption.id, { onDelete: 'set null' }),
    note: text('note'),
    createdAt: createdAt(),
  },
  (table) => [
    index('star_ledger_family_member_created_idx').on(
      table.familyId,
      table.memberId,
      table.createdAt
    ),
    check('star_ledger_amount_positive', sql`${table.amount} > 0`),
  ]
);

/**
 * Stars available = everything ever earned minus everything spent on
 * redemptions that were actually granted (`approved`/`fulfilled`). Derived, so
 * the two numbers can never drift: `earned_stars` is the number the child sees
 * grow and it only ever goes up.
 */
export const memberStarBalance = pgView('member_star_balance', {
  familyId: uuid('family_id').notNull(),
  memberId: uuid('member_id').notNull(),
  earnedStars: bigint('earned_stars', { mode: 'number' }).notNull(),
  spentStars: bigint('spent_stars', { mode: 'number' }).notNull(),
  availableStars: bigint('available_stars', { mode: 'number' }).notNull(),
}).as(sql`
  select
    m.family_id as family_id,
    m.id as member_id,
    coalesce(earned.total, 0)::bigint as earned_stars,
    coalesce(spent.total, 0)::bigint as spent_stars,
    (coalesce(earned.total, 0) - coalesce(spent.total, 0))::bigint as available_stars
  from "member" m
  left join (
    select member_id, sum(amount)::bigint as total
    from "star_ledger"
    group by member_id
  ) earned on earned.member_id = m.id
  left join (
    select member_id, sum(cost_stars)::bigint as total
    from "redemption"
    where status in ('approved', 'fulfilled')
    group by member_id
  ) spent on spent.member_id = m.id
`);

export type Routine = typeof routine.$inferSelect;
export type RoutineStep = typeof routineStep.$inferSelect;
export type Completion = typeof completion.$inferSelect;
export type StarLedgerEntry = typeof starLedger.$inferSelect;
export type MemberStarBalance = typeof memberStarBalance.$inferSelect;
export type CompletionSource = (typeof completionSource.enumValues)[number];
export type StarReason = (typeof starReason.enumValues)[number];

export const COMPLETION_SOURCES = completionSource.enumValues;
export const STAR_REASONS = starReason.enumValues;
