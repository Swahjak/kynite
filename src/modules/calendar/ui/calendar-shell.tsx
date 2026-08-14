'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Fab } from '@/components/ui/fab';
import { Icon } from '@/components/ui/icon';
import type { IconName } from '@/components/ui/icon-codepoints';
import { HEADER_SLOT_ID, SlotPortal } from '@/components/ui/slot-portal';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Member } from '@/modules/family';
import { CALENDAR_VIEWS, daysOf, shiftAnchor, type CalendarView } from '../domain/window';
import { toWall } from '../domain/zone';
import type { CalendarEvent } from '../queries';
import { AgendaView } from './agenda-view';
import { EventDialog, type WritableCalendar } from './event-dialog';
import { MemberDayGrid } from './member-day-grid';
import { MonthView } from './month-view';
import { TimeGrid } from './time-grid';

/** One glyph per view, so the pill fits a 390px header without a scrollbar. */
const VIEW_ICONS: Record<CalendarView, IconName> = {
  day: 'event',
  week: 'grid_view',
  month: 'calendar_month',
  agenda: 'event_available',
};

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
  const formatDateTime = useDateTimeFormat();
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
      ? formatDateTime(anchor, { month: 'long', year: 'numeric' })
      : view === 'day'
        ? formatDateTime(anchor, { weekday: 'long', day: 'numeric', month: 'long' })
        : `${formatDateTime(days[0], { day: 'numeric', month: 'short' })} – ${formatDateTime(
            days[days.length - 1],
            { day: 'numeric', month: 'short' }
          )}`;

  return (
    <div
      data-slot="calendar-shell"
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden p-3 sm:p-6"
    >
      {/* M19: the segmented view pill lives in the *shell's* glass header, as
          every mockup draws it — the page portals into the slot the header
          renders (`components/ui/slot-portal.tsx`) rather than the layout
          learning what a calendar view is. It is the same `Tabs`, the same
          state and the same test ids; only its position moved.

          `min-w-0` + `overflow-x-auto`: at 390px the header already carries a
          clock and an avatar, so the pill takes the leftover width and any
          spill scrolls inside the pill instead of widening the page. Below
          `sm` the triggers are glyphs with an accessible name; the words come
          back as soon as there is room for them. */}
      <SlotPortal id={HEADER_SLOT_ID}>
        <Tabs
          value={view}
          onValueChange={(value) => changeView(value as CalendarView)}
          className="min-w-0 max-w-full"
        >
          <TabsList
            data-testid="view-switcher"
            // The height override carries the same `group-data-horizontal`
            // variant the primitive's default does, or the default's higher
            // specificity keeps the 32px track under 40px triggers.
            className="max-w-full overflow-x-auto rounded-4xl bg-surface-container p-1 group-data-horizontal/tabs:h-12"
          >
            {CALENDAR_VIEWS.map((candidate) => (
              <TabsTrigger
                key={candidate}
                value={candidate}
                data-testid={`view-${candidate}`}
                className="label-overline h-10 shrink-0 rounded-4xl px-3 data-active:bg-surface-container-lowest data-active:text-primary data-active:shadow-sm sm:px-5"
              >
                <Icon name={VIEW_ICONS[candidate]} size="sm" className="sm:hidden" />
                <span className="sr-only sm:not-sr-only">{t(`views.${candidate}`)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </SlotPortal>

      {/* The mockups' FAB replaces the inline "add event" button — same
          action, same test id, positioned by the shell's `FabSlot`. */}
      {canWrite && (
        <Fab icon="add" label={t('actions.add')} onClick={openCreate} data-testid="event-create" />
      )}

      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-hub"
            onClick={() => navigate(-1)}
            aria-label={t('actions.previous')}
          >
            <Icon name="chevron_left" />
          </Button>
          <h1
            className="min-w-0 truncate font-display text-h1 font-bold tracking-tight"
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
      </header>

      {/* The view frame. `Card variant="outlined"` rather than a hand-built
          box: a default card carries no border since the design system
          separates a card from the ground by elevation (`components.md` §
          Cards), and this frame has to read as a *boundary* around a grid that
          paints its own white. `p-0`/`gap-0` because the grid is full-bleed
          inside it — the card's own padding would inset the hour rules. */}
      <Card
        variant="outlined"
        className="min-h-0 flex-1 gap-0 p-0"
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
        ) : view === 'day' && members.length > 0 ? (
          // M19: the day reads per member, not as a one-column week (see
          // `member-day-grid.tsx`). A family with no members left — only
          // reachable mid-deletion — falls back to the day-shaped time grid
          // rather than rendering a board with no columns.
          <MemberDayGrid
            members={members}
            events={events}
            timeZone={timeZone}
            day={days[0]}
            now={now}
            onSelect={onSelect}
          />
        ) : (
          <TimeGrid days={days} events={events} timeZone={timeZone} now={now} onSelect={onSelect} />
        )}
      </Card>

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
