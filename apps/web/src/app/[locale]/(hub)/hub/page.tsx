import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@kynite/ui';
import { ChildLauncher } from '@/components/hub';
import { HubBoard } from '@/modules/calendar';
import { requireHubDevice } from '@/modules/devices';
import {
  TodayFab,
  TodayFilterProvider,
  TodayHeader,
  TodayLive,
  TodayTabDag,
  TodayThemeBanner,
  loadHubBoardComposition,
} from '@/modules/today';
import { AmbientTimers, TimerStartFabAction, loadTimerBoard } from '@/modules/timers';
import { WeatherWidget } from '@/modules/weather';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The wall hub's home screen — "Vandaag" (M-R1).
 *
 * Until M-R1 this page mounted `TodayTabs` and all four of `/today`'s panels
 * at once, switched by a pill row the wall's own nav rail duplicated in
 * spirit (`HubRail`'s three-then-four destinations vs. the pills' four
 * views). Now the rail *is* the switch — `/hub` (this page), `/hub/kalender`,
 * `/hub/routines` and `/hub/store` are real routes, and this page draws
 * exactly one of the four former tabs: the day overview, because it is the
 * one that answers what a family standing in the kitchen wants first
 * (`use-today-tab.ts`'s own reasoning for making it `/today`'s default
 * carries over unchanged).
 *
 * The read behind this composition — `data`, `dayKey`, `flow`, `theme`,
 * `progress`, `tasks`, `weather`, `children`, `slot` — is
 * `loadHubBoardComposition` (`@/modules/today`), shared verbatim with
 * `/hub/kalender`: both routes are the same family-wide snapshot
 * (`loadCalendarPage({ surface: 'hub' })`) and the same day-shaped facts
 * derived from it, they only differ in which panel they hand it to.
 *
 * ## What restricted permissions actually restrict
 *
 * Every gate below is read off the §7 matrix by the loader that owns the data,
 * never from "this is the hub":
 *
 *  - **the schedule** — private calendars render free/busy only, because
 *    `calendar:view_private` is `busy-only` for a device.
 *  - **the task list** — tickable, not authorable: `task:complete` is `allow`
 *    and `task:write` is `deny` for a device, so the loader hands the list
 *    `canComplete: true, canWrite: false` and the quick-add never renders.
 *  - **the star matrix** — fully interactive on `/hub/store`, because
 *    `completion:write` is `allow` for a device.
 *  - **events** — no "add event" action at all: `event:write` is `deny`, so
 *    `TodayFab` below never resolves a `newEventAction`.
 *
 * ## What stays hub-shaped
 *
 * The kiosk shell and its chrome, the 6-foot type scale (applied on the
 * document element by `data-surface='hub'`), `ChildLauncher`, the ambient
 * timers, idle-return, and the IndexedDB mirror — see `HubBoard`.
 */
