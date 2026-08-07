'use client';

import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { dayKeysOf } from '../domain/expand';
import { toDateKey, toWall } from '../domain/zone';
import type { CalendarEvent } from '../queries';
import { EventChip } from './event-chip';

/**
 * Month grid. Density is the whole design problem here: a month cell is too
 * small for an event *card*, so cells show the first few as compact rows and
 * everything past that as a count. The pips carry the category colors, which
 * is what makes a month scan-able at a glance without reading a word.
 */

export type MonthViewProps = {
  days: Date[];
  events: CalendarEvent[];
  timeZone: string;
  /** The month in focus; days outside it render dimmed. */
  anchor: Date;
  today?: Date | null;
  onSelect?: (event: CalendarEvent) => void;
  /**
   * "+N" opens that day (M18). The count used to be a static `<span>`, which
   * made every event past the third row unreachable from month view — there
   * was no gesture, anywhere, that revealed them. Rather than reproduce
   * legacy's "all events for this day" modal, the count navigates to the day
   * view, which is the surface that already renders exactly that and does it
   * at full size.
   */
  onOpenDay?: (dayKey: string) => void;
};

const MAX_ROWS_PER_CELL = 3;

export function MonthView({
  days,
  events,
  timeZone,
  anchor,
  today,
  onSelect,
  onOpenDay,
}: MonthViewProps) {
  const t = useTranslations('calendar');
  const format = useFormatter();
  const anchorMonth = toWall(anchor, timeZone).month;
  const todayKey = today ? toDateKey(toWall(today, timeZone)) : null;

  const byDay = useMemo(() => {
    const buckets = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      for (const key of dayKeysOf(event, timeZone, event.allDay)) {
        const bucket = buckets.get(key);
        if (bucket) bucket.push(event);
        else buckets.set(key, [event]);
      }
    }
    return buckets;
  }, [events, timeZone]);

  const weekdays = days.slice(0, 7);

  return (
    <div data-slot="month-view" className="flex min-h-0 flex-col">
      <div className="grid grid-cols-7 border-b border-line">
        {weekdays.map((day) => (
          <div
            key={day.toISOString()}
            className="label-overline px-2 py-2 text-center text-ink-muted"
          >
            {format.dateTime(day, { weekday: 'short' })}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7">
        {days.map((day) => {
          const key = toDateKey(toWall(day, timeZone));
          const dayEvents = byDay.get(key) ?? [];
          const outside = toWall(day, timeZone).month !== anchorMonth;
          const isToday = key === todayKey;

          return (
            <div
              key={key}
              data-slot="month-cell"
              data-day={key}
              data-outside={outside || undefined}
              className={cn(
                'flex min-h-24 min-w-0 flex-col gap-1 border-t border-l border-line-subtle p-1',
                outside && 'bg-muted/40'
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'tabular-time text-caption font-semibold',
                    outside ? 'text-ink-muted' : 'text-ink',
                    isToday &&
                      'flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground'
                  )}
                >
                  {format.dateTime(day, { day: 'numeric' })}
                </span>
                {dayEvents.length > MAX_ROWS_PER_CELL &&
                  (onOpenDay ? (
                    <button
                      type="button"
                      data-testid="month-more"
                      data-day={key}
                      aria-label={t('month.openDay', {
                        date: format.dateTime(day, { day: 'numeric', month: 'long' }),
                      })}
                      onClick={() => onOpenDay(key)}
                      className="rounded px-1 text-caption text-ink-muted underline-offset-2 hover:text-ink hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {t('month.more', { count: dayEvents.length - MAX_ROWS_PER_CELL })}
                    </button>
                  ) : (
                    <span className="text-caption text-ink-muted">
                      {t('month.more', { count: dayEvents.length - MAX_ROWS_PER_CELL })}
                    </span>
                  ))}
              </div>

              <div className="flex min-w-0 flex-col gap-0.5">
                {dayEvents.slice(0, MAX_ROWS_PER_CELL).map((event) => (
                  <EventChip
                    key={event.key}
                    event={event}
                    variant="row"
                    showTime={false}
                    onSelect={onSelect}
                    className="border-l-2 px-1 py-0"
                  />
                ))}
              </div>

              {/* Past the row budget, the remaining events survive as pips, so
                  a busy day still reads as busy rather than as a bare count. */}
              {dayEvents.length > MAX_ROWS_PER_CELL && (
                <div className="mt-auto flex gap-0.5">
                  {dayEvents.slice(MAX_ROWS_PER_CELL, MAX_ROWS_PER_CELL + 6).map((event) => (
                    <EventChip key={event.key} event={event} variant="dot" className="w-2" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
