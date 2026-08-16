import 'server-only';
import { hasLocale } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { defaultFormattingLocale, type FormattingLocale } from '@/i18n/formatting-locale';
import { routing } from '@/i18n/routing';
import { decide } from '@/modules/family/authorize';
import { getFamily, listMembers } from '@/modules/family/queries';
import { MS_PER_DAY, startOfDay, toDateKey, toWall } from '@/modules/calendar/domain/zone';
import { groupByDay, listEvents, type CalendarEvent } from '@/modules/calendar/queries';
import { timingAt } from '@/modules/routines/domain/occurrence';
import { completionSeed } from '@/modules/routines/domain/praise';
import { completionRatio } from '@/modules/routines/domain/steps';
import { listCompletedSteps, listRoutines } from '@/modules/routines/queries';
import { coversCalendar, coversMember, opensSurface, type ShareLinkScope } from '../domain/scope';
import { resolveShareLink, type ShareDenial } from '../resolve';
import type { ShareLinkRole } from '../schema';

/**
 * The one server-side read the `(share)` view composes (architecture §2 rule 4:
 * route files hold no logic).
 *
 * **Why this does not go through slice barrels.** `@/modules/calendar` and
 * `@/modules/routines` re-export their slices' Server Actions alongside their
 * queries, and M13's binding criterion is that the `(share)` tree imports zero
 * Server Actions *transitively*. A barrel import here would put
 * `createEventAction` one hop from a page that must never be able to reach a
 * mutation. So this module deep-imports `queries` and `domain/` — action-free
 * by construction — under the narrow exemption in `eslint.config.mjs`, which
 * names this path and allows nothing but those. It is the same shape as the
 * two exemptions that came before it (schema→schema, domain→domain): a barrel
 * would drag in exactly the thing the boundary exists to keep out.
 *
 * **What the caregiver actually gets**, per the §7 matrix:
 *   - `calendar:view` is `scoped` for both roles → the schedule, filtered to
 *     the link's members and calendars.
 *   - `calendar:view_private` is `deny` for both roles → `privateDetail:
 *     false`, so private calendars render free/busy (`BUSY_LABEL`), never
 *     titles. That is asked of `decide()` rather than hardcoded, so the day the
 *     matrix changes, this changes with it.
 *   - `completion:write` is `scoped` for `contributor` and `deny` for `viewer`
 *     → tick buttons appear only for a contributor, only on members inside
 *     scope. The buttons are an affordance; the authority is re-derived
 *     server-side in `POST /api/share/completions`.
 */

/** How many days of schedule a caregiver sees. A week is the babysitting unit. */
export const SHARE_WINDOW_DAYS = 7;

export type ShareMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
};

export type ShareDay = {
  /** `YYYY-MM-DD` in the family's timezone. */
  dateKey: string;
  events: ShareEvent[];
};

export type ShareEvent = {
  key: string;
  title: string;
  startsAt: number;
  endsAt: number;
  allDay: boolean;
  location: string | null;
  /**
   * Members this event belongs to, restricted to the ones in scope — and
   * `null` when that audience is **withheld**, which is every busy-only event.
   *
   * Nullable rather than emptied because the two are different facts and the
   * board renders them differently: `[]` is "this belongs to nobody in
   * particular", a household event the caregiver may legitimately be told
   * about, and printing that about a redacted hour still narrows what the
   * hidden hour is. Typed so the absence survives the next person editing the
   * board, the same way `combineDayEvents` and `participantsOf` are.
   *
   * `queries.ts` blanks a redacted row's title, location and attendees but
   * passes `ownerMemberId` through — it is the row's only surviving routing
   * signal — so the owner *does* reach `toShareEvent`, and this is where the
   * name derived from it stops. It matters more here than on the in-household
   * surfaces: a share link is read by someone outside the household.
   */
  memberIds: string[] | null;
  /** True when a private calendar was rendered free/busy (§7). */
  busyOnly: boolean;
};

export type ShareStep = {
  id: string;
  title: string;
  done: boolean;
  /** The idempotency key a contributor tick carries — derived, so retries reuse it. */
  clientId: string;
};

