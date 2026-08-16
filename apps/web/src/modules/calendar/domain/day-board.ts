import { dayKeysOf } from './expand';

/**
 * The three ways a day's events get grouped, and the one order they share.
 *
 * Every calendar surface in the app asks one of exactly three questions of a
 * flat event list, and before this file each surface answered it with its own
 * hand-written loop:
 *
 * - **"Which day is this on?"** — `bucketByDay`. A month grid, an agenda list,
 *   a week's time grid and the phone's day strip all need events keyed by day.
 * - **"Whose is this?"** — `splitByMember`. A person-column board, the day
 *   grid and `/today`'s person tab all need one day's events split between the
 *   people they belong to and a lane for the ones that are everybody's.
 * - **"What is on today, once each?"** — `combineDayEvents`, below, which is
 *   the deliberate inverse of `splitByMember`.
 *
 * All three go through `dayKeysOf` in `domain/expand.ts` for the day question,
 * which is where the genuinely hard parts live and where they should stay: a
 * timed event buckets in the viewer's zone while an all-day row buckets in UTC
 * (because M05 stores all-day bounds as zoneless UTC midnights and reading them
 * locally would smear a one-day event across two), an all-day end date is
 * exclusive, a timed event ending exactly at local midnight belongs to the day
 * before, and a multi-day event appears whole in every day it touches rather
 * than being sliced. Nothing here re-derives any of that.
 *
 * ## The one order
 *
 * `DAY_ORDER` below sorts every bucket every function here produces, and the
 * copies it replaces did not agree on it. Two sorted by `startsAt` alone,
 * which places an all-day row by the accident of how it is stored — a UTC
 * midnight reads as 01:00 in Amsterdam, so "vrij" landed after a 00:30 event
 * and before breakfast, a position nobody chose. Two did not sort at all and
 * relied on `queries.ts` having already sorted by start, which is true but
 * leaves the same all-day problem. `/today`'s person tab and `combineDayEvents`
 * both put all-day first, on the argument that an all-day row *frames* the day
 * rather than sitting in it. That is the argument that wins, so it is now the
 * only order, and the tie-breaks (end, then `key`) make it total so a re-render
 * can never reshuffle two events that begin and end at the same minute.
 */

/** The shape every grouping here reads — `CalendarEvent` satisfies it. */
export type CombinableEvent = {
  /** Stable per instance; two entries with the same key are the same event. */
  key: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  ownerMemberId: string | null;
  attendeeMemberIds: string[];
  /**
   * On the household's own calendar (M23) — everyone's, by construction.
   *
   * It takes precedence over attribution rather than adding to it: an event on
   * a *bound* Google calendar carries that calendar owner's id, and letting
   * that through would draw one face on the family dinner instead of all of
   * them.
   */
  householdWide?: boolean;
  /**
   * Rendered free/busy: the viewer's principal has `calendar:view_private` =
   * `busy-only` (§7), so it may learn that the hour is occupied and nothing
   * else — least of all whose it is.
   *
   * `queries.ts` blanks the title, the location and `attendeeMemberIds` on such
   * a row but deliberately passes `ownerMemberId` through, because it is the
   * only routing signal left and blanking it would dump every private event
   * into the shared lane. Which makes every *name* derived from it here a leak,
   * and makes this flag the thing that stops the derivation.
   */
  busyOnly?: boolean;
};

export type CombineDayOptions = {
  timeZone: string;
  /** `YYYY-MM-DD` in the household's zone — see `toDateKey`. */
  dayKey: string;
};

/**
 * All-day first, then start, then end, then `key`.
 *
 * See the "one order" note above for why all-day leads; the `key` tail is only
 * there to make the order total and therefore stable across renders.
 */
function compareForDay(a: CombinableEvent, b: CombinableEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  const byStart = a.startsAt.getTime() - b.startsAt.getTime();
  if (byStart !== 0) return byStart;
  const byEnd = a.endsAt.getTime() - b.endsAt.getTime();
  if (byEnd !== 0) return byEnd;
  return a.key.localeCompare(b.key);
}

export type BucketByDayOptions = {
  timeZone: string;
  /**
   * Restrict bucketing to these `YYYY-MM-DD` keys.
   *
   * Two callers need it for different reasons and both are served: the agenda
   * view has a window and must not bucket an event outside it, and the time
   * grid draws a fixed set of columns. A multi-day event that only partly
   * overlaps the window is clipped to the days inside it.
   */
  dayKeys?: Iterable<string>;
  /**
   * Pre-create an empty bucket for every key in `dayKeys`, in that order.
   *
   * Off by default because the two shapes of caller genuinely differ and
   * neither is wrong. The agenda view lists *only* days with something on
   * them, so a seeded empty bucket would draw a date heading over nothing; the
   * time grid draws a column per day regardless and wants `get(key)` to be an
   * array rather than `undefined`. Seeding is the cheap difference, so it is
   * the flag rather than two functions.
   */
  seedEmpty?: boolean;
};

