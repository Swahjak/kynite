'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { cn, DateCircle } from '@kynite/ui';
import { specialDaysOn } from '@/modules/holidays';
import { bucketByDay } from '../domain/day-board';
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
  const tHolidays = useTranslations('holidays');
  const formatDateTime = useDateTimeFormat();
  const anchorMonth = toWall(anchor, timeZone).month;
  const todayKey = today ? toDateKey(toWall(today, timeZone)) : null;

  // No window: the grid's leading and trailing spill are days like any other,
  // and a cell reads whatever bucket its own key has. The buckets arrive in
  // `bucketByDay`'s one order — all-day first — where this loop used to rely on
  // whatever order `queries.ts` handed it, which put a "vrij" row wherever its
  // stored UTC midnight happened to sort.
  const byDay = useMemo(() => bucketByDay(events, { timeZone }), [events, timeZone]);

  const weekdays = days.slice(0, 7);

  return (
    <div data-slot="month-view" className="flex min-h-0 flex-1 flex-col px-3 pb-4 sm:px-6 sm:pb-5">
      {/* `calendar.md` § "Month view / date picker": the weekday header row is
          bare — "each letter: `text-align:center;font-family:'Baloo 2';
          font-weight:700;font-size:11px;color:#747688;`" on the card's own
          white ground, with no band behind it. */}
      <div className="grid shrink-0 grid-cols-7 border-b border-line-subtle">
        {weekdays.map((day) => (
          <div
            key={day.toISOString()}
            className="label-overline px-2 py-2.5 text-center text-ink-muted"
          >
            {formatDateTime(day, { weekday: 'short' })}
          </div>
        ))}
      </div>

      {/* Hairline separators as *gaps*, not borders: `gap-px` over a
          `bg-line-subtle` ground gives every cell the same 1px rule on all
          four sides, including the outer edge, where per-cell `border-t
          border-l` left the right and bottom of the grid open. The rounded
          clip is then a property of the grid rather than something the corner
          cells each have to know about. */}
      <div className="mt-2.5 grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-px overflow-hidden rounded-2xl border border-line-subtle bg-line-subtle">
        {days.map((day) => {
          const key = toDateKey(toWall(day, timeZone));
          const dayEvents = byDay.get(key) ?? [];
          const outside = toWall(day, timeZone).month !== anchorMonth;
          const isToday = key === todayKey;
          // The sparkle (M26). Computed rather than read off the day's events:
          // a special day *is* one of them, but the emoji is a property of the
          // date, and asking the date directly keeps the marker out of the row
          // budget — a cell with three birthdays still shows the 🎄.
          const special = specialDaysOn(key);

          return (
            <div
              key={key}
              data-slot="month-cell"
              data-day={key}
              data-outside={outside || undefined}
              className={cn(
                'flex min-h-24 min-w-0 flex-col gap-0.5 overflow-hidden p-1.5 transition-colors',
                outside ? 'bg-surface-container-low' : 'bg-card hover:bg-surface-container-low/40'
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="flex min-w-0 items-center gap-1">
                  {/* Date number: the shared `DateCircle` at its densest step,
                      so a today cell and an ordinary one put their number in
                      the same 28px box instead of the number jumping right by
                      half a circle on the one day of the month that is filled.
                      The selected / today date keeps the documented pill —
                      "`background:#5d5fef;border-radius:9999px;`" — which *is*
                      the indicator, so a today cell carries no dot of its own,
                      and `selected` rather than `today` because a month grid
                      has no separately focused day to reserve the fill for.

                      No `label`: the weekday is stated once in the header row
                      above the grid, and repeating it in all 35 cells is the
                      thing that header exists to avoid. */}
                  <DateCircle
                    label={null}
                    number={formatDateTime(day, { day: 'numeric' })}
                    state={isToday ? 'selected' : outside ? 'muted' : 'default'}
                    size="sm"
                  />

                  {/* Beside the number, never instead of it: the date is what a
                      month cell is *for*. One emoji even on the rare day that
                      carries two (Pinksteren on Moederdag) — a cell this size
                      has room for a cue, not for a list. */}
                  {special[0] && (
                    <span
                      data-testid="month-special-day"
                      data-slug={special[0].slug}
                      role="img"
                      aria-label={tHolidays(`days.${special[0].slug}`)}
                      className={cn('text-body-sm leading-none', outside && 'opacity-50')}
                    >
                      {special[0].emoji}
                    </span>
                  )}
                </span>
              </div>

              {/* Dot + title, not a tinted chip — see `EventChip`'s `line`
                  variant for why a month cell cannot afford the chip. */}
              <div className="flex min-w-0 flex-col gap-0.5">
                {dayEvents.slice(0, MAX_ROWS_PER_CELL).map((event) => (
                  <EventChip
                    key={event.key}
                    event={event}
                    variant="line"
                    past={!!today && !event.allDay && event.endsAt.getTime() <= today.getTime()}
                    onSelect={onSelect}
                    className={outside ? 'opacity-60' : undefined}
                  />
                ))}
              </div>

              {/* "+N meer" sits *under* the lines it is counting, not beside
                  the date: it is the tail of the list, and next to the date it
                  read as a property of the day. It navigates — see
                  `onOpenDay` — because without it every event past the third
                  is unreachable from this view. */}
              {dayEvents.length > MAX_ROWS_PER_CELL &&
                (onOpenDay ? (
                  <button
                    type="button"
                    data-testid="month-more"
                    data-day={key}
                    aria-label={t('month.openDay', {
                      date: formatDateTime(day, { day: 'numeric', month: 'long' }),
                    })}
                    onClick={() => onOpenDay(key)}
                    className="self-start rounded-sm pl-3 text-left text-caption text-ink-muted transition-colors hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {t('month.more', { count: dayEvents.length - MAX_ROWS_PER_CELL })}
                  </button>
                ) : (
                  <span className="pl-3 text-caption text-ink-muted">
                    {t('month.more', { count: dayEvents.length - MAX_ROWS_PER_CELL })}
                  </span>
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
