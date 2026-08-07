'use client';

import { useCallback, useMemo, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Member } from '@/modules/family';
import { CALENDAR_VIEWS, daysOf, shiftAnchor, type CalendarView } from '../domain/window';
import { toWall } from '../domain/zone';
import type { CalendarEvent } from '../queries';
import { AgendaView } from './agenda-view';
import { EventDialog, type WritableCalendar } from './event-dialog';
import { MonthView } from './month-view';
import { TimeGrid } from './time-grid';

/**
 * The parent app's calendar surface.
 *
 * View switching is *client state*, not navigation. The page fetched one
 * window wide enough for all four views (`domain/window.ts#fetchWindow`), so
 * day → week → month → agenda is a re-render with no request, no reload and no
 * spinner — which is the M06 acceptance criterion. The URL is kept in step
 * with `history.replaceState` so a view is still linkable, without paying for
 * a server round trip to change a tab.
 *
 * Moving to another *period* does need new data, so the arrows navigate for
 * real.
 */

export type CalendarShellProps = {
  view: CalendarView;
  anchor: Date;
  events: CalendarEvent[];
  members: Member[];
  calendars: WritableCalendar[];
  timeZone: string;
  weekStartsOn: number;
  now: Date | null;
  /** False for a principal without `event:write` — the UI offers no writes. */
  canWrite: boolean;
};

export function CalendarShell({
  view: initialView,
  anchor,
  events,
  members,
  calendars,
  timeZone,
  weekStartsOn,
  now,
  canWrite,
}: CalendarShellProps) {
  const t = useTranslations('calendar');
  const format = useFormatter();
  const router = useRouter();

  const [view, setView] = useState<CalendarView>(initialView);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const options = useMemo(
    () => ({ anchor, timeZone, weekStartsOn }),
    [anchor, timeZone, weekStartsOn]
  );
  const days = useMemo(() => daysOf(view, options), [view, options]);

  const changeView = useCallback((next: CalendarView) => {
    setView(next);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('view', next);
      // `replaceState`, not `router.replace`: the data is already here, and a
      // navigation would re-run the server render for nothing.
      window.history.replaceState(null, '', url);
    }
  }, []);

  const navigate = useCallback(
    (direction: -1 | 1) => {
      const next = shiftAnchor(view, options, direction);
      const wall = toWall(next, timeZone);
      const date = `${wall.year}-${String(wall.month).padStart(2, '0')}-${String(wall.day).padStart(2, '0')}`;
      router.push(`/calendar?view=${view}&date=${date}`);
    },
    [view, options, timeZone, router]
  );

  const openCreate = useCallback(() => {
    setSelected(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback(
    (event: CalendarEvent) => {
      if (!canWrite || !event.editable) return;
      setSelected(event);
      setDialogOpen(true);
    },
    [canWrite]
  );

  const onSelect = canWrite ? openEdit : undefined;

  /**
   * Month "+N" → that day, in day view (M18).
   *
   * A real navigation rather than a client-side view switch, because the day
   * the parent tapped is almost never the anchor the month view is centred on
   * — `?date=` is what moves it, and that needs the server round trip the
   * arrows already pay for.
   */
  const openDay = useCallback(
    (dayKey: string) => {
      router.push(`/calendar?view=day&date=${dayKey}`);
    },
    [router]
  );

  const heading =
    view === 'month'
      ? format.dateTime(anchor, { month: 'long', year: 'numeric' })
      : view === 'day'
        ? format.dateTime(anchor, { weekday: 'long', day: 'numeric', month: 'long' })
        : `${format.dateTime(days[0], { day: 'numeric', month: 'short' })} – ${format.dateTime(
            days[days.length - 1],
            { day: 'numeric', month: 'short' }
          )}`;

  return (
    <div
      data-slot="calendar-shell"
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden p-3"
    >
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-hub"
            onClick={() => navigate(-1)}
            aria-label={t('actions.previous')}
          >
            <Icon name="chevron_left" />
          </Button>
          <h1
            className="min-w-0 truncate font-display text-h2 font-bold"
            data-testid="calendar-heading"
          >
            {heading}
          </h1>
          <Button
            variant="ghost"
            size="icon-hub"
            onClick={() => navigate(1)}
            aria-label={t('actions.next')}
          >
            <Icon name="chevron_right" />
          </Button>
        </div>

        {/* NB-7 (M15): at 390px, four hub-sized tabs plus the "Event" button
            add up to well past the viewport — a flex child's default
            `min-width: auto` locks it to that full content width regardless
            of `flex-wrap` on the parent, which was pushing the *page* wider
            than the viewport instead of just this row. `min-w-0` lets the
            group shrink again; `overflow-x-auto` on it (not on the page) is
            where the leftover width goes — a horizontal scroll confined to
            this control cluster, never the page. */}
        <div className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto">
          <Tabs value={view} onValueChange={(value) => changeView(value as CalendarView)}>
            <TabsList size="hub" data-testid="view-switcher">
              {CALENDAR_VIEWS.map((candidate) => (
                <TabsTrigger key={candidate} value={candidate} data-testid={`view-${candidate}`}>
                  {t(`views.${candidate}`)}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {canWrite && (
            <Button size="hub" onClick={openCreate} data-testid="event-create" className="shrink-0">
              <Icon name="add" size="sm" inline="start" />
              {t('actions.add')}
            </Button>
          )}
        </div>
      </header>

      <div
        className={cn('flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface')}
        data-testid={`calendar-view-${view}`}
      >
        {view === 'month' ? (
          <MonthView
            days={days}
            events={events}
            timeZone={timeZone}
            anchor={anchor}
            today={now}
            onSelect={onSelect}
            onOpenDay={openDay}
          />
        ) : view === 'agenda' ? (
          <AgendaView
            days={days}
            events={events}
            timeZone={timeZone}
            today={now}
            onSelect={onSelect}
          />
        ) : (
          <TimeGrid days={days} events={events} timeZone={timeZone} now={now} onSelect={onSelect} />
        )}
      </div>

      {canWrite && (
        <EventDialog
          // Remount per selection: the dialog seeds its fields from `event` on
          // mount, so a new key is what resets them between two events.
          key={selected?.key ?? 'create'}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          event={selected}
          members={members}
          calendars={calendars}
          timeZone={timeZone}
          defaultStart={anchor}
        />
      )}
    </div>
  );
}