/**
 * Events grouped by the calendar day they touch.
 *
 * Replaces the same loop written five times: `ui/agenda-view.tsx`,
 * `ui/month-view.tsx`, `ui/mobile-month-view.tsx`, `ui/day-strip.tsx` and
 * `ui/time-grid.tsx`.
 *
 * A multi-day event appears — the same object, not a slice — in every bucket it
 * spans, because that is what a month cell and a week column both draw. Each
 * bucket is sorted by `compareForDay`.
 *
 * Two caller shapes are deliberately *not* options here, because both are one
 * expression at the call site and an option for each would make the signature
 * worse than the thing it replaces:
 *
 * - **Timed vs all-day in separate maps** (the time grid, which draws all-day
 *   rows in a header band above the hour columns): call this twice on
 *   `events.filter((e) => e.allDay)` and its complement.
 * - **Just the set of busy days** (the day strip's dots): `new Set(bucketByDay(
 *   events, { timeZone }).keys())`.
 */
export function bucketByDay<E extends CombinableEvent>(
  events: readonly E[],
  { timeZone, dayKeys, seedEmpty = false }: BucketByDayOptions
): Map<string, E[]> {
  const window = dayKeys ? new Set(dayKeys) : null;
  const buckets = new Map<string, E[]>();

  if (seedEmpty && dayKeys) {
    // Insertion order is the caller's order, which for a time grid is the
    // left-to-right column order it will iterate in.
    for (const key of dayKeys) buckets.set(key, []);
  }

  const seen = new Set<string>();
  for (const event of events) {
    // The list can legitimately contain the same instance twice — a board that
    // concatenates per-member queries, a re-render mid-sync. `key` is stable
    // per instance, so it is the identity.
    if (seen.has(event.key)) continue;
    seen.add(event.key);

    for (const key of dayKeysOf(event, timeZone, event.allDay)) {
      if (window && !window.has(key)) continue;
      const bucket = buckets.get(key);
      if (bucket) bucket.push(event);
      else buckets.set(key, [event]);
    }
  }

  for (const bucket of buckets.values()) bucket.sort(compareForDay);
  return buckets;
}

export type MemberSplit<E extends CombinableEvent> = {
  /** One entry per member id passed in, in that order, always present. */
  byMember: Map<string, E[]>;
  /** Everybody's: household events, and events nobody is attached to. */
  shared: E[];
};

/**
 * One day's events, split between the people they belong to.
 *
 * Replaces four hand-written copies — `ui/person-columns.tsx`,
 * `ui/member-day-grid.tsx`, `today/ui/today-tab-personen.tsx`, and the
 * attribution half of `ui/calendar-shell.tsx`'s member filter — which had
 * drifted into three different answers. The rule, in order:
 *
 * 1. **The day gate.** Not touching `dayKey` means not here at all.
 * 2. **`householdWide` outranks attribution.** An event on the household's own
 *    calendar is everyone's by construction (M23), and an event on a *bound*
 *    Google calendar carries that calendar owner's member id — so reading
 *    attribution first would draw family dinner as one parent's appointment
 *    and leave the children's columns empty. `member-day-grid.tsx` never
 *    consulted the flag and did exactly that; it is the clearest of the four
 *    disagreements, and the flag wins.
 * 3. **Nobody attached → shared.** A school-holiday row, a manually created
 *    "opa & oma komen". Unclaimed genuinely means the household's.
 * 4. **Attached, and at least one of them is rendered → their columns**, in
 *    the caller's member order so the same two children always stack the same
 *    way. Attendees the caller did not pass are simply not drawn.
 * 5. **Attached, but to nobody rendered → dropped.**
 *
 * Rule 5 is the privacy rule, and it is the second disagreement between the
 * copies: three of the four *promoted* such an event into the shared lane and
 * only `member-day-grid.tsx` dropped it, with the argument written out beside
 * it. That argument is right and it is not a matter of taste. The shared lane
 * is captioned "Iedereen" and spans the whole family, so promoting an event
 * attributed only to a member this board does not render — a soft-deleted
 * member, or one a parent unticked from the face row precisely to stop showing
 * their schedule — publishes a hidden person's appointment to everyone
 * standing in front of the wall display. A missing block is a display gap; a
 * leaked one is a privacy failure, and the two are not comparable costs.
 *
 * Both buckets are sorted by `compareForDay`. A caller that wants all-day rows
 * in a separate band (the day grid does) splits on `event.allDay` first and
 * calls this twice, exactly as `bucketByDay` documents.
 */
