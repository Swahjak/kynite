import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
// The table object from the schema assembly point rather than from the google
// barrel — see the same note in `./queries.ts`.
import { calendar } from '@/server/db/schema';

/**
 * The row shape, derived from the table rather than imported as `Calendar`
 * from `@/modules/google`.
 *
 * That barrel re-exports the google slice's Server Actions, and this module is
 * on the `(share)` tree's import closure through `./queries` — M13's binding
 * criterion is that the share tree reaches zero Server Actions transitively,
 * and a type-only import is not enough to keep it out of the graph the scan
 * walks (`tests/unit/share-tree-no-server-actions.test.ts`).
 */
type CalendarRow = typeof calendar.$inferSelect;

/**
 * The household's built-in "Gezin" calendar (M23).
 *
 * One per family, created with the family, never deletable and never hideable.
 * It answers a question the app could not answer before: *where does an event
 * that belongs to all of us live?* A family dinner used to be an event with no
 * owner and no attendees — household-wide by accident, because nothing had
 * claimed it — which meant "for everyone" was indistinguishable from "nobody
 * got round to saying whose this is".
 *
 * Its name is Dutch and not translated, deliberately: it is a calendar's
 * *name*, the same kind of string as "Werk" or "Schoolagenda Mila", and a
 * calendar that renames itself when a parent switches the interface language
 * would be a calendar nobody can refer to. A household that wants it called
 * something else renames it, which is the same freedom every other calendar
 * has.
 */
export const HOUSEHOLD_CALENDAR_NAME = 'Gezin';

/**
 * Idempotent: returns the family's household calendar, creating it if this is
 * the first time anybody has asked.
 *
 * Called from family creation, and again from the read path, because a
 * household created before this milestone (or by a path that predates the
 * hook) must not be a household without one. The insert is guarded by a
 * re-read inside the same statement order rather than by a unique index: the
 * index would have to be partial (`where is_household`), which drizzle-kit
 * cannot express here, and the cost of the guard is one extra select on a
 * table with a handful of rows per family.
 */
export async function ensureHouseholdCalendar(familyId: string): Promise<CalendarRow> {
  const existing = await findHouseholdCalendar(familyId);
  if (existing) return existing;

  const [created] = await getDb()
    .insert(calendar)
    .values({
      familyId,
      summary: HOUSEHOLD_CALENDAR_NAME,
      isHousehold: true,
      // Familie & uitjes: what a household calendar is for, and the type every
      // event on it inherits unless it says otherwise.
      defaultType: 'family',
      // Ours to write, always in sync (there is nothing to sync it *to* until
      // somebody binds it), and never anybody's personal calendar — an event
      // on it belongs to the household, so it must not attribute to a member.
      writable: true,
      syncEnabled: true,
      visibility: 'family',
    })
    .returning();

  return created;
}

/** The row, or null when the family has never had one made. */
export async function findHouseholdCalendar(familyId: string): Promise<CalendarRow | null> {
  const [row] = await getDb()
    .select()
    .from(calendar)
    .where(and(eq(calendar.familyId, familyId), eq(calendar.isHousehold, true)))
    // Ordered so a family that somehow acquired two gets a stable answer
    // rather than whichever one Postgres felt like returning.
    .orderBy(asc(calendar.createdAt))
    .limit(1);

  return row ?? null;
}

/**
 * The calendars whose events are household-wide: the "Gezin" calendar itself,
 * and the Google calendar it is bound to, if any.
 *
 * The binding is a pointer, so the bound calendar's events stay on their own
 * row and keep syncing through the untouched engine; all that changes is that
 * every board reads them as everyone's.
 */
export async function householdCalendarIds(familyId: string): Promise<Set<string>> {
  const row = await findHouseholdCalendar(familyId);
  if (!row) return new Set();

  return new Set(row.boundCalendarId ? [row.id, row.boundCalendarId] : [row.id]);
}