export type ShareRoutine = {
  id: string;
  title: string;
  memberId: string;
  occurrenceDate: string;
  steps: ShareStep[];
  doneCount: number;
  total: number;
  ratio: number;
};

export type ShareView = {
  status: 'ok';
  familyName: string;
  label: string | null;
  role: ShareLinkRole;
  timeZone: string;
  /** The family's date/time convention (`src/i18n/formatting-locale.ts`) — a
   * caregiver's own browser locale governs `messages`, but the schedule
   * itself reads in the household's chosen convention, same as `timeZone`. */
  formattingLocale: FormattingLocale;
  /** Server clock in epoch ms — a caregiver's tablet may be hours off. */
  serverNow: number;
  members: ShareMember[];
  days: ShareDay[];
  routines: ShareRoutine[];
  /** Whether this link may tick completions at all (`contributor`, in scope). */
  canComplete: boolean;
  showSchedule: boolean;
  showRoutines: boolean;
};

export type ShareViewResult = ShareView | { status: ShareDenial };

export async function loadShareView(rawToken: string): Promise<ShareViewResult> {
  const resolution = await resolveShareLink(rawToken);
  if (resolution.status !== 'ok') return { status: resolution.status };

  const { principal, scope } = resolution;
  const familyId = principal.familyId;

  const family = await getFamily(familyId);
  const timeZone = family?.timezone ?? 'Europe/Amsterdam';
  const requestedLocale = await getLocale();
  const uiLocale = hasLocale(routing.locales, requestedLocale)
    ? requestedLocale
    : routing.defaultLocale;
  const formattingLocale = family?.formattingLocale ?? defaultFormattingLocale(uiLocale);
  const now = new Date();

  const allMembers = await listMembers(familyId);
  const members = allMembers.filter((entry) => coversMember(scope, entry.id));
  const scopedMemberIds = new Set(members.map((entry) => entry.id));

  const showSchedule = opensSurface(scope, 'calendar');
  const showRoutines = opensSurface(scope, 'routines');

  const [days, routines] = await Promise.all([
    showSchedule
      ? loadDays({ familyId, principal, scope, scopedMemberIds, timeZone, now })
      : Promise.resolve([]),
    showRoutines
      ? loadRoutines({ familyId, memberIds: [...scopedMemberIds], timeZone, now })
      : Promise.resolve([]),
  ]);

  return {
    status: 'ok',
    familyName: family?.name ?? '',
    label: resolution.label,
    role: resolution.role,
    timeZone,
    formattingLocale,
    serverNow: now.getTime(),
    members: members.map((entry) => ({
      id: entry.id,
      displayName: entry.displayName,
      avatarUrl: entry.avatarUrl,
      color: entry.color,
    })),
    days,
    routines,
    // Asked of the matrix, not of `role === 'contributor'`: one authority.
    canComplete:
      showRoutines &&
      members.some(
        (entry) =>
          decide(principal, 'completion:write', { familyId, memberId: entry.id }) === 'allow'
      ),
    showSchedule,
    showRoutines,
  };
}

async function loadDays(input: {
  familyId: string;
  principal: Parameters<typeof decide>[0];
  scope: ShareLinkScope;
  scopedMemberIds: Set<string>;
  timeZone: string;
  now: Date;
}): Promise<ShareDay[]> {
  const { familyId, principal, scope, scopedMemberIds, timeZone, now } = input;

  // Seven days *from today*, not the calendar week: a caregiver who opens the
  // link on a Saturday wants the days ahead of them, not two of them.
  const start = startOfDay(now, timeZone);
  const end = new Date(start.getTime() + SHARE_WINDOW_DAYS * MS_PER_DAY);

  // The busy-only rule, asked rather than assumed. §7 grades
  // `calendar:view_private` as `deny` for both share roles, so this is `false`
  // today — and stays correct if the matrix ever changes, which a hardcoded
  // `false` would not.
  const privateDetail = decide(principal, 'calendar:view_private', { familyId }) === 'allow';

  const events = await listEvents({ familyId, window: { from: start, to: end }, privateDetail });

  const visible = events.filter((item) => isInScope(item, scope, scopedMemberIds));
  const byDay = groupByDay(visible, timeZone);

  const days: ShareDay[] = [];
  for (let offset = 0; offset < SHARE_WINDOW_DAYS; offset += 1) {
    // Stepping by whole days off the start instant would drift across a DST
    // boundary; re-deriving the wall date from each instant is what keeps the
    // seventh day the seventh day in Amsterdam as well as in UTC.
    const dateKey = toDateKey(toWall(new Date(start.getTime() + offset * MS_PER_DAY), timeZone));
    days.push({
      dateKey,
      events: (byDay.get(dateKey) ?? []).map((item) => toShareEvent(item, scopedMemberIds)),
    });
  }

  return days;
}

