import type { SpecialDaySlug } from '@/modules/holidays/domain/nl';
import { specialDays } from '@/modules/holidays/domain/special-days';
import type { CalendarEvent } from '../queries';
import { categoryForType } from './event-type';

/**
 * Special days, as calendar instances.
 *
 * The dates come from the holidays slice (pure, year → `YYYY-MM-DD`); this
 * turns them into the shape every view already knows how to draw. It is a
 * `domain/` module for the reason the boundary rule exists: it is pure, and
 * deep-importing `@/modules/holidays/domain/special-days` is the sanctioned
 * domain-to-domain exception. The `CalendarEvent` import is type-only, so
 * nothing of `queries.ts` — least of all its `server-only` and its database
 * client — is in this file's runtime graph.
 *
 * Three deliberate properties, each of which some surface depends on:
 *
 * - **All-day, in UTC.** M05 stores an all-day event's bounds as UTC midnights
 *   precisely so they carry no zone (`dayKeysOf`'s note), and a special day is
 *   the purest example of a date that is not an instant: Eerste Kerstdag is the
 *   25th, not "the 25th in Amsterdam". Producing the same shape means every
 *   existing bucketer handles them with no special case.
 * - **Household-wide.** Koningsdag belongs to nobody in particular, so it
 *   carries no owner and no attendees and `householdWide: true` — which is what
 *   puts it in the "Iedereen" block of the today tabs and the hub board rather
 *   than duplicating it into four person columns (`groupByMember`).
 * - **Not editable.** See `holidayEvent` below.
 */

export type HolidayEventOptions = {
  /** The window being rendered, `[from, to)` — the loader's own. */
  from: Date;
  to: Date;
  /** `holidays.days.<slug>` resolved by the caller — this module holds no i18n. */
  name: (slug: SpecialDaySlug) => string;
};

/**
 * Every special day overlapping `[from, to)`.
 *
 * Years are taken from the window's own UTC bounds rather than from a single
 * "current" year: a week view straddling New Year, and the month view that pads
 * into December, both ask for two years' worth and would otherwise lose
 * whichever half fell on the far side of the boundary. Computing a spare year
 * costs seventeen objects that the overlap filter then drops.
 */
export function holidayEvents(options: HolidayEventOptions): CalendarEvent[] {
  const { from, to, name } = options;
  if (!(from.getTime() < to.getTime())) return [];

  const events: CalendarEvent[] = [];

  for (let year = from.getUTCFullYear(); year <= to.getUTCFullYear(); year += 1) {
    for (const day of specialDays(year)) {
      const startsAt = new Date(`${day.date}T00:00:00Z`);
      const endsAt = new Date(startsAt.getTime() + 86_400_000);

      // The same half-open overlap `listEvents` selects stored rows with, so a
      // special day appears in exactly the windows a one-day all-day event
      // would.
      if (startsAt.getTime() >= to.getTime() || endsAt.getTime() <= from.getTime()) continue;

      events.push(holidayEvent(day.date, day.slug, name(day.slug), startsAt, endsAt));
    }
  }

  return events;
}

/**
 * One special day as a `CalendarEvent`.
 *
 * Read-only is enforced by the two flags the whole UI already asks — nothing
 * new was invented for it:
 *
 * - `editable: false` — `calendar-shell.tsx` refuses to open the edit dialog,
 *   `event-chip.tsx` and `day-agenda-row.tsx` render a non-interactive chip (no
 *   `role="button"`, no tab stop), and `use-drag-reschedule.ts` ignores the
 *   pointer. So a special day can be seen and never saved, dragged or deleted.
 * - `calendarId: null` and no database row — the mutation path is unreachable
 *   by construction, not merely refused. Every write in `actions.ts` starts
 *   from `getEvent(familyId, eventId)`, and there is no row for
 *   `holiday:2026-04-05:easterSunday` to find; the Google push
 *   (`pushEventWithRetry(eventId)`) is likewise driven off stored rows, which a
 *   synthetic instance never is.
 *
 * The type is `holiday`, which the taxonomy already carries — so the hue
 * (orange) and the glyph (`beach_access`) come from `EVENT_TYPE_CATEGORY`
 * rather than from a second, competing source. That is the whole point of M23's
 * "colour is a function of type". The day's *own* accent and emoji are a
 * festive cue on top of that, and they live where the festivity does: the month
 * cell and the vandaag header, both of which read the holidays slice directly.
 */
function holidayEvent(
  date: string,
  slug: SpecialDaySlug,
  title: string,
  startsAt: Date,
  endsAt: Date
): CalendarEvent {
  // Stable across renders and across years — the key React lists on and the one
  // an offline mirror snapshot can be diffed by.
  const key = `holiday:${date}:${slug}`;

  return {
    key,
    // No row exists to address; the id is the key so nothing can silently
    // collide with a real `seriesId` (a UUID never contains a colon).
    seriesId: key,
    title,
    description: null,
    location: null,
    startsAt,
    endsAt,
    allDay: true,
    // All-day bounds are UTC midnights by convention, so the zone that
    // describes them is UTC — see the note at the top of this file.
    tz: 'UTC',
    ownerMemberId: null,
    attendeeMemberIds: [],
    eventType: 'holiday',
    category: categoryForType('holiday'),
    calendarId: null,
    calendarSummary: null,
    isRecurringInstance: false,
    recurring: false,
    rrule: null,
    pendingSync: false,
    busyOnly: false,
    editable: false,
    householdWide: true,
  };
}
