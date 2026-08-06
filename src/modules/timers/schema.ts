import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from '@/server/db/columns';
import { family, member } from '@/modules/family/schema';
import { routine, routineStep } from '@/modules/routines/schema';

/**
 * docs/architecture.md §3 + open question 3, decided here: **timers are
 * server-authoritative in their start time and client-local in their ticking.**
 *
 * A row states when a timer started and how long it runs; it never stores "how
 * much is left". Every surface derives the remaining time from
 * `startedAt + durationSeconds` against the *server's* clock (echoed to the
 * client, which corrects for its own skew — `domain/countdown.ts`). That is
 * what makes a hub reload mid-countdown resume at the right second, what makes
 * two devices agree, and what makes a wrong tablet clock a non-event.
 *
 * There is no `status` column for the same reason: `running` / `overrun` is a
 * function of the clock, and a stored status would need a job to keep it true.
 * The only state a *person* can change is `stoppedAt`.
 */
export const timer = pgTable(
  'timer',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    /** Whose timer the board shows it as. Null = the whole family's. */
    memberId: uuid('member_id').references(() => member.id, { onDelete: 'cascade' }),
    /** Set when the timer came from a routine step's `timerSeconds` prescription. */
    routineId: uuid('routine_id').references(() => routine.id, { onDelete: 'set null' }),
    routineStepId: uuid('routine_step_id').references(() => routineStep.id, {
      onDelete: 'set null',
    }),
    /**
     * What the board names it — "Schoenen aan". Copied from the step at start
     * time rather than joined at render time: renaming a step tomorrow must not
     * relabel a countdown that is already on the wall.
     */
    label: text('label').notNull(),
    durationSeconds: integer('duration_seconds').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    /** Set when someone stopped it — the only human-writable state. */
    stoppedAt: timestamp('stopped_at', { withTimezone: true }),
    /**
     * How far ahead the transition warning appears ("Schoenen aan over 5
     * minuten" — FR7, research §"visual schedules, transitions"). Null = no
     * warning; the countdown alone speaks.
     */
    warningLeadSeconds: integer('warning_lead_seconds'),
    startedByMemberId: uuid('started_by_member_id').references(() => member.id, {
      onDelete: 'set null',
    }),
    /**
     * Idempotency key minted by the client before the request leaves the device
     * — the same construction completions and redemptions use (§4), so the
     * offline outbox has one shape. `NULLS DISTINCT` exempts server-minted rows.
     */
    clientId: text('client_id'),
    ...timestamps,
  },
  (table) => [
    index('timer_family_started_idx').on(table.familyId, table.startedAt),
    // The board's only hot query: "what is running in this family".
    index('timer_family_running_idx').on(table.familyId, table.stoppedAt),
    check('timer_duration_seconds_positive', sql`${table.durationSeconds} > 0`),
    check(
      'timer_warning_lead_seconds_non_negative',
      sql`${table.warningLeadSeconds} is null or ${table.warningLeadSeconds} >= 0`
    ),
    uniqueIndex('timer_client_id_unique').on(table.clientId),
    /**
     * One running timer per routine step. Partial on purpose: yesterday's
     * "Tanden poetsen" timer must not block today's. Two taps a second apart
     * mint the same `clientId` and collide above; two devices minting two keys
     * collide here.
     */
    uniqueIndex('timer_running_step_unique')
      .on(table.routineStepId)
      .where(sql`${table.stoppedAt} is null`),
  ]
);

export type Timer = typeof timer.$inferSelect;
