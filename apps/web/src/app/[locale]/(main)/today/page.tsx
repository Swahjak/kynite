import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@kynite/ui';
import { ChildLauncher } from '@/components/hub';
import { AddEventFabAction, HubBoard } from '@/modules/calendar';
import { requireMemberOrDevice } from '@/modules/devices';
import { firstNameOf, getMember, getPrincipal } from '@/modules/family';
import { getSurface, presentationFor } from '@/modules/surface';
import { TaskComposerFabAction } from '@/modules/tasks';
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
 * `/today` — the family's day, one page for every surface (M3).
 *
 * H3 merged the phone's `(app)/today` and the wall hub's home screen into one
 * route (`docs/plans/2026-09-15-hub-equals-app.md`, "hub = app"). The surface
 * is resolved from the principal — `app` for a phone/desktop member, `hub` for
 * a paired device — and varies **presentation only**: the greeting, the board
 * container, the board's test id and the FAB's actions. The read behind the
 * composition (`loadHubBoardComposition`, `@/modules/today`) is shared verbatim
 * with `/calendar` and `/tasks`.
 *
 * ## What the surface still decides here
 *
 *  - **the greeting** — the viewer's first name on `app`
 *    (`common.greeting.<slot>`), the household's plain one on `hub`
 *    (`today.hubGreeting.<slot>`). A paired device has nobody signed in (§7),
 *    so only `app` resolves a member to greet.
 *  - **the FAB** — `app` resolves `newEventAction` and `taskAction`, gated on
 *    `event:write`/`task:write` as the loader hands them back; a paired device
 *    gets neither, and keeps its two-action dial.
 *  - **the chrome** — the phone's `mx-auto … max-w-7xl … flex-1` column with
 *    `data-testid="today-board"`; the wall's full-frame `h-full … px-6 py-4`
 *    board with `data-testid="hub-board"`.
 *
 * Everything else — the theme banner, the weather card's density, the NU block
 * — is decided by the shared `TodayTabDag`, not branched here.
 */
export default async function TodayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; now?: string }>;
}) {
  const { locale } = await params;
  const { date, now } = await searchParams;
  // The principal is resolved before anything is read. An unpaired or revoked
  // tablet lands on the pair screen instead of on an empty board.
  await requireMemberOrDevice(locale, '/today', { date, now });
  const surface = presentationFor(await getSurface());

  const composition = await loadHubBoardComposition({
    date,
    now,
    // Every panel this route draws needs all four opt-in reads —
    // `/calendar` and `/routines` each need a strict subset.
    include: { children: true, progress: true, tasks: true, weather: true },
  });
  const t = await getTranslations('today');
  const tCalendar = await getTranslations('calendar');

  if (!composition) {
    // Unreachable in practice — `requireMemberOrDevice` has already redirected
    // a board with no principal. Kept as the honest fallback for the case the
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

  /**
   * The greeting (M18).
   *
   * `app` greets the signed-in member by first name; `hub` greets the
   * household, because a paired device has nobody signed in (§7) and must not
   * go looking for a member. The slot is resolved by the loader against the
   * household's timezone, so a family in Curaçao is not wished a good evening
   * over breakfast. It degrades rather than fails — an `app` principal with no
   * member row, or one with a blank display name, keeps the plain title.
   */
  const principal = surface === 'app' ? await getPrincipal() : null;
  const viewer =
    principal?.kind === 'member' ? await getMember(principal.familyId, principal.memberId) : null;
  const firstName = viewer ? firstNameOf(viewer.displayName) : '';
  const tCommon = await getTranslations('common');
  const greeting =
    surface === 'app'
      ? firstName
        ? tCommon(`greeting.${slot}`, { name: firstName })
        : t('title')
      : t(`hubGreeting.${slot}`);

  // Renders nothing when nothing is running, so the board is unchanged the
  // rest of the day.
  const timers = await loadTimerBoard({ now });

  const nowEventKeys = flow.liveBlocks.map((event) => event.key);
  const heroEvents = flow.live ? flow.liveBlocks : flow.hero ? [flow.hero] : [];

  return (
    <main
      // The phone's own column, the wall's full frame. `h-full`, not
      // `min-h-full`, on the wall: its header stays put and the panel scrolls
      // inside what is left. A kiosk that scrolled as one page would take the
      // clock and the day off the top of the screen, which are the two things
      // a glance from across the room is looking for.
      className={
        surface === 'app'
          ? 'mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-5 p-4 sm:p-6'
          : 'flex h-full min-h-0 flex-col gap-4 bg-background px-6 py-4'
      }
      data-testid={surface === 'app' ? 'today-board' : 'hub-board'}
    >
      {/* A subscription, not a widget — see `TodayLive`. */}
      <TodayLive />

      {/* §6: family state is mirrored to IndexedDB on every load and every SSE
          event, and a boot renders from IDB then reconciles. See `HubBoard`. */}
      <HubBoard
        familyId={data.familyId}
        greeting={greeting}
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
            surface={surface}
            greeting={greeting}
            anchor={data.anchor}
            now={data.now}
            timeZone={data.timeZone}
            dayKey={dayKey}
            isToday={isToday}
            members={data.members}
            // The phone's own face, for its header row; absent on the wall,
            // which has no signed-in member and must not go looking for one.
            viewer={viewer}
            // A chevron must not navigate the kiosk out of the `(main)` tree.
            href="/today"
          />

          <TodayTabDag
            surface={surface}
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
            // The density follows the surface: a phone gets the compact card,
            // the wall the full-size one.
            weather={
              weather ? (
                <WeatherWidget view={weather} density={surface === 'app' ? 'phone' : 'hub'} />
              ) : null
            }
            // The per-child entry points, inside the tab's own scroller.
            launcher={<ChildLauncher entries={children} />}
          />
        </TodayFilterProvider>
      </HubBoard>

      {/* M09: a running timer is on the board without anyone navigating to it.
          Outside the mirror rather than in it — a countdown comes from the
          server's clock, and a cached one would be a wrong number. */}
      {timers ? <AmbientTimers board={timers} /> : null}

      {/* The day's speed dial. `app` carries the full four actions — "Nieuw
          event" (`AddEventFabAction`) and "Taak erbij" (`TaskComposerFabAction`)
          resolved here, gated on `event:write`/`task:write`; "Timer starten"
          and "Ster geven". A paired device keeps two: `event:write` and
          `task:write` are `deny` (§7), so it resolves no `newEventAction` or
          `taskAction` at all rather than building one that would be refused on
          submit. "Ster geven" navigates to `/store` on both — the star matrix
          is a route since M-R1, not a panel of this page. "Timer starten"
          opens `TimerStartFabAction`'s modal (M-T2). */}
      <TodayFab
        timersHref="/timers"
        canGiveStars={progress?.canComplete ?? false}
        starsHref="/store"
        timerAction={<TimerStartFabAction />}
        newEventAction={
          surface === 'app' && data.canWrite ? (
            <AddEventFabAction
              members={data.members}
              calendars={data.calendars}
              timeZone={data.timeZone}
              defaultStart={data.anchor}
            />
          ) : null
        }
        taskAction={surface === 'app' && tasks?.canWrite ? <TaskComposerFabAction /> : null}
      />
    </main>
  );
}
