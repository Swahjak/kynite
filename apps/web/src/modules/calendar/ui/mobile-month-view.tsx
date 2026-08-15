'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { CategoryDot, cn, EmptyState } from '@kynite/ui';
// Type-only: `@/modules/family` re-exports `server-only` queries, so a value
// import would drag the Postgres client into this client bundle.
import type { Member } from '@/modules/family';
import { specialDaysOn } from '@/modules/holidays';
import { dayKeysOf } from '../domain/expand';
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

  const byDay = useMemo(() => {
    const buckets = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      for (const key of dayKeysOf(event, timeZone, event.allDay)) {
        const bucket = buckets.get(key);
        if (bucket) bucket.push(event);
        else buckets.set(key, [event]);
      }
    }
    for (const bucket of buckets.values()) {
      bucket.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    }
    return buckets;
  }, [events, timeZone]);

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
                className="flex h-13 flex-col items-center gap-1 pt-1 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span
                  className={cn(
                    // 30px, per the mock: big enough to be a tap target's
                    // visible centre, small enough that seven fit at 390px
                    // with the dots underneath still on screen.
                    'tabular-time inline-flex size-7.5 items-center justify-center rounded-full font-display text-body-sm font-bold',
                    selected && 'bg-primary text-primary-foreground',
                    !selected && key === todayKey && 'text-primary',
                    !selected && key !== todayKey && outside && 'text-ink-muted',
                    !selected && key !== todayKey && !outside && 'text-ink'
                  )}
                >
                  {formatDateTime(day, { day: 'numeric' })}
                </span>
                <span className="flex h-1 items-center gap-0.5">
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
