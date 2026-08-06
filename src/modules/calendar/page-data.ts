import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
// Table objects come from the schema assembly point, not from the owning
// slice's barrel. `@/modules/google` re-exports that slice's client components,
// so importing it here would pull a React client graph into a `server-only`
// query module — and make this file unimportable from a plain Node test. The
// barrel is for *behaviour*; `server/db/schema.ts` is for tables (§2).
import { calendar } from '@/server/db/schema';
import { can, decide, getFamily, getPrincipal, listMembers, type Member } from '@/modules/family';
import { fetchWindow, isCalendarView, viewWindow, type CalendarView } from './domain/window';
import { fromWall, parseDateKey, startOfDay } from './domain/zone';
import { listEvents, type CalendarEvent } from './queries';
import type { WritableCalendar } from './ui/event-dialog';

/**
 * The one server-side read every calendar surface composes.
 *
 * Route files hold no logic (docs/architecture.md §2 rule 4), and all three
 * surfaces — `(app)/calendar`, `(app)/today`, `(hub)` — need the same five
 * things resolved the same way. Doing that once here is also what keeps the
 * private-calendar rule in a single place instead of three.
 */

export type CalendarPageData = {
  familyId: string;
  members: Member[];
  events: CalendarEvent[];
  calendars: WritableCalendar[];
  timeZone: string;
  weekStartsOn: number;
  anchor: Date;
  view: CalendarView;
  now: Date;
  canWrite: boolean;
};

export type LoadOptions = {
  /** `?view=` — anything unrecognised falls back to `week`. */
  view?: string;
  /** `?date=YYYY-MM-DD` — anything unrecognised falls back to today. */
  date?: string;
  /**
   * The hub is an ambient wall display: it renders free/busy for private
   * calendars regardless of who happens to be signed in on it.
   *
   * §7 already grades `calendar:view_private` as `busy-only` for a `device`
   * principal, which is what the hub will carry once device sessions land
   * (M12). Until then the hub authenticates as a member, and an owner would
   * otherwise see private detail on a screen in the kitchen. Forcing it from
   * the surface is the conservative reading, and it means M12 changes the
   * principal without changing this behaviour.
   */
  surface?: 'app' | 'hub';
};

/** Null when there is no principal — the caller redirects or renders a notice. */
export async function loadCalendarPage(options: LoadOptions): Promise<CalendarPageData | null> {
  const principal = await getPrincipal();
  if (!principal) return null;

  const family = await getFamily(principal.familyId);
  const timeZone = family?.timezone ?? 'Europe/Amsterdam';
  const weekStartsOn = family?.weekStartsOn ?? 1;

  const view: CalendarView = isCalendarView(options.view) ? options.view : 'week';
  const now = new Date();

  const parsedDate = options.date ? parseDateKey(options.date) : null;
  const anchor = parsedDate ? fromWall(parsedDate, timeZone) : startOfDay(now, timeZone);

  // One window for every view, so the client can switch between them without
  // another request (`domain/window.ts`).
  const window =
    options.surface === 'hub'
      ? viewWindow('day', { anchor, timeZone, weekStartsOn })
      : fetchWindow({ anchor, timeZone, weekStartsOn });

  const privateDetail =
    options.surface !== 'hub' &&
    decide(principal, 'calendar:view_private', { familyId: principal.familyId }) === 'allow';

  const [members, events, writableCalendars] = await Promise.all([
    listMembers(principal.familyId),
    listEvents({ familyId: principal.familyId, window, privateDetail }),
    listWritableCalendars(principal.familyId),
  ]);

  return {
    familyId: principal.familyId,
    members,
    events,
    calendars: writableCalendars,
    timeZone,
    weekStartsOn,
    anchor,
    view,
    now,
    canWrite: can(principal, 'event:write', { familyId: principal.familyId }),
  };
}

/**
 * The calendars an event may be created in: writable and syncing.
 *
 * A read-only Google calendar is excluded rather than shown-and-rejected —
 * offering a destination that can only fail is worse than not offering it.
 */
async function listWritableCalendars(familyId: string): Promise<WritableCalendar[]> {
  return getDb()
    .select({ id: calendar.id, summary: calendar.summary })
    .from(calendar)
    .where(
      and(
        eq(calendar.familyId, familyId),
        eq(calendar.writable, true),
        eq(calendar.syncEnabled, true)
      )
    )
    .orderBy(asc(calendar.summary));
}
