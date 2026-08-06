'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { useFormatter } from 'next-intl';
import { cn } from '@/lib/utils';
import { dayKeysOf } from '../domain/expand';
import { minutesIntoDay, toDateKey, toWall } from '../domain/zone';
import type { CalendarEvent } from '../queries';
import { EventChip } from './event-chip';
import { GRID_END_HOUR, GRID_START_HOUR, HOUR_HEIGHT } from './tokens';
import { useDragReschedule } from './use-drag-reschedule';

/**
 * The shared day/week time grid.
 *
 * Day view is this component with one column; week view is the same component
 * with seven. Keeping them one component is what keeps drag-and-drop, overlap
 * layout, the now-line and the all-day row from drifting apart between two
 * views that are the same thing at different widths.
 */

export type TimeGridProps = {
  days: Date[];
  events: CalendarEvent[];
  timeZone: string;
  /** Rendered as "now" — passed in rather than read, so snapshots are stable. */
  now?: Date | null;
  onSelect?: (event: CalendarEvent) => void;
  hub?: boolean;
};

type Positioned = {
  event: CalendarEvent;
  top: number;
  height: number;
  /** Horizontal share of the column, for events that overlap in time. */
  columnIndex: number;
  columnCount: number;
};

const GRID_HOURS = GRID_END_HOUR - GRID_START_HOUR;

/**
 * Overlap layout: events that share time split the column between them.
 *
 * A greedy sweep, not a graph colouring — for a family's day, "how many events
 * are live at this moment" is the only question worth answering, and it gives
 * the same answer with none of the machinery.
 */
function layout(events: CalendarEvent[], timeZone: string): Positioned[] {
  const sorted = [...events].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime() || b.endsAt.getTime() - a.endsAt.getTime()
  );

  const positioned: Positioned[] = [];
  let cluster: CalendarEvent[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const [index, event] of cluster.entries()) {
      positioned.push({
        event,
        ...verticalSpan(event, timeZone),
        columnIndex: index,
        columnCount: cluster.length,
      });
    }
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const event of sorted) {
    if (event.startsAt.getTime() >= clusterEnd) flush();
    cluster.push(event);
    clusterEnd = Math.max(clusterEnd, event.endsAt.getTime());
  }
  flush();

  return positioned;
}

