'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/kynite';
import { dayKeysOf } from '../domain/expand';
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
  timeZone: string;
  today?: Date | null;
  /** Hub surfaces render at 6-foot legibility — see `EventChip`'s `hub` prop. */
  hub?: boolean;
  onSelect?: (event: CalendarEvent) => void;
};

export function AgendaView({
  days,
  events,
  timeZone,
  today,
  hub = false,
  onSelect,
}: AgendaViewProps) {
  const t = useTranslations('calendar');
  const formatDateTime = useDateTimeFormat();
  const todayKey = today ? toDateKey(toWall(today, timeZone)) : null;

  const groups = useMemo(() => {
    const buckets = new Map<string, CalendarEvent[]>();
    const windowKeys = new Set(days.map((day) => toDateKey(toWall(day, timeZone))));

    for (const event of events) {
      for (const key of dayKeysOf(event, timeZone, event.allDay)) {
        if (!windowKeys.has(key)) continue;
        const bucket = buckets.get(key);
        if (bucket) bucket.push(event);
        else buckets.set(key, [event]);
      }
    }

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, dayEvents]) => ({
        key,
        events: dayEvents.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
      }));
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
      {groups.map((group, index) => {
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
              'flex gap-4 px-4 py-4 transition-colors',
              hub && 'gap-6 px-6 py-5'
            )}
          >
            {/* The time/date column of `calendar.md` § "Day agenda": a fixed,
                centred rail (44px there; wider here because this rail carries a
                whole date rather than one `HH:mm`), with a vertical connector
                running from it to the next day — `width:1px;flex:1;
                background:#c4c5d9;` — on every row but the last. The day the
                board is showing takes the week strip's selected treatment:
                "`background:#5d5fef;` with label `color:rgba(255,255,255,0.75)`
                and date `font-weight:700;color:#ffffff`". */}
            <div className={cn('flex shrink-0 flex-col items-center', hub ? 'w-24' : 'w-16')}>
              <div
                className={cn(
                  'flex w-full flex-col items-center gap-1.5 rounded-xl py-2 text-center',
                  isToday && 'bg-primary'
                )}
              >
                {/* Plain string interpolation, not `cn()`, for the three lines
                  below: `text-h2`/`text-caption`/`text-body`/`text-display-md`
                  are this design system's custom font-size scale, which
                  `tailwind-merge` (inside `cn()`) does not recognize — it
                  buckets an unrecognized `text-*` token into the same
                  conflict group as a real `text-*` *color* utility and drops
                  whichever one of the two came first, no matter which one is
                  actually the size. Routing these through `cn()` silently
                  strips the size (or the color); a plain string has no
                  conflict resolver to fool. */}
                <div
                  className={`label-overline ${hub ? 'text-body' : ''} ${isToday ? 'text-primary-foreground' : 'text-ink-muted'}`}
                >
                  {formatDateTime(date, { weekday: 'short' })}
                </div>
                <div
                  className={`tabular-time font-bold ${hub ? 'text-display-md' : 'text-h2'} ${isToday ? 'text-primary-foreground' : 'text-ink'}`}
                >
                  {formatDateTime(date, { day: 'numeric' })}
                </div>
                <div
                  className={`${hub ? 'text-body' : 'text-caption'} ${isToday ? 'text-primary-foreground' : 'text-ink-muted'}`}
                >
                  {formatDateTime(date, { month: 'short' })}
                </div>
              </div>

              {/* The connector, omitted on the last row exactly as the spec
                  omits it — a line running off the bottom of the list would
                  promise a day that is not there. */}
              {index < groups.length - 1 ? (
                <span aria-hidden className="mt-1 w-px flex-1 bg-line" />
              ) : null}
            </div>

            <div className={cn('flex min-w-0 flex-1 flex-col gap-1.5', hub && 'gap-2')}>
              {group.events.map((event) => (
                <div key={event.key} className="flex min-w-0 flex-col gap-0.5">
                  <EventChip event={event} variant="row" hub={hub} onSelect={onSelect} />
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
