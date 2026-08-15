'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { cn } from '@kynite/ui';
import type { Member } from '@/modules/family';
import { bucketByDay } from '../domain/day-board';
import { dayKeysOf } from '../domain/expand';
import { minutesIntoDay, toDateKey, toWall } from '../domain/zone';
import type { CalendarEvent } from '../queries';
import { EventChip } from './event-chip';
import { GRID_END_HOUR, GRID_START_HOUR, HOUR_HEIGHT } from './tokens';
import { useDragReschedule } from './use-drag-reschedule';

/**
 * The week time grid — one column per day.
 *
 * Until M19 this was the day view too, at 1/7th the width. Day view now reads
 * per *member* (`member-day-grid.tsx`, the stitch composition), and this
 * component stays the week grid it always was; the hub still renders it for
 * both. The overlap `layout()` is shared with the member grid rather than
 * reimplemented there — it is the one piece of this file that is about time
 * rather than about days.
 */

export type TimeGridProps = {
  days: Date[];
  events: CalendarEvent[];
  /** Resolves each chip's owner face — see `EventChip`'s `showOwner`. */
  members: Member[];
  timeZone: string;
  /** Rendered as "now" — passed in rather than read, so snapshots are stable. */
  now?: Date | null;
  onSelect?: (event: CalendarEvent) => void;
  hub?: boolean;
  /**
   * Off for the phone's day view, which is this grid with a single column and
   * a `DayStrip` above it — the strip already names the day, and a second
   * header under it would say it twice.
   */
  showHeader?: boolean;
};

type Positioned = {
  event: CalendarEvent;
  top: number;
  height: number;
  /** Horizontal share of the column, for events that overlap in time. */
  columnIndex: number;
  columnCount: number;
  /** The block began before this day, or before the first rendered hour. */
  continuesBefore: boolean;
  /** The block runs past this day, or past the last rendered hour. */
  continuesAfter: boolean;
};

const MINUTES_PER_DAY = 1440;

const GRID_HOURS = GRID_END_HOUR - GRID_START_HOUR;

/**
 * Overlap layout: events that share time split the column between them.
 *
 * A greedy sweep, not a graph colouring — for a family's day, "how many events
 * are live at this moment" is the only question worth answering, and it gives
 * the same answer with none of the machinery.
 */
