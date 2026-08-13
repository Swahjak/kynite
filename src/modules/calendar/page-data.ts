import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '@/server/db';
// Table objects come from the schema assembly point, not from the owning
// slice's barrel. `@/modules/google` re-exports that slice's client components,
// so importing it here would pull a React client graph into a `server-only`
// query module — and make this file unimportable from a plain Node test. The
// barrel is for *behaviour*; `server/db/schema.ts` is for tables (§2).
import { calendar, googleAccount } from '@/server/db/schema';
import {
  can,
  decide,
  getFamily,
  getPrincipal,
  grade,
  listMembers,
  type Member,
} from '@/modules/family';
import { nearestCategory } from './domain/category';
import { fetchWindow, isCalendarView, viewWindow, type CalendarView } from './domain/window';
import { fromWall, parseDateKey, startOfDay } from './domain/zone';
import { listEvents, type CalendarEvent } from './queries';
import type { CalendarDisplayView } from './ui/calendar-display-list';
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

  /**
   * The hub's default board comes from the *family* (PRD FR28, M16), the
   * parent app's from the URL. `?view=` still wins on both — the visual suite
   * pins a hub board that way and a parent linking a view expects to get it —
   * but nothing on a wall display ever supplies one, so in practice the kiosk
   * renders whatever the Controller last said and needs no re-pairing to
   * follow a change (`family.hubDefaultView`).
   */
  const fallbackView: CalendarView =
    options.surface === 'hub' ? (family?.hubDefaultView ?? 'day') : 'week';
  const view: CalendarView = isCalendarView(options.view) ? options.view : fallbackView;
  const now = new Date();

  const parsedDate = options.date ? parseDateKey(options.date) : null;
  const anchor = parsedDate ? fromWall(parsedDate, timeZone) : startOfDay(now, timeZone);

  // One window for every view, so the client can switch between them without
  // another request (`domain/window.ts`).
  const window =
    options.surface === 'hub'
      ? // Exactly the board being drawn, not all four views: a wall display
        // switches nothing client-side, so fetching a month to render a day
        // would be a month of rows nobody looks at.
        viewWindow(view, { anchor, timeZone, weekStartsOn })
      : fetchWindow({ anchor, timeZone, weekStartsOn });

  /**
   * The private-calendar rule, in the two halves §7 actually grades it in.
   *
   * `allow` (an owner) is a household-wide grant and stays a boolean. `own` (an
   * adult) is not: it is a statement about a *resource*, and this read has
   * none, so `decide()` fails closed — which is right for everybody else's
   * private calendars and wrong for the caller's own, where it left a second
   * parent looking at a day of "bezet" blocks she could not open (M23). The
   * grade is therefore carried into the query, which is the only layer holding
   * the resource it needs (`calendar.owner_member_id`).
   *
   * The hub keeps forcing both off: an ambient wall display shows free/busy
   * for private calendars regardless of who is signed in on it.
   */
  const privateGrade =
    options.surface === 'hub'
      ? 'busy-only'
      : grade(principal, 'calendar:view_private') === 'own'
        ? 'own'
        : decide(principal, 'calendar:view_private', { familyId: principal.familyId });

  const privateDetail = privateGrade === 'allow';
  const privateDetailFor =
    privateGrade === 'own' && principal.kind === 'member' ? principal.memberId : null;

  const [members, events, writableCalendars] = await Promise.all([
    listMembers(principal.familyId),
    listEvents({ familyId: principal.familyId, window, privateDetail, privateDetailFor }),
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

/* ---------------------------------------------------------------------------
 * Hub display preferences: the calendars section of `(app)/settings` (FR28)
 * ------------------------------------------------------------------------ */

export type CalendarDisplayData = {
  /**
   * One row per linked calendar. The view type is declared by the component
   * that renders it (`ui/calendar-display-list.tsx`) — see its note on why the
   * dependency runs that way.
   */
  calendars: CalendarDisplayView[];
  canManage: boolean;
};

/**
 * The per-calendar half of FR28 (M16).
 *
 * Reads every calendar the family has linked, not only the writable ones:
 * visibility is a display fact, and a read-only calendar renders on the wall
 * exactly like a writable one does.
 */
export async function loadCalendarDisplay(): Promise<CalendarDisplayData | null> {
  const principal = await getPrincipal();
  if (!principal || principal.kind !== 'member') return null;

  const rows = await getDb()
    .select({
      id: calendar.id,
      summary: calendar.summary,
      accountEmail: googleAccount.email,
      visibility: calendar.visibility,
      color: calendar.color,
    })
    .from(calendar)
    .innerJoin(googleAccount, eq(calendar.googleAccountId, googleAccount.id))
    .where(eq(calendar.familyId, principal.familyId))
    .orderBy(asc(googleAccount.email), asc(calendar.summary));

  return {
    calendars: rows.map((row) => ({
      id: row.id,
      summary: row.summary,
      accountEmail: row.accountEmail,
      visibility: row.visibility,
      // Provenance only (M23): the dot beside the calendar's name, in Google's
      // own colour mapped onto a token the design system can draw. It says
      // "which calendar is this", and nothing about how its events look.
      color: nearestCategory(row.color) ?? 'blue',
    })),
    canManage: can(principal, 'display:manage', { familyId: principal.familyId }),
  };
}
