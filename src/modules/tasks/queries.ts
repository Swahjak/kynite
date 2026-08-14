import 'server-only';
import { and, asc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { getDb } from '@/server/db';
import { task, type Task } from './schema';

/**
 * Reads for the tasks slice. `server-only`, like every other slice's
 * `queries.ts` — a client component that imported this would ship the database
 * client to the browser.
 *
 * Every read is family-scoped by `where`, never by the caller remembering to
 * filter afterwards.
 */

/**
 * What the Takenlijst on `/today` shows, in one query.
 *
 * Three groups, and each is there for a reason:
 *
 * - **open and undated** — the household's standing list. A task with no day
 *   is not "unscheduled and therefore not now"; it is the most common kind of
 *   task there is, and hiding it until somebody gives it a date is how a list
 *   dies.
 * - **open and due today or earlier** — including overdue, which is the whole
 *   reason the bound is `<=` rather than `=`. A task that was due yesterday and
 *   is still open is *more* urgent today, not gone.
 * - **completed today** — struck through, at the bottom. A row that vanishes
 *   the instant it is ticked takes its own undo with it, and reads as a
 *   deletion rather than an achievement.
 *
 * Tasks due *later* are deliberately absent: this is today's list, and a
 * fortnight of future rows on it would be a different screen.
 */
export async function listTodayTasks(input: {
  familyId: string;
  /** `YYYY-MM-DD` in the family's zone — see `todayKeyIn`. */
  todayKey: string;
  /** Local midnight, so "completed today" means the family's day. */
  since: Date;
}): Promise<Task[]> {
  return getDb()
    .select()
    .from(task)
    .where(
      and(
        eq(task.familyId, input.familyId),
        or(
          and(
            isNull(task.completedAt),
            or(isNull(task.dueDate), lte(task.dueDate, input.todayKey))
          ),
          gte(task.completedAt, input.since)
        )
      )
    )
    .orderBy(
      // Open first, then oldest-created first: the list keeps a stable order
      // that a tick does not reshuffle, and a ticked row falls to the bottom
      // rather than staying where the finger left it.
      sql`${task.completedAt} nulls first`,
      asc(task.dueDate),
      asc(task.createdAt)
    );
}

/** One task, family-scoped. Null for another family's id — never a leak. */
export async function getTask(familyId: string, taskId: string): Promise<Task | null> {
  const [row] = await getDb()
    .select()
    .from(task)
    .where(and(eq(task.id, taskId), eq(task.familyId, familyId)))
    .limit(1);

  return row ?? null;
}