export function splitByMember<E extends CombinableEvent>(
  events: readonly E[],
  memberIds: readonly string[],
  { timeZone, dayKey }: CombineDayOptions
): MemberSplit<E> {
  const byMember = new Map<string, E[]>(memberIds.map((id) => [id, []]));
  const shared: E[] = [];
  const seen = new Set<string>();

  for (const event of events) {
    if (seen.has(event.key)) continue;
    if (!dayKeysOf(event, timeZone, event.allDay).includes(dayKey)) continue;
    seen.add(event.key);

    if (event.householdWide) {
      shared.push(event);
      continue;
    }

    const participants = new Set<string>(event.attendeeMemberIds);
    if (event.ownerMemberId) participants.add(event.ownerMemberId);

    if (participants.size === 0) {
      shared.push(event);
      continue;
    }

    const rendered = memberIds.filter((id) => participants.has(id));
    // Rule 5 — see the note above. Not `shared.push`, ever.
    if (rendered.length === 0) continue;

    for (const id of rendered) byMember.get(id)!.push(event);
  }

  for (const list of byMember.values()) list.sort(compareForDay);
  shared.sort(compareForDay);

  return { byMember, shared };
}

/**
 * The merge behind the day board's *combined* mode ("alle agenda's").
 *
 * The per-person board answers "what does each of us have today" by putting
 * one copy of an event in every column it belongs to. That duplication is the
 * whole point there — Mila's column must show the dentist appointment she is
 * being taken to — but it is exactly wrong in a single chronological list: one
 * family dinner attended by four people is one line, not four.
 *
 * So this is the inverse operation. Every event that touches the day appears
 * **once**, in time order, carrying the set of members it belongs to so the
 * row can draw their faces. Inside a member column a face means "shared with
 * someone else"; here it means "whose is this", which is the question a merged
 * list cannot otherwise answer.
 */

export type CombinedDayRow<E extends CombinableEvent> = {
  event: E;
  /**
   * Whom the row may **name**: owner plus attendees — or the whole family, for
   * a household event — restricted to members of this family and ordered by the
   * family's own order, never by the order they happened to be attached to the
   * event, so the same two children always stack the same way.
   *
   * **`null` means withheld**, and is what a busy-only event gets. It is a
   * third state on purpose, distinct from `[]`: an empty list means "nobody in
   * particular", which every consumer renders as "Iedereen" and faces for the
   * whole household — a perfectly good answer for an unattributed event and a
   * disclosure for a redacted one, since "this hidden hour is the household's"
   * narrows the alternative to "…and this one is not". `null` is not a longer
   * list; it is a different fact, and its type forces a consumer to say what it
   * draws for it rather than falling through to the everyone branch.
   */
  memberIds: string[] | null;
  /**
   * The same set, unredacted — for **placement and filtering only**.
   *
   * A redacted block still has to appear on the right person's day (that is
   * what `ownerMemberId` survives redaction for), and the day list's member
   * filter is that placement. Nothing rendered as identity may read this: it is
   * the ids, never the names.
   */
  placementMemberIds: string[];
};

/**
 * Events touching `dayKey`, de-duplicated and sorted for a single list.
 *
 * Ordered by `compareForDay`, the same order every bucket in this file uses.
 */
export function combineDayEvents<E extends CombinableEvent>(
  events: readonly E[],
  memberOrder: readonly string[],
  { timeZone, dayKey }: CombineDayOptions
): CombinedDayRow<E>[] {
  const seen = new Set<string>();
  const onDay: E[] = [];

  for (const event of events) {
    if (seen.has(event.key)) continue;
    if (!dayKeysOf(event, timeZone, event.allDay).includes(dayKey)) continue;
    seen.add(event.key);
    onDay.push(event);
  }

  onDay.sort(compareForDay);

  return onDay.map((event) => {
    const placementMemberIds = (() => {
      if (event.householdWide) return [...memberOrder];

      const participants = new Set<string>(event.attendeeMemberIds);
      if (event.ownerMemberId) participants.add(event.ownerMemberId);

      return memberOrder.filter((id) => participants.has(id));
    })();

    // The privacy gate, resolved here rather than at each row that draws a
    // face: a fourth consumer of this function gets a `null` it has to handle,
    // where a fourth consumer of a plain `string[]` would silently name people
    // beside the word "Bezet" — which is exactly how the three surfaces this
    // was found on came to do it.
    return {
      event,
      memberIds: event.busyOnly ? null : placementMemberIds,
      placementMemberIds,
    };
  });
}
