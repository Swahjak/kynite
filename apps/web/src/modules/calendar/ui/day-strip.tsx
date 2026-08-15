'use client';

import { useMemo } from 'react';
import { useDateTimeFormat } from '@/components/formatting';
import { CategoryDot, cn } from '@kynite/ui';
import { dayKeysOf } from '../domain/expand';
import { toDateKey, toWall } from '../domain/zone';
import type { CalendarEvent } from '../queries';

/**
 * The phone's week strip — seven days across the top of the day view.
 *
 * `Kalender.dc.html` draws it as a dow label, a 32px date circle (filled in
 * `--primary` for the day being shown) and a 4px dot underneath that says
 * "something happens here" without saying what. The dot is deliberately *not*
 * one pip per event: at 46px per column a count would be unreadable, and the
 * question the strip answers is "which days are busy", not "how busy".
 */

export type DayStripProps = {
  /** The seven days of the visible week, in display order. */
  days: Date[];
  events: CalendarEvent[];
  timeZone: string;
  /** The day currently in focus; drawn filled. */
  selectedKey: string;
  today?: Date | null;
  /** Weekend numbers recede — 0 is Sunday, matching `Date#getDay`. */
  onSelectDay?: (dayKey: string) => void;
  /** Off for the week view: the list underneath already names every day. */
  dots?: boolean;
};

export function DayStrip({
  days,
  events,
  timeZone,
  selectedKey,
  today,
  onSelectDay,
  dots = true,
}: DayStripProps) {
  const formatDateTime = useDateTimeFormat();
  const todayKey = today ? toDateKey(toWall(today, timeZone)) : null;

  const busyKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const event of events) {
      for (const key of dayKeysOf(event, timeZone, event.allDay)) keys.add(key);
    }
    return keys;
  }, [events, timeZone]);

  return (
    <div
      data-slot="day-strip"
      className="flex shrink-0 justify-between gap-0.5 border-b border-line-subtle px-3 pt-1.5 pb-2.5"
    >
      {days.map((day) => {
        const key = toDateKey(toWall(day, timeZone));
        const selected = key === selectedKey;
        const weekend = day.getDay() === 0 || day.getDay() === 6;

        return (
          <button
            key={key}
            type="button"
            data-slot="day-strip-day"
            data-day={key}
            data-selected={selected || undefined}
            aria-current={selected ? 'date' : undefined}
            onClick={onSelectDay ? () => onSelectDay(key) : undefined}
            disabled={!onSelectDay}
            className="flex flex-1 flex-col items-center gap-1 rounded-xl py-0.5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default"
          >
            <span className="label-overline text-ink-muted">
              {formatDateTime(day, { weekday: 'short' })}
            </span>
            <span
              className={cn(
                'tabular-time inline-flex size-8 items-center justify-center rounded-full font-display text-body-sm font-bold',
                selected && 'bg-primary text-primary-foreground',
                !selected && key === todayKey && 'text-primary',
                !selected && key !== todayKey && weekend && 'text-ink-muted'
              )}
            >
              {formatDateTime(day, { day: 'numeric' })}
            </span>
            {dots ? (
              <CategoryDot
                size="xs"
                className={cn(
                  busyKeys.has(key) ? (selected ? 'bg-primary' : 'bg-line') : 'bg-transparent'
                )}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
