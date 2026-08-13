import { dayKeysOf } from './expand';

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

/** The shape the merge actually reads — `CalendarEvent` satisfies it. */
export type CombinableEvent = {
  /** Stable per instance; two entries with the same key are the same event. */
  key: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  ownerMemberId: string | null;
  attendeeMemberIds: string[];
};

export type CombinedDayRow<E extends CombinableEvent> = {
  event: E;
  /**
   * Owner plus attendees, restricted to members of this family and ordered by
   * the family's own order — never by the order they happened to be attached
   * to the event, so the same two children always stack the same way.
   */
  memberIds: string[];
};

export type CombineDayOptions = {
  timeZone: string;
  /** `YYYY-MM-DD` in the household's zone — see `toDateKey`. */
  dayKey: string;
};

/**
 * Events touching `dayKey`, de-duplicated and sorted for a single list.
 *
 * Order is all-day first (they frame the day rather than sit in it, which is
 * how every other surface in this app draws them), then start, then end, then
 * `key` — the last only so the order is total and a re-render never reshuffles
 * two events that begin and end at the same minute.
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

  onDay.sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    const byStart = a.startsAt.getTime() - b.startsAt.getTime();
    if (byStart !== 0) return byStart;
    const byEnd = a.endsAt.getTime() - b.endsAt.getTime();
    if (byEnd !== 0) return byEnd;
    return a.key.localeCompare(b.key);
  });

  return onDay.map((event) => {
    const participants = new Set<string>(event.attendeeMemberIds);
    if (event.ownerMemberId) participants.add(event.ownerMemberId);

    return { event, memberIds: memberOrder.filter((id) => participants.has(id)) };
  });
}