function layout(events: CalendarEvent[], timeZone: string, dayKey: string): Positioned[] {
  const sorted = [...events].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime() || b.endsAt.getTime() - a.endsAt.getTime()
  );

  const positioned: Positioned[] = [];
  let cluster: CalendarEvent[] = [];
  let clusterEnd = -Infinity;

  // Greedy first-free-column assignment: an event takes the lowest-index
  // column whose last-placed event has already ended by this event's start
  // (touching is fine — `end === start` does not overlap). This is what lets
  // a run of short, disjoint events share one column instead of each opening
  // its own, which is what produced the "waterfall" — a single long event
  // plus several short, non-overlapping ones fanning out into as many columns
  // as there were short events.
  const flush = () => {
    const columnEnds: number[] = [];
    const columnIndexOf = new Map<CalendarEvent, number>();

    for (const event of cluster) {
      const start = event.startsAt.getTime();
      let column = columnEnds.findIndex((end) => end <= start);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(-Infinity);
      }
      columnEnds[column] = event.endsAt.getTime();
      columnIndexOf.set(event, column);
    }

    for (const event of cluster) {
      positioned.push({
        event,
        ...verticalSpan(event, timeZone, dayKey),
        columnIndex: columnIndexOf.get(event)!,
        columnCount: columnEnds.length,
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

/**
 * Where a block sits vertically on **this** day, in px.
 *
 * The span is day-relative, not clock-relative: `minutesIntoDay` alone answers
 * "what time is it", which is the wrong question for a block that crosses
 * midnight. A 22:00 → 02:00 event has to draw as 22:00 → end-of-day on the day
 * it starts and as start-of-day → 02:00 on the day it ends; taking the raw
 * minutes on the second day would put it at 22:00 there too, i.e. on the wrong
 * day entirely (and the old `rawEnd <= start ? bottom` guard turned the second
 * day's copy into a four-hour block starting at 22:00).
 *
 * The result is then clamped into the rendered hour window. An event before
 * `GRID_START_HOUR` used to produce a negative `top` and float above the grid;
 * it now parks on the first hour line and the chip carries a clip cue instead
 * (`continuesBefore` / `continuesAfter`).
 */
function verticalSpan(
  event: CalendarEvent,
  timeZone: string,
  dayKey: string
): { top: number; height: number; continuesBefore: boolean; continuesAfter: boolean } {
  const startKey = toDateKey(toWall(event.startsAt, timeZone));
  const endKey = toDateKey(toWall(event.endsAt, timeZone));

  const dayStart = startKey === dayKey ? minutesIntoDay(event.startsAt, timeZone) : 0;
  // An end that lands on a later wall day — including exactly midnight, which
  // reads as 00:00 of the next day — fills this day to the bottom.
  const dayEnd = endKey === dayKey ? minutesIntoDay(event.endsAt, timeZone) : MINUTES_PER_DAY;

  const windowTop = GRID_START_HOUR * 60;
  const windowBottom = GRID_END_HOUR * 60;

  const start = Math.min(Math.max(dayStart, windowTop), windowBottom);
  const end = Math.min(Math.max(dayEnd, start), windowBottom);

  return {
    top: ((start - windowTop) / 60) * HOUR_HEIGHT,
    height: Math.max(((end - start) / 60) * HOUR_HEIGHT, 22),
    continuesBefore: dayStart < windowTop,
    continuesAfter: dayEnd > windowBottom,
  };
}

export function TimeGrid({
  days,
  events,
  members,
  timeZone,
  now,
  onSelect,
  hub = false,
  showHeader = true,
}: TimeGridProps) {
  const t = useTranslations('calendar');
  const formatDateTime = useDateTimeFormat();
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

  // Two maps, because the two bands are two axes: the all-day rows sit in a
  // header above the hour columns and never on them. That split is the
  // caller's, per `bucketByDay` — hence two calls over the two halves of the
  // list. `seedEmpty` keeps a column that nothing happens in an array rather
  // than `undefined`, which is what the render below indexes into.
  const { timed, allDay } = useMemo(() => {
    const options = { timeZone, dayKeys, seedEmpty: true };
    return {
      timed: bucketByDay(
        events.filter((event) => !event.allDay),
        options
      ),
      allDay: bucketByDay(
        events.filter((event) => event.allDay),
        options
      ),
    };
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
      {/* Day headers. `Kalender.dc.html` marks today with a **filled circle
          around the date**, not by tinting the whole cell — the cell tint is
          reserved for the column below, at `bg-primary/4`, so the two cues are
          "this is the date" and "this is the column" rather than one loud
          block. Weekend numbers recede to `--ink-muted`. */}
      {showHeader && (
        <div className="flex border-b border-line-subtle pt-1 pb-1 pl-14">
          {days.map((day, index) => {
            const isToday = nowKey === dayKeys[index];
            const weekend = day.getDay() === 0 || day.getDay() === 6;

            return (
              <div
                key={dayKeys[index]}
                className="flex flex-1 flex-col items-center gap-1 border-l border-line-subtle py-2.5"
              >
                <div className="label-overline text-ink-muted">
                  {formatDateTime(day, { weekday: 'short' })}
                </div>
                <div
                  className={cn(
                    'tabular-time inline-flex items-center justify-center rounded-full font-display font-bold',
                    hub ? 'size-10 text-h2' : 'size-8 text-body',
                    isToday && 'bg-primary text-primary-foreground',
                    !isToday && weekend && 'text-ink-muted',
                    !isToday && !weekend && 'text-ink'
                  )}
                >
                  {formatDateTime(day, { day: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All-day row: dates, not times, so they cannot live on the hour grid.
          The gutter carries a "hele dag" label rather than a blank 56px, which
          is what tells a reader the band is a *different axis* from the hours
          starting underneath it. */}
      {dayKeys.some((key) => (allDay.get(key)?.length ?? 0) > 0) && (
        <div
          className="flex border-b border-line-subtle bg-surface-container-low"
          data-slot="all-day-row"
        >
          <div className="flex w-14 shrink-0 items-center justify-end pr-2">
            <span className="text-caption text-ink-muted">{t('allDay')}</span>
          </div>
          {dayKeys.map((key) => (
            <div key={key} className="flex flex-1 flex-col gap-1 border-l border-line-subtle p-1">
              {(allDay.get(key) ?? []).map((event) => (
                <EventChip
                  key={event.key}
                  event={event}
                  variant="row"
                  showTime={false}
                  showOwner
                  members={members}
                  hub={hub}
                  onSelect={onSelect}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* `pt-2` matches the `-top-2` the hour labels are lifted by, so the
          first one ("06:00") is not sheared off by the scroll container's
          top edge. Gutter and columns both sit inside it, so the labels stay
          aligned to their rules. */}
      <div className="relative flex min-h-0 flex-1 overflow-y-auto pt-2">
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
                // 4%, not 20%: today's column is a *hint* that the eye lands
                // on, and a tint strong enough to read as a surface competes
                // with the event blocks sitting on it.
                nowKey === key && 'bg-primary/4'
              )}
              style={{ height: GRID_HOURS * HOUR_HEIGHT }}
            >
              {layout(timed.get(key) ?? [], timeZone, key).map((positioned) => {
                const offset = drag.offsetFor(positioned.event);
                const isDragging = drag.drag?.key === positioned.event.key;
                const width = 100 / positioned.columnCount;

                return (
                  <EventChip
                    key={positioned.event.key}
                    event={positioned.event}
                    variant="block"
                    showOwner
                    members={members}
                    hub={hub}
                    past={
                      !!now &&
                      !positioned.event.allDay &&
                      positioned.event.endsAt.getTime() <= now.getTime()
                    }
                    onSelect={onSelect}
                    onPointerDown={drag.onPointerDown}
                    suppressClick={drag.shouldIgnoreClick}
                    continuesBefore={positioned.continuesBefore}
                    continuesAfter={positioned.continuesAfter}
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
            </div>
          ))}

          {/* One line across every column, not a line inside today's.
              "Kalender.dc.html":141/215 draws it from the gutter's edge to the
              grid's right edge in both the day and the *week* view — the hour
              it marks is the same hour on Tuesday as on Friday, and a rule
              that stopped at one column read as a property of that day. */}
          {nowKey !== null && dayKeys.includes(nowKey) && (
            <div
              data-testid="now-line"
              className="pointer-events-none absolute inset-x-0 z-20 h-0.5 bg-now"
              style={{ top: nowTop }}
            >
              <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-now" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { layout, layout as layoutForTests };
