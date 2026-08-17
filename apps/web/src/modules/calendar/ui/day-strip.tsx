'use client';

import { useMemo } from 'react';
import { useDateTimeFormat } from '@/components/formatting';
import { DateCircle } from '@kynite/ui';
import { bucketByDay } from '../domain/day-board';
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

  // Only the *set* of busy days — the strip asks "which days are busy", never
  // "how busy" — so the buckets are thrown away and their keys kept, which is
  // the shape `bucketByDay` documents for this caller.
  const busyKeys = useMemo(
    () => new Set(bucketByDay(events, { timeZone }).keys()),
    [events, timeZone]
  );

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
            className="flex flex-1 flex-col items-center rounded-xl py-0.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default"
          >
            {/* `dot={true}` is exactly the mark this strip drew by hand: brand
                on the filled day, `--line` otherwise. A day with nothing on it
                still gets a node rather than `false`, so the empty slot holds
                its 4px and a week with one busy day does not sit taller than a
                week with none. */}
            <DateCircle
              label={formatDateTime(day, { weekday: 'short' })}
              number={formatDateTime(day, { day: 'numeric' })}
              state={
                selected ? 'selected' : key === todayKey ? 'today' : weekend ? 'muted' : 'default'
              }
              dot={dots ? busyKeys.has(key) || <span className="size-1" /> : false}
            />
          </button>
        );
      })}
    </div>
  );
}
