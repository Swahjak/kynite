'use client';

import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
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
  onSelect?: (event: CalendarEvent) => void;
};

export function AgendaView({ days, events, timeZone, today, onSelect }: AgendaViewProps) {
  const t = useTranslations('calendar');
  const format = useFormatter();
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
    return (
      <div
        data-slot="agenda-view"
        className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center"
      >
        <Icon name="event_available" size="2xl" className="text-ink-muted" />
        <p className="text-body text-ink-secondary">{t('empty')}</p>
      </div>
    );
  }

  return (
    <div data-slot="agenda-view" className="flex min-h-0 flex-1 flex-col divide-y divide-line">
      {groups.map((group) => {
        const wall = parseDateKey(group.key);
        const date = wall ? fromWall(wall, timeZone) : new Date(group.key);
        const isToday = group.key === todayKey;

        return (
          <section key={group.key} data-day={group.key} className="flex gap-4 px-4 py-3">
            <div className="w-16 shrink-0 text-center">
              <div className="label-overline text-ink-muted">
                {format.dateTime(date, { weekday: 'short' })}
              </div>
              <div
                className={cn(
                  'tabular-time text-h2 font-bold',
                  isToday ? 'text-brand-ink' : 'text-ink'
                )}
              >
                {format.dateTime(date, { day: 'numeric' })}
              </div>
              <div className="text-caption text-ink-muted">
                {format.dateTime(date, { month: 'short' })}
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {group.events.map((event) => (
                <EventChip key={event.key} event={event} variant="row" onSelect={onSelect} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