/**
 * Scope filtering for one event.
 *
 * A household event with no owner and no attendees — "Family dinner" — is shown
 * to every scoped link. A babysitter minding one child still needs to know the
 * whole house is out at six; hiding it because it names nobody would be the
 * scope rule producing an unsafe schedule rather than a private one.
 */
function isInScope(item: CalendarEvent, scope: ShareLinkScope, memberIds: Set<string>): boolean {
  if (!coversCalendar(scope, item.calendarId)) return false;

  const subjects = [...(item.ownerMemberId ? [item.ownerMemberId] : []), ...item.attendeeMemberIds];
  if (subjects.length === 0) return true;

  return subjects.some((id) => memberIds.has(id));
}

function toShareEvent(item: CalendarEvent, memberIds: Set<string>): ShareEvent {
  const subjects = new Set<string>();
  if (item.ownerMemberId) subjects.add(item.ownerMemberId);
  for (const id of item.attendeeMemberIds) subjects.add(id);

  return {
    key: item.key,
    title: item.title,
    startsAt: item.startsAt.getTime(),
    endsAt: item.endsAt.getTime(),
    allDay: item.allDay,
    location: item.location,
    // Withheld, not filtered: a redacted event ships no audience at all, so
    // the RSC payload the caregiver's browser receives carries no member id
    // for it either — not just the rendered HTML.
    memberIds: item.busyOnly ? null : [...subjects].filter((id) => memberIds.has(id)),
    busyOnly: item.busyOnly,
  };
}

async function loadRoutines(input: {
  familyId: string;
  memberIds: string[];
  timeZone: string;
  now: Date;
}): Promise<ShareRoutine[]> {
  const { familyId, memberIds, timeZone, now } = input;
  if (memberIds.length === 0) return [];

  const routines: ShareRoutine[] = [];

  for (const memberId of memberIds) {
    const rows = await listRoutines(familyId, { ownerMemberId: memberId, activeOnly: true });

    // Only routines that are live *now* appear. A routine that is not due today
    // is absent — not greyed out, not crossed off (research §"no negative
    // marking", FR11): a caregiver's screen is the last place a child's missed
    // morning should be on display.
    const timed = rows.flatMap((row) => {
      const timing = timingAt({ schedule: row.schedule, anchor: row.createdAt, timeZone }, now);
      return timing.occurrence ? [{ row, occurrence: timing.occurrence }] : [];
    });
    if (timed.length === 0) continue;

    const completed = await listCompletedSteps({
      familyId,
      memberId,
      occurrenceDates: [...new Set(timed.map(({ occurrence }) => occurrence.occurrenceDate))],
    });
    const doneKeys = new Set(
      completed.map((entry) => `${entry.routineStepId}:${entry.occurrenceDate}`)
    );

    for (const { row, occurrence } of timed) {
      const steps: ShareStep[] = row.steps.map((step) => ({
        id: step.id,
        title: step.title,
        done: doneKeys.has(`${step.id}:${occurrence.occurrenceDate}`),
        clientId: completionSeed({
          memberId,
          routineStepId: step.id,
          occurrenceDate: occurrence.occurrenceDate,
        }),
      }));

      const doneCount = steps.filter((step) => step.done).length;

      routines.push({
        id: row.id,
        title: row.title,
        memberId,
        occurrenceDate: occurrence.occurrenceDate,
        steps,
        doneCount,
        total: steps.length,
        ratio: completionRatio(steps.length, doneCount),
      });
    }
  }

  return routines;
}