export default async function HubPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; now?: string }>;
}) {
  const { locale } = await params;
  const { date, now } = await searchParams;
  // The device principal is resolved before anything is read. An unpaired or
  // revoked tablet lands on the pair screen instead of on an empty board.
  await requireHubDevice(locale, '/hub', { date, now });

  const composition = await loadHubBoardComposition({
    date,
    now,
    // Every panel this route draws needs all four opt-in reads —
    // `/hub/kalender` and `/hub/routines` each need a strict subset.
    include: { children: true, progress: true, tasks: true, weather: true },
  });
  const t = await getTranslations('today');
  const tCalendar = await getTranslations('calendar');

  if (!composition) {
    // Unreachable in practice — `requireHubDevice` has already redirected a
    // hub with no principal. Kept as the honest fallback for the case the
    // loader itself declines (a family row deleted mid-request), because a
    // blank board is the one thing a wall display must never show.
    return (
      <main className="min-h-full">
        <EmptyState
          size="hub"
          heading
          title={tCalendar('hub.unpairedTitle')}
          description={tCalendar('hub.unpairedBody')}
        />
      </main>
    );
  }

  const {
    data,
    dayKey,
    isToday,
    reference,
    flow,
    theme,
    progress,
    tasks,
    weather,
    children,
    slot,
  } = composition;

  // Renders nothing when nothing is running, so the board is unchanged the
  // rest of the day.
  const timers = await loadTimerBoard({ now });

  const nowEventKeys = flow.liveBlocks.map((event) => event.key);
  const heroEvents = flow.live ? flow.liveBlocks : flow.hero ? [flow.hero] : [];

  return (
    <main
      // `h-full`, not `min-h-full`: the wall's header stays put and the panel
      // scrolls inside what is left. A kiosk that scrolled as one page would
      // take the clock and the day off the top of the screen, which are the
      // two things a glance from across the room is looking for.
      className="flex h-full min-h-0 flex-col gap-4 bg-background px-6 py-4"
      data-testid="hub-board"
    >
      {/* A subscription, not a widget — see `TodayLive`. */}
      <TodayLive />

      {/* §6: family state is mirrored to IndexedDB on every load and every SSE
          event, and a boot renders from IDB then reconciles. See `HubBoard`. */}
      <HubBoard
        familyId={data.familyId}
        greeting={t(`hubGreeting.${slot}`)}
        snapshot={{
          // The server's own render instant, not `Date.now()` in a client
          // component: two snapshots must be comparable across devices.
          generatedAt: data.now.getTime(),
          anchor: data.anchor,
          now: data.now,
          timeZone: data.timeZone,
          view: data.view,
          weekStartsOn: data.weekStartsOn,
          members: data.members,
          events: data.events,
        }}
      >
        <TodayFilterProvider>
          <TodayHeader
            surface="hub"
            greeting={t(`hubGreeting.${slot}`)}
            anchor={data.anchor}
            now={data.now}
            timeZone={data.timeZone}
            dayKey={dayKey}
            isToday={isToday}
            members={data.members}
            // A chevron must not navigate the kiosk out of the `(hub)` tree.
            href="/hub"
          />

          <TodayTabDag
            surface="hub"
            members={data.members}
            events={data.events}
            timeZone={data.timeZone}
            dayKey={dayKey}
            now={data.now}
            isToday={isToday}
            nowEventKeys={nowEventKeys}
            heroEvents={heroEvents}
            flowMode={flow.mode}
            referenceNow={reference.now}
            // `canWrite` / `canComplete` come from the matrix inside
            // `loadTodayTasks`: a device may tick a task off and may not
            // invent or delete one.
            tasks={tasks}
            kids={progress?.kids ?? null}
            // One full-width row above the columns on a day that means
            // something, and nothing at all on the other 348.
            banner={theme ? <TodayThemeBanner theme={theme} /> : null}
            // Nothing at all when the household set no location — see the widget.
            weather={weather ? <WeatherWidget view={weather} /> : null}
            // The per-child entry points, inside the tab's own scroller.
            launcher={<ChildLauncher entries={children} />}
          />
        </TodayFilterProvider>
      </HubBoard>

      {/* M09: a running timer is on the board without anyone navigating to it.
          Outside the mirror rather than in it — a countdown comes from the
          server's clock, and a cached one would be a wrong number. */}
      {timers ? <AmbientTimers board={timers} /> : null}

      {/* The wall's own two-action speed dial: "Timer starten" and
          "Ster geven". "Ster geven" now navigates to `/hub/store` rather than
          switching a tab — the star matrix is a route, not a panel of this
          page, since M-R1. No `newEventAction`: unlike `(app)/today`'s
          `TodayFab`, this one never resolves an "add event" action at all,
          rather than building one that would be refused on submit.
          "Timer starten" opens `TimerStartFabAction`'s modal (M-T2) rather
          than navigating to `timersHref` — that prop stays only as the
          fallback `TodayFab` never actually reaches on this surface. */}
      <TodayFab
        timersHref="/hub/timers"
        canGiveStars={progress?.canComplete ?? false}
        starsHref="/hub/store"
        timerAction={<TimerStartFabAction />}
      />
    </main>
  );
}
