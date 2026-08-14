import { date, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from '@/server/db/columns';
import { family, member } from '@/modules/family/schema';

/**
 * A task: one line of text somebody has to get done.
 *
 * This slice exists because the routine machinery was the wrong tool for it.
 * A one-off chore *could* be modelled as a routine with `schedule.kind:
 * 'once'` — steps, stars, grace days, an occurrence date, a completion row
 * keyed on it — and that is exactly the problem: "prullenbak buiten zetten"
 * had to be authored through a builder designed for a five-step morning
 * routine, and it could not exist at all without a date. Both are wrong for
 * the thing the Takenlijst on `/today` is actually a list of.
 *
 * So a task has no steps, no stars, no schedule and no occurrence. It has a
 * title, optionally a person, optionally a day, and a moment it was ticked off.
 * Everything else the product does with chores stays where it is.
 *
 * **`dueDate` is nullable and that is the point.** An undated task is not an
 * incomplete one — "bellen met de tandarts, ooit" is a first-class row, and it
 * appears on today's list precisely *because* it has no day of its own to wait
 * for. It is a `date`, not a timestamp: a task is due on a day in the family's
 * own calendar, and giving it an instant would make "today" depend on a
 * timezone the person typing it never chose.
 *
 * **Completion is a timestamp, not a boolean.** `completedAt` answers "is it
 * done" and "was it done *today*" with one column, and the list needs both:
 * a task ticked off five minutes ago stays visible, struck through, so a tap
 * never makes a row vanish under the finger that tapped it.
 */
export const task = pgTable(
  'task',
  {
    id: primaryId(),
    familyId: uuid('family_id')
      .notNull()
      .references(() => family.id, { onDelete: 'cascade' }),
    /**
     * Whom it is for. Null = nobody in particular, which is the honest state
     * for most of a household's list ("hond uitlaten") and is why this is
     * nullable rather than defaulted to whoever typed it.
     *
     * `set null` rather than `cascade`: a member leaving the family does not
     * mean the bins stop needing to go out.
     */
    assigneeMemberId: uuid('assignee_member_id').references(() => member.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    /** `YYYY-MM-DD` in the family's timezone. Null = no day at all. */
    dueDate: date('due_date'),
    /** When it was ticked off. Null = still open. */
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdByMemberId: uuid('created_by_member_id').references(() => member.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [
    /**
     * The list's only query: "this family's open tasks, by day".
     *
     * `(family_id, completed_at, due_date)` covers both halves of it — the open
     * rows are a prefix of the index and the dated ones sort inside it — so the
     * Takenlijst is one range scan rather than a partition read plus a sort.
     */
    index('task_family_open_idx').on(table.familyId, table.completedAt, table.dueDate),
    index('task_family_assignee_idx').on(table.familyId, table.assigneeMemberId),
  ]
);

export type Task = typeof task.$inferSelect;