/** Where a block sits vertically, in px, clamped to the rendered hour range. */
function verticalSpan(event: CalendarEvent, timeZone: string): { top: number; height: number } {
  const startMinutes = minutesIntoDay(event.startsAt, timeZone);
  const rawEnd = minutesIntoDay(event.endsAt, timeZone);
  // An event ending past midnight reads as ending at the bottom of the day.
  const endMinutes = rawEnd <= startMinutes ? GRID_END_HOUR * 60 : rawEnd;

  const top = ((startMinutes - GRID_START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 22);

  return { top, height };
}

export function TimeGrid({ days, events, timeZone, now, onSelect, hub = false }: TimeGridProps) {
  const format = useFormatter();
  const columnsRef = useRef<HTMLDivElement>(null);
  const [columnWidth, setColumnWidth] = useState(0);

  // Measured rather than computed: the column width is whatever flex resolved
  // to, and a drag has to agree with what the user can see.
  useEffect(() => {
    const element = columnsRef.current;
    if (!element) return;

    const measure = () => setColumnWidth(element.clientWidth / Math.max(days.length, 1));
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [days.length]);

  const dayKeys = useMemo(
    () => days.map((day) => toDateKey(toWall(day, timeZone))),
    [days, timeZone]
  );

  const { timed, allDay } = useMemo(() => {
    const timedByDay = new Map<string, CalendarEvent[]>(dayKeys.map((key) => [key, []]));
    const allDayByDay = new Map<string, CalendarEvent[]>(dayKeys.map((key) => [key, []]));

    for (const event of events) {
      const target = event.allDay ? allDayByDay : timedByDay;
      for (const key of dayKeysOf(event, timeZone, event.allDay)) {
        target.get(key)?.push(event);
      }
    }

    return { timed: timedByDay, allDay: allDayByDay };
  }, [events, dayKeys, timeZone]);

  const drag = useDragReschedule({
    // Day view is a single column: there is no other day to drag into.
    columnWidth: days.length > 1 ? columnWidth : 0,
    columnCount: days.length,
    columnIndexOf: (event) => {
      const key = dayKeysOf(event, timeZone, event.allDay)[0];
      return Math.max(dayKeys.indexOf(key), 0);
    },
  });

  const hours = Array.from({ length: GRID_HOURS + 1 }, (_, index) => GRID_START_HOUR + index);
  const nowKey = now ? toDateKey(toWall(now, timeZone)) : null;
  const nowTop = now
    ? ((minutesIntoDay(now, timeZone) - GRID_START_HOUR * 60) / 60) * HOUR_HEIGHT
    : 0;

  return (
    <div data-slot="time-grid" className="flex min-h-0 flex-col">
      {/* Day headers */}
      <div className="flex border-b border-line pl-14">
        {days.map((day, index) => (
          <div
            key={dayKeys[index]}
            className={cn(
              'flex-1 px-1 py-2 text-center',
              nowKey === dayKeys[index] && 'bg-accent/40'
            )}
          >
            <div className="label-overline text-ink-muted">
              {format.dateTime(day, { weekday: 'short' })}
            </div>
            <div
              className={cn(
                'tabular-time font-display font-bold',
                hub ? 'text-h2' : 'text-body-lg',
                nowKey === dayKeys[index] ? 'text-brand-ink' : 'text-ink'
              )}
            >
              {format.dateTime(day, { day: 'numeric' })}
            </div>
          </div>
        ))}
      </div>

      {/* All-day row: dates, not times, so they cannot live on the hour grid. */}
      {dayKeys.some((key) => (allDay.get(key)?.length ?? 0) > 0) && (
        <div className="flex border-b border-line pl-14" data-slot="all-day-row">
          {dayKeys.map((key) => (
            <div key={key} className="flex flex-1 flex-col gap-1 p-1">
              {(allDay.get(key) ?? []).map((event) => (
                <EventChip
                  key={event.key}
                  event={event}
                  variant="row"
                  showTime={false}
                  hub={hub}
                  onSelect={onSelect}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 overflow-y-auto">
        {/* Hour gutter */}
        <div className="w-14 shrink-0" aria-hidden>
          {hours.slice(0, -1).map((hour) => (
            <div
              key={hour}
              style={{ height: HOUR_HEIGHT }}
              className="relative -top-2 pr-2 text-right tabular-time text-caption text-ink-muted"
            >
              {String(hour).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        <div ref={columnsRef} className="relative flex flex-1">
          {/* Hour lines, drawn once behind every column. */}
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute inset-x-0 border-t border-line-subtle"
                style={{ top: (hour - GRID_START_HOUR) * HOUR_HEIGHT }}
              />
            ))}
          </div>

          {dayKeys.map((key) => (
            <div
              key={key}
              data-slot="day-column"
              data-day={key}
              className={cn(
                'relative flex-1 border-l border-line-subtle',
                nowKey === key && 'bg-accent/20'
              )}
              style={{ height: GRID_HOURS * HOUR_HEIGHT }}
            >
              {layout(timed.get(key) ?? [], timeZone).map((positioned) => {
                const offset = drag.offsetFor(positioned.event);
                const isDragging = drag.drag?.key === positioned.event.key;
                const width = 100 / positioned.columnCount;

                return (
                  <EventChip
                    key={positioned.event.key}
                    event={positioned.event}
                    variant="block"
                    hub={hub}
                    onSelect={onSelect}
                    onPointerDown={drag.onPointerDown}
                    className={cn(
                      'touch-none',
                      isDragging && 'z-30 opacity-90 shadow-lg',
                      positioned.event.editable && 'cursor-grab active:cursor-grabbing'
                    )}
                    style={{
                      top: positioned.top + offset.top,
                      height: positioned.height,
                      left: `calc(${positioned.columnIndex * width}% + 2px)`,
                      width: `calc(${width}% - 4px)`,
                      transform: offset.left ? `translateX(${offset.left}px)` : undefined,
                      right: 'auto',
                    }}
                  />
                );
              })}

              {nowKey === key && (
                <div
                  data-testid="now-line"
                  className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-now"
                  style={{ top: nowTop }}
                >
                  <span className="absolute -top-1 -left-1 size-2 rounded-full bg-now" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { layout as layoutForTests };
