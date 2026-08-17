'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { useRouter } from '@/i18n/navigation';
import { Button, Icon, MemberFace, Tabs, TabsList, TabsTrigger } from '@kynite/ui';
import { Fab } from '@/components/ui/fab';
import type { Member } from '@/modules/family';
import { CALENDAR_VIEWS, daysOf, shiftAnchor, type CalendarView } from '../domain/window';
import { isoWeek, toDateKey, toWall } from '../domain/zone';
import type { CalendarEvent } from '../queries';
import { AgendaView } from './agenda-view';
import { DayStrip } from './day-strip';
import { EventDialog, type WritableCalendar } from './event-dialog';
import { MemberDayGrid } from './member-day-grid';
import { MobileMonthView } from './mobile-month-view';
import { MonthView } from './month-view';
import { TimeGrid } from './time-grid';
import { CATEGORY_CLASSES } from './tokens';
import { useIsWide } from './use-is-wide';

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
 *
 * ## The shape rule (M27, `docs/design/claude-design/Kalender.dc.html`)
 *
 * A seven-column time grid is unreadable at 390px, so below `sm` the views do
 * not scale down — they **change shape**. Week becomes an agenda list per day,
 * month becomes a dot grid with the selected day written out underneath, and
 * day becomes a single-column grid under the week strip instead of a column
 * per family member. `useIsWide` picks, once, which of the two components to
 * render; the reasoning for doing it in JS rather than with `sm:hidden` is in
 * that file.
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
  const isWide = useIsWide();

  const [view, setView] = useState<CalendarView>(initialView);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  /**
   * Who the board is showing. Client state, not a query parameter: it is a way
   * of *looking* at the window already in memory, so toggling a face must cost
   * nothing, and it deliberately does not survive a reload — a filter that
   * persisted would eventually hide somebody's dentist appointment from the
   * person who set it and forgot.
   *
   * Stored as the **excluded** set rather than the included one so that a
   * member added to the family while the page is open appears rather than
   * silently starting out filtered away.
   */
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(() => new Set());

  const toggleMember = useCallback((id: string) => {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const options = useMemo(
    () => ({ anchor, timeZone, weekStartsOn }),
    [anchor, timeZone, weekStartsOn]
  );
  const days = useMemo(() => daysOf(view, options), [view, options]);
  /** The visible week, for the phone's day strip — independent of `view`. */
  const weekDays = useMemo(() => daysOf('week', options), [options]);

  /**
   * A household event is everyone's, so it survives every filter: the row of
   * faces answers "whose appointments do I want to see", not "which events do
   * I want to see", and family dinner is not one person's.
   */
  const visibleEvents = useMemo(() => {
    if (excluded.size === 0) return events;

    return events.filter((event) => {
      const targets = new Set(event.attendeeMemberIds);
      if (event.ownerMemberId) targets.add(event.ownerMemberId);
      if (targets.size === 0) return true;
      return [...targets].some((id) => !excluded.has(id));
    });
  }, [events, excluded]);

  const visibleMembers = useMemo(
    () => members.filter((member) => !excluded.has(member.id)),
    [members, excluded]
  );

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
      router.push(`/calendar?view=${view}&date=${toDateKey(toWall(next, timeZone))}`);
    },
    [view, options, timeZone, router]
  );

  /**
   * "Vandaag" — back to the day the household is actually living in.
   *
   * No `?date=`: the loader anchors on the server's now when the parameter is
   * absent, which is a truer "today" than anything this component could
   * compute from a device clock that may be in another timezone entirely.
   */
  const goToday = useCallback(() => {
    router.push(`/calendar?view=${view}`);
  }, [router, view]);

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

  /**
   * `10 – 16 augustus 2026`, not `10 aug – 16 aug`. A week that lives inside
   * one month names that month once; only a week that straddles two has to say
   * both. The mock writes it the first way because that is how a Dutch
   * household says it out loud.
   */
  const heading = useMemo(() => {
    if (view === 'month') {
      return capitalise(formatDateTime(anchor, { month: 'long', year: 'numeric' }));
    }
    if (view === 'day') {
      return capitalise(formatDateTime(anchor, { weekday: 'long', day: 'numeric', month: 'long' }));
    }

    const first = days[0];
    const last = days[days.length - 1];
    const sameMonth = toWall(first, timeZone).month === toWall(last, timeZone).month;

    return sameMonth
      ? `${formatDateTime(first, { day: 'numeric' })} – ${formatDateTime(last, {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}`
      : `${formatDateTime(first, { day: 'numeric', month: 'short' })} – ${formatDateTime(last, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}`;
  }, [view, anchor, days, timeZone, formatDateTime]);

  /**
   * The same heading, written for 390px ("Kalender.dc.html":502).
   *
   * A phone header holds about fifteen characters beside a control, and the
   * wide heading is three times that — which is why the title used to end in an
   * ellipsis on every phone in day and week view. The design's answer is not a
   * smaller font, it is a *shorter sentence*: the day drops its weekday and its
   * year, the week becomes its ISO number, and the month drops the year. None
   * of the three loses a fact the screen underneath does not already show.
   */
  const mobileHeading = useMemo(() => {
    if (view === 'month') return capitalise(formatDateTime(anchor, { month: 'long' }));
    if (view === 'day') return formatDateTime(anchor, { day: 'numeric', month: 'long' });
    if (view === 'week') return t('weekNumber', { week: isoWeek(toWall(days[0], timeZone)) });
    return heading;
  }, [view, anchor, days, timeZone, formatDateTime, heading, t]);

  const dayKey = toDateKey(toWall(days[0], timeZone));
  /**
   * What the phone's week strip fills in. In day view that is the day on
   * screen; in week view the list underneath covers all seven, so the strip
   * marks **today** instead — filling Monday because it happens to be the
   * anchor would read as "Monday is selected" when nothing is.
   */
  const todayKey = now ? toDateKey(toWall(now, timeZone)) : null;
  const weekStripKey =
    todayKey && weekDays.some((day) => toDateKey(toWall(day, timeZone)) === todayKey)
      ? todayKey
      : '';

  return (
    <div
      data-slot="calendar-shell"
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden"
    >
      {/* One create action, never two. The mock puts a "Nieuw" button in the
          wide header and keeps the FAB for the phone; rendering both and
          hiding one with a breakpoint class would leave two `event-create`
          nodes in the document, which is a strict-mode ambiguity for anything
          selecting on it. */}
      {canWrite && !isWide && (
        <Fab icon="add" label={t('actions.add')} onClick={openCreate} data-testid="event-create" />
      )}

      {/* The header is one row on the wide screen, exactly as the mock draws
          it: arrows, title, "Vandaag", then — pushed right — the member
          filters, the view switcher and "Nieuw". At 390px the row wraps and
          the switcher takes the second line at full width. */}
      <header className="flex min-w-0 flex-wrap items-center gap-2 border-b border-line-subtle px-3 pt-3 pb-2.5 sm:gap-2.5 sm:px-6 sm:pt-4.5 sm:pb-3.5">
        {/* Arrows, title and "Vandaag" travel together and take the row's
            slack, so the button stays beside the heading the way the mock
            draws it instead of drifting to the far right. */}
        <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2.5">
          <Button
            variant="ghost"
            size="icon-hub"
            onClick={() => navigate(-1)}
            aria-label={t('actions.previous')}
          >
            <Icon name="chevron_left" />
          </Button>
          <Button
            variant="ghost"
            size="icon-hub"
            onClick={() => navigate(1)}
            aria-label={t('actions.next')}
          >
            <Icon name="chevron_right" />
          </Button>

          <h1
            // `basis-0 grow`: the title takes whatever the controls leave and
            // truncates below that, so the row **never wraps**. A
            // content-sized title reads better but pushed "Nieuw" onto a
            // second line at tablet width — this app carries a 133px nav rail
            // and a fourth view (agenda) the mock's tablet does not, so the
            // row is ~180px tighter than the drawing and something has to
            // give. A heading that ellipsises is a smaller lie than a header
            // that reflows.
            className="min-w-0 flex-1 basis-0 truncate font-display text-h2 font-extrabold tracking-tight sm:text-h1"
            data-testid="calendar-heading"
          >
            {/* Two spellings of one heading, and only ever one in the
                document's flow — the short one below `sm`, the full one above
                it. Rendered as two spans rather than picked in JS so the choice
                survives SSR without a layout shift. */}
            <span className="sm:hidden">{mobileHeading}</span>
            <span className="hidden sm:inline">{heading}</span>
          </h1>

          <Button variant="outline" size="sm" onClick={goToday} className="shrink-0">
            {t('actions.today')}
          </Button>
        </div>

        {/* Member filters. A deselected member is **dimmed, never removed** —
            the row is the family, and a family member who disappears because
            somebody unticked them is a different, worse message than one who
            is visibly switched off. */}
        {members.length > 0 && (
          <div
            data-slot="member-filter"
            role="group"
            aria-label={t('filter.label')}
            className="hidden shrink-0 items-center gap-1.5 sm:flex"
          >
            {members.map((member) => {
              const included = !excluded.has(member.id);
              const palette = CATEGORY_CLASSES[member.color];

              return (
                <button
                  key={member.id}
                  type="button"
                  data-slot="member-filter-face"
                  data-member-id={member.id}
                  aria-pressed={included}
                  aria-label={t(included ? 'filter.hide' : 'filter.show', {
                    name: member.displayName,
                  })}
                  onClick={() => toggleMember(member.id)}
                  className="rounded-full transition-opacity focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <MemberFace
                    size="default"
                    name={member.displayName}
                    avatarUrl={member.avatarUrl}
                    surfaceClass={palette.surface}
                    // Indigo, not the member's own hue: the ring is the
                    // *filter's* state ("Kalender.dc.html":70–73 draws every
                    // included face with `box-shadow 0 0 0 2px #5d5fef`), and a
                    // ring that changed colour per person said "this is Mila"
                    // twice instead of saying "Mila is switched on" once.
                    ringClass="ring-primary"
                    ringed={included}
                    className={included ? undefined : 'opacity-45'}
                  />
                </button>
              );
            })}
          </div>
        )}

        {/* `order-last w-full` below `sm`: the pill drops onto its own line and
            spans it rather than squeezing the title. `min-w-0` +
            `overflow-x-auto` keep any spill inside the pill instead of
            widening the page. */}
        <Tabs
          value={view}
          onValueChange={(value) => changeView(value as CalendarView)}
          className="order-last w-full min-w-0 sm:order-none sm:w-auto"
        >
          <TabsList
            data-testid="view-switcher"
            // The height override carries the same `group-data-horizontal`
            // variant the primitive's default does, or the default's higher
            // specificity keeps the 32px track under 40px triggers.
            className="w-full max-w-full overflow-x-auto rounded-4xl bg-surface-container p-1 group-data-horizontal/tabs:h-12 sm:w-auto"
          >
            {CALENDAR_VIEWS.map((candidate) => (
              <TabsTrigger
                key={candidate}
                value={candidate}
                data-testid={`view-${candidate}`}
                // Baloo, bold, *sentence case* — "Dag / Week / Maand", which
                // is how the design writes it ("Kalender.dc.html":76–78). The
                // caps of `label-overline` are the metadata register, and a
                // view switcher is a control.
                className="h-10 flex-1 rounded-4xl px-3 font-display text-body-sm font-bold data-active:bg-surface-container-lowest data-active:text-primary data-active:shadow-sm sm:flex-none sm:px-3.5"
              >
                {/* Words, not glyphs — on the phone too. The sheet's mobile
                    segmented control is "Dag / Week / Maand" in Baloo
                    ("Kalender.dc.html":270–274), and four calendar glyphs that
                    all differ by a few pixels of internal grid is a puzzle,
                    not a control. They fit: four labels at 14px come to about
                    two thirds of a 390px row. */}
                <span>{t(`views.${candidate}`)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {canWrite && isWide && (
          <Button size="sm" onClick={openCreate} data-testid="event-create" className="shrink-0">
            <Icon name="add" size="sm" />
            {t('actions.new')}
          </Button>
        )}
      </header>

      <div
        className="flex min-h-0 min-w-0 flex-1 flex-col"
        data-testid={`calendar-view-${view}`}
        data-wide={isWide || undefined}
      >
        {view === 'month' ? (
          isWide ? (
            <MonthView
              days={days}
              events={visibleEvents}
              timeZone={timeZone}
              anchor={anchor}
              today={now}
              onSelect={onSelect}
              onOpenDay={openDay}
            />
          ) : (
            <MobileMonthView
              days={days}
              events={visibleEvents}
              members={members}
              timeZone={timeZone}
              anchor={anchor}
              today={now}
              onSelect={onSelect}
            />
          )
        ) : view === 'agenda' ? (
          <AgendaView
            days={days}
            events={visibleEvents}
            members={members}
            timeZone={timeZone}
            today={now}
            onSelect={onSelect}
          />
        ) : view === 'week' ? (
          isWide ? (
            <TimeGrid
              days={days}
              events={visibleEvents}
              members={members}
              timeZone={timeZone}
              now={now}
              onSelect={onSelect}
            />
          ) : (
            // Week, at 390px, is an **agenda list per day** — the shape
            // Google Calendar's Schedule view has, for the same reason.
            <div className="flex min-h-0 flex-1 flex-col">
              <DayStrip
                days={weekDays}
                events={visibleEvents}
                timeZone={timeZone}
                selectedKey={weekStripKey}
                today={now}
                dots={false}
              />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <AgendaView
                  days={days}
                  events={visibleEvents}
                  members={members}
                  timeZone={timeZone}
                  today={now}
                  onSelect={onSelect}
                />
              </div>
            </div>
          )
        ) : isWide && visibleMembers.length > 0 ? (
          // M19: the day reads per member on the wide screen (see
          // `member-day-grid.tsx`). A family with no members left — or one
          // whose faces are all filtered off — falls back to the day-shaped
          // time grid rather than rendering a board with no columns.
          <MemberDayGrid
            members={visibleMembers}
            events={visibleEvents}
            timeZone={timeZone}
            day={days[0]}
            now={now}
            onSelect={onSelect}
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            {!isWide && (
              <DayStrip
                days={weekDays}
                events={visibleEvents}
                timeZone={timeZone}
                selectedKey={dayKey}
                today={now}
                onSelectDay={openDay}
              />
            )}
            <TimeGrid
              days={days}
              events={visibleEvents}
              members={members}
              timeZone={timeZone}
              now={now}
              onSelect={onSelect}
              showHeader={isWide}
            />
          </div>
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

/**
 * "augustus 2026" → "Augustus 2026".
 *
 * `Intl` lower-cases Dutch month and weekday names because that is how they are
 * written *inside a sentence*; a heading is not a sentence, and the design
 * writes "Augustus 2026" ("Kalender.dc.html":502). Only the first character, so
 * a two-word heading keeps its own casing.
 */
function capitalise(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1);
}
