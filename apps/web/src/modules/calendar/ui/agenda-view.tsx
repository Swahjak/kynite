'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { cn, DateCircle, EmptyState } from '@kynite/ui';
// Type-only: `@/modules/family` re-exports `server-only` queries, so a value
// import would drag the Postgres client into this client bundle.
import type { Member } from '@/modules/family';
import { bucketByDay } from '../domain/day-board';
import { parseDateKey, toDateKey, toWall, fromWall } from '../domain/zone';
import type { CalendarEvent } from '../queries';
import { EventChip } from './event-chip';

/**
 * Agenda: a flat, chronological list grouped by day, with empty days omitted.
 *
 * Omitting empty days is the point of the view — it answers "what is coming
 * up" rather than "what does the month look like", so thirty rows of nothing
 * would be noise. The other three views already show shape; this one shows
 * sequence.
 */

export type AgendaViewProps = {
  days: Date[];
  events: CalendarEvent[];
  /** Resolves each card's owner face — see `EventChip`'s `showOwner`. */
  members?: Member[];
  timeZone: string;
  today?: Date | null;
  /** Hub surfaces render at 6-foot legibility — see `EventChip`'s `hub` prop. */
  hub?: boolean;
  onSelect?: (event: CalendarEvent) => void;
};

export function AgendaView({
  days,
  events,
  members,
  timeZone,
  today,
  hub = false,
  onSelect,
}: AgendaViewProps) {
  const t = useTranslations('calendar');
  const formatDateTime = useDateTimeFormat();
  const todayKey = today ? toDateKey(toWall(today, timeZone)) : null;

  const groups = useMemo(() => {
    // No `seedEmpty`: this view lists only the days something happens on, so a
    // pre-created empty bucket would draw a date heading over nothing. The
    // buckets arrive sorted by `bucketByDay`'s one order (all-day first), which
    // is why there is no per-group sort left here.
    const buckets = bucketByDay(events, {
      timeZone,
      dayKeys: days.map((day) => toDateKey(toWall(day, timeZone))),
    });

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, dayEvents]) => ({ key, events: dayEvents }));
  }, [days, events, timeZone]);

  if (groups.length === 0) {
    // The shared zero-state block rather than a hand-rolled icon + line
    // (`docs/design/README.md` § "Component library": "do not hand-roll a shape
    // that is already here"). `hub` renders the same state at kiosk type size.
    return (
      <div data-slot="agenda-view" className="flex flex-1 flex-col justify-center">
        <EmptyState size={hub ? 'hub' : 'page'} icon="event_available" title={t('empty')} />
      </div>
    );
  }

  return (
    <div
      data-slot="agenda-view"
      className="flex min-h-0 flex-1 flex-col divide-y divide-line-subtle"
    >
      {groups.map((group) => {
        const wall = parseDateKey(group.key);
        const date = wall ? fromWall(wall, timeZone) : new Date(group.key);
        const isToday = group.key === todayKey;

        return (
          <section
            key={group.key}
            data-day={group.key}
            className={cn(
              // No row tint on today: the spec gives the *date pill* the
              // selected treatment and leaves the row on the card's own white,
              // so the day reads as marked without a second, weaker signal.
              'flex gap-3.5 px-5 py-3.5 transition-colors',
              hub && 'gap-6 px-6 py-5'
            )}
          >
            {/* The date rail — 44px on the phone, per `Kalender.dc.html`:
                an overline weekday over a filled circle for the day in focus.
                The rail used to be a whole tinted block carrying weekday,
                date *and* month; a circle around the number is the same mark
                the week strip and the month grid make, and three marks that
                agree read as one system. */}
            <div className={cn('shrink-0 text-center', hub ? 'w-20' : 'w-11')}>
              {/* `selected`, not `today`: an agenda has no day *in focus* of
                  its own, so today is the one day this list marks and it keeps
                  the fill it has always had. `today`'s colour-only treatment
                  exists for strips that can be browsed away from today, which
                  this rail cannot. */}
              <DateCircle
                label={formatDateTime(date, { weekday: 'short' })}
                number={formatDateTime(date, { day: 'numeric' })}
                state={isToday ? 'selected' : 'default'}
                size={hub ? 'xl' : 'lg'}
              />
              <span className={`mt-0.5 block text-ink-muted ${hub ? 'text-body' : 'text-caption'}`}>
                {formatDateTime(date, { month: 'short' })}
              </span>
            </div>

            <div className={cn('flex min-w-0 flex-1 flex-col gap-2', hub && 'gap-3')}>
              {group.events.map((event) => (
                <EventChip
                  key={event.key}
                  event={event}
                  variant="card"
                  showOwner
                  showPeople
                  members={members}
                  hub={hub}
                  past={!!today && !event.allDay && event.endsAt.getTime() <= today.getTime()}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
