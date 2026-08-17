'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { CategoryDot, DateCircle, EmptyState } from '@kynite/ui';
// Type-only: `@/modules/family` re-exports `server-only` queries, so a value
// import would drag the Postgres client into this client bundle.
import type { Member } from '@/modules/family';
import { specialDaysOn } from '@/modules/holidays';
import { bucketByDay } from '../domain/day-board';
import { toDateKey, toWall } from '../domain/zone';
import type { CalendarEvent } from '../queries';
import { EventChip } from './event-chip';
import { CATEGORY_CLASSES } from './tokens';

/**
 * Month, at 390px: a **dot grid with the selected day spelled out underneath**.
 *
 * The wide month cell carries a date, two or three titles and a "+N meer"; at
 * a seventh of 390px that cell is 52px across, which is a date and nothing
 * else. So the phone's month does what Apple's does — the grid answers "which
 * days are busy" with up to three pips, and the day you tap is written out in
 * full in a panel below it. Tapping refreshes only the panel: a month grid
 * that re-navigated on every tap would cost a server round trip to read one
 * day.
 */

export type MobileMonthViewProps = {
  /** Every day the grid renders, including the leading/trailing month spill. */
  days: Date[];
  events: CalendarEvent[];
  members: Member[];
  timeZone: string;
  /** The month in focus; days outside it recede. */
  anchor: Date;
  today?: Date | null;
  onSelect?: (event: CalendarEvent) => void;
};

const MAX_DOTS = 3;

export function MobileMonthView({
  days,
  events,
  members,
  timeZone,
  anchor,
  today,
  onSelect,
}: MobileMonthViewProps) {
  const t = useTranslations('calendar');
  const formatDateTime = useDateTimeFormat();

  const anchorMonth = toWall(anchor, timeZone).month;
  const todayKey = today ? toDateKey(toWall(today, timeZone)) : null;
  const anchorKey = toDateKey(toWall(anchor, timeZone));

  // Sorted by `bucketByDay`'s one order, which puts all-day rows first — the
  // local sort this replaces ordered by `startsAt` alone, and an all-day row is
  // stored as a UTC midnight, so "vrij" read as 01:00 and landed in the middle
  // of the morning. Both the grid's three pips and the panel's list read this.
  const byDay = useMemo(() => bucketByDay(events, { timeZone }), [events, timeZone]);

  // The anchor is where the month opens; after that the panel follows the tap.
  const [selectedKey, setSelectedKey] = useState(todayKey ?? anchorKey);

  const selectedDay = days.find((day) => toDateKey(toWall(day, timeZone)) === selectedKey);
  const selectedEvents = byDay.get(selectedKey) ?? [];
  const weekdays = days.slice(0, 7);

  return (
    <div data-slot="mobile-month-view" className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-3">
        <div className="grid grid-cols-7">
          {weekdays.map((day) => (
            <div
              key={day.toISOString()}
              className="label-overline py-1.5 text-center text-ink-muted"
            >
              {formatDateTime(day, { weekday: 'short' })}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-0.5">
          {days.map((day) => {
            const key = toDateKey(toWall(day, timeZone));
            const dayEvents = byDay.get(key) ?? [];
            const outside = toWall(day, timeZone).month !== anchorMonth;
            const selected = key === selectedKey;
            const special = specialDaysOn(key);

            return (
              <button
                key={key}
                type="button"
                data-slot="month-cell"
                data-day={key}
                data-outside={outside || undefined}
                data-selected={selected || undefined}
                aria-current={selected ? 'date' : undefined}
                onClick={() => setSelectedKey(key)}
                className="flex h-13 flex-col items-center pt-1 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {/* The shared circle at `md` (32px), two pixels up from the
                    30px this cell drew by hand — seven still fit at 390px with
                    the pips underneath on screen, and the row gains the tap
                    target rather than a size of its own. The weekday lives in
                    the header above the grid, so the label slot stays empty. */}
                <DateCircle
                  label={null}
                  number={formatDateTime(day, { day: 'numeric' })}
                  state={
                    selected
                      ? 'selected'
                      : key === todayKey
                        ? 'today'
                        : outside
                          ? 'muted'
                          : 'default'
                  }
                  dot={
                    // Always a node, never `false`: the slot is what keeps a
                    // quiet day the same height as a busy one.
                    <span className="flex items-center gap-0.5">
                      {special[0] ? (
                        <span
                          data-testid="month-special-day"
                          data-slug={special[0].slug}
                          aria-hidden
                          className="text-[10px] leading-none"
                        >
                          {special[0].emoji}
                        </span>
                      ) : (
                        dayEvents
                          .slice(0, MAX_DOTS)
                          .map((event) => (
                            <CategoryDot
                              key={event.key}
                              size="xs"
                              className={CATEGORY_CLASSES[event.category].solid}
                            />
                          ))
                      )}
                    </span>
                  }
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 h-px shrink-0 bg-line-subtle" />

      {/* The day, written out. On its own quieter ground so the grid above
          keeps reading as the primary surface. */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-container-low px-5 pt-3.5 pb-6">
        <h2 className="label-overline mb-3 text-ink-muted">
          {selectedDay
            ? formatDateTime(selectedDay, { weekday: 'long', day: 'numeric', month: 'long' })
            : null}
        </h2>
        {selectedEvents.length === 0 ? (
          <EmptyState icon="event_available" title={t('empty')} />
        ) : (
          <div className="flex flex-col gap-2">
            {selectedEvents.map((event) => (
              <EventChip
                key={event.key}
                event={event}
                variant="card"
                showOwner
                showPeople
                members={members}
                past={!!today && !event.allDay && event.endsAt.getTime() <= today.getTime()}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
