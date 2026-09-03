import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@kynite/ui';
import { ChildLauncher, type HubChild } from '@/components/hub';
import {
  HubBoard,
  dayKeysOf,
  isSameDay,
  loadCalendarPage,
  toDateKey,
  toWall,
} from '@/modules/calendar';
import { requireHubDevice } from '@/modules/devices';
import { MEMBER_COLOR_CLASSES, greetingSlotFor, hourIn, initialsOf } from '@/modules/family';
import { loadFamilyRoutineTotals } from '@/modules/routines';
import { loadTodayTasks } from '@/modules/tasks';
import {
  TodayFab,
  TodayHeader,
  TodayLive,
  TodayTabDag,
  TodayTabPersonen,
  TodayTabRoutines,
  TodayTabSterren,
  TodayTabs,
  TodayThemeBanner,
  flowOf,
  loadTodayProgress,
  resolveTodayTheme,
  type DayReference,
  type TodayTab,
} from '@/modules/today';
import { AmbientTimers, loadTimerBoard } from '@/modules/timers';
import { WeatherWidget, getFamilyWeather } from '@/modules/weather';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The wall hub's home screen (M25) — **the same screen as `(app)/today`**.
 *
 * The hub used to draw a board of its own: one column per member, at 6-foot
 * scale, and nothing else. That was a second answer to a question the product
 * already answers once, and it drifted — the wall could not show the household's
 * task list, today's routine progress or today's stars, all of which are things
 * a family standing in the kitchen wants more than a second copy of the
 * calendar. So the composition is now literally the same components
 * (`@/modules/today`), fed the same way, and the only thing that differs is
 * what a *device* principal is allowed to do with them.
 *
 * ## What restricted permissions actually restrict
 *
 * Every gate below is read off the §7 matrix by the loader that owns the data,
 * never from "this is the hub":
 *
 *  - **the schedule** — private calendars render free/busy only, because
 *    `calendar:view_private` is `busy-only` for a device
 *    (`loadCalendarPage({ surface: 'hub' })`). A kitchen wall is not a private
 *    surface.
 *  - **the task list** — tickable, not authorable: `task:complete` is `allow`
 *    and `task:write` is `deny` for a device, so `loadTodayTasks` hands the
 *    list `canComplete: true, canWrite: false` and the quick-add never renders.
 *  - **the star matrix** — fully interactive, because `completion:write` is
 *    `allow` for a device; that is the whole point of a screen kids can reach.
 *    Taps are recorded with `source: 'hub'`, like every other hub completion.
 *  - **events** — no "add event" action at all: `event:write` is `deny`, so
 *    `TodayFab` below never resolves a `newEventAction`. `task:write` being
 *    denied too is why there is no "Taak erbij" action either — of the
 *    design sheet's four quick actions the wall performs the two it is
 *    allowed to, where the phone's dial carries all four.
 *
 * ## What stays hub-shaped
 *
 * The kiosk shell and its chrome, the 6-foot type scale (applied on the
 * document element by `data-surface='hub'`, so every token in the composition
 * is already the wall's size), `ChildLauncher`, the ambient timers, idle-return,
 * and the IndexedDB mirror — see `HubBoard`, which is now the mirror's
 * reconcile wrapper rather than a board of its own.
 *
 * The one thing the composition drops on the way over is the 72px
 * `display-hub` heading. The vandaag layout was drawn *for* this wall
 * ("stitch_wall_hub_daily_schedule", `docs/design/vandaag-template.html`) and
 * already carries its own scale; stacking a second, larger header on top of the
 * kiosk scale is what used to push a hub screen into an internal scroll, which
 * a wall with no scrollbar must never do.
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
  // NB-3: `?date=`/`?now=` are forwarded so a locale-follow redirect (M16)
  // doesn't drop them.
  await requireHubDevice(locale, '/hub', { date, now });

  // `?date=` renders another day, which is what a tomorrow-preview needs and
  // what makes the board snapshot-testable without freezing a clock.
  // No `view`: the hub's board is the *family's* (FR28, M16), resolved inside
  // the loader from `family.hubDefaultView` — which now picks the opening
  // *tab* (see `defaultTab` below) as well as the cached board's layout.
  const data = await loadCalendarPage({ date, surface: 'hub' });
  const t = await getTranslations('today');
  const tCalendar = await getTranslations('calendar');

  if (!data) {
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

  // Renders nothing when nothing is running, so the board is unchanged the
  // rest of the day.
  const timers = await loadTimerBoard({ now });

  // M19: the board is the way *in*, not only a thing to read. One entry per
  // child, carrying today's step count so the tap is informed rather than
  // exploratory. Loaded here, on the server, because `ChildLauncher` is a
  // client component and `@/modules/routines` is `server-only`; the same seam
  // `AmbientTimers` uses. Adults are absent by design — the hub's interactive
  // half is the child-facing one.
  //
  // One family-wide read, not one board per child: this page re-renders on
  // every SSE event a wall display receives, and `loadMemberRoutines` per child
  // was an N+1 that built four full board sections per member to read two
  // integers off the end (M19 review, F11).
  const totals = await loadFamilyRoutineTotals({ date });

  const children: HubChild[] = data.members
    .filter((member) => member.role === 'child')
    .map((member) => {
      const progress = totals?.get(member.id) ?? { done: 0, total: 0 };

      return {
        id: member.id,
        displayName: member.displayName,
        avatarUrl: member.avatarUrl,
        initials: initialsOf(member.displayName),
        colorClass: MEMBER_COLOR_CLASSES[member.color].surface,
        doneCount: progress.done,
        total: progress.total,
      };
    });

  /**
   * The greeting, at *household* scale.
   *
   * `(app)/today` greets the person signed in; a wall tablet has nobody signed
   * in by construction (§7: "a wall tablet is physically unauthenticated"), and
   * greeting the device — or the family's name, which a household writes as
   * anything from "Jansen" to "Ons gezin" — would read as either wrong or
   * arch. So the slot alone: "Goedemorgen". Resolved against the household's
   * timezone, like the app's, so a family in Curaçao is not wished a good
   * evening over breakfast.
   */
  const slot = greetingSlotFor(hourIn(data.now, data.timeZone));

  const dayKey = toDateKey(toWall(data.anchor, data.timeZone));
  const dayEvents = data.events.filter((event) =>
    dayKeysOf(event, data.timeZone, event.allDay).includes(dayKey)
  );

  const isToday = isSameDay(data.anchor, data.now, data.timeZone);
  const reference: DayReference = isToday
    ? { kind: 'today', now: data.now }
    : { kind: data.anchor.getTime() < data.now.getTime() ? 'past' : 'future', now: data.anchor };
  const flow = flowOf(dayEvents, reference);

  /**
   * The two reads that are only true of *today* — the same rule `(app)/today`
   * follows. A browsed day gets `null` and the panels say so rather than
   * showing today's numbers under yesterday's date.
   */
  const [progress, tasks, weather] = await Promise.all([
    isToday ? loadTodayProgress({ now: data.now }) : null,
    isToday ? loadTodayTasks({ now: data.now }) : null,
    // Weather is *now*, not a property of the browsed day, so it follows the
    // same today-only rule as the two reads above. One indexed row read and
    // never a network call, which is what lets a wall display that re-renders
    // on every SSE event carry it.
    isToday ? getFamilyWeather(data.familyId, { now: data.now }) : null,
  ]);

  const nowEventKey = flow.live ? (flow.hero?.key ?? null) : null;
  // Every block currently live, not just the hero — feeds both the NU strip
  // (which now draws all of them) and the timeline's collapse of the same
  // rows. `flow.liveBlocks` is only ever non-empty while `flow.live`.
  const nowEventKeys = flow.liveBlocks.map((event) => event.key);
  const heroEvents = flow.live ? flow.liveBlocks : flow.hero ? [flow.hero] : [];

  /**
   * The day's theme, resolved *here* rather than inside the banner, because the
   * page is the only place that can act on the answer: on a themed day the
   * banner takes the NU block's place ("Vandaag met thema's":404 wraps the NU
   * card in `<sc-if geenThema>`), and a component that decides late cannot tell
   * its sibling to stand down. Null on the ordinary majority of the year.
   */
  const theme = resolveTodayTheme({ dayKey, isToday, people: data.members });

  /**
   * FR28's "default view", kept meaningful rather than retired.
   *
   * The setting's two options are already written as the two arrangements this
   * composition offers — "Kolommen per persoon" and "Lijst van wat eraan komt"
   * — so `day` opens the per-person tab and `agenda` opens the chronological
   * one. The Controller's control and its copy are unchanged, it still reaches
   * the wall without re-pairing (`SettingsWatcher`), and it still decides the
   * cached board's layout inside `HubBoard`. It is only the *opening* tab: a
   * tap on the wall moves to another one and that choice is the device's, like
   * everywhere else (`use-today-tab.ts`).
   */
  const defaultTab: TodayTab = data.view === 'agenda' ? 'dag' : 'personen';

  return (
    <main
      // `h-full`, not `min-h-full`: the wall's header and its tab pills stay
      // put and the panel scrolls inside what is left. A kiosk that scrolled as
      // one page would take the clock and the day off the top of the screen,
      // which are the two things a glance from across the room is looking for.
      className="flex h-full min-h-0 flex-col gap-4 bg-background px-6 py-4"
      data-testid="hub-board"
    >
      {/* A subscription, not a widget — see `TodayLive`. It works unchanged
          under a device principal: the stream is scoped to the family by the
          server, and this tree already runs `SettingsWatcher` and the mirror
          off the same connection (`RealtimeProvider`, in the hub layout). */}
      <TodayLive />

      {/* §6: family state is mirrored to IndexedDB on every load and every SSE
          event, and a boot renders from IDB then reconciles. The live
          composition below is a pass-through in every ordinary case; only a
          device holding a strictly *newer* snapshot than the document it was
          served draws the cached board instead. See `HubBoard`. */}
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
        <TodayHeader
          // The same component `(app)/today` draws, at the wall's scale. No
          // `viewer`: a device principal has no member to greet or to draw a
          // face for, so the personal chrome is simply a prop this page does
          // not pass (§7, and `TodayHeader`'s own note on the fork).
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

        <TodayTabs
          defaultTab={defaultTab}
          fill
          dag={
            /* The same panel `(app)/today` draws, at the wall's scale. The NU
               strip lives *inside* the first column here rather than above the
               tabs, and the second column carries the routines and the
               quick-action grid — all of that is `surface`, which varies
               presentation only. What a device principal may *do* with it
               arrives below as data and as already-resolved nodes. */
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
              // M26: one full-width row above the columns on a day that means
              // something, and nothing at all on the other 348.
              banner={theme ? <TodayThemeBanner theme={theme} /> : null}
              // The head of the sheet's third column ("Vandaag.dc.html":145),
              // which the August recomposition folded into this one. Nothing
              // at all when the household set no location — see the widget.
              weather={weather ? <WeatherWidget view={weather} /> : null}
              // The per-child entry points, inside the tab's own scroller. They
              // used to sit under the board as a third band of the page, which
              // took the bottom third of an 834px wall away from the columns
              // the design gives the whole panel to ("Vandaag.dc.html":72–75).
              launcher={<ChildLauncher entries={children} />}
            />
          }
          personen={
            <TodayTabPersonen
              members={data.members}
              events={data.events}
              timeZone={data.timeZone}
              dayKey={dayKey}
              now={data.now}
              isToday={isToday}
              nowEventKey={nowEventKey}
            />
          }
          routines={<TodayTabRoutines kids={progress?.kids ?? null} />}
          sterren={
            <TodayTabSterren
              kids={progress?.kids ?? null}
              canComplete={progress?.canComplete ?? false}
              source="hub"
            />
          }
        />
      </HubBoard>

      {/* M09: a running timer is on the board without anyone navigating to it.
          Outside the mirror rather than in it — a countdown comes from the
          server's clock, and a cached one would be a wrong number. */}
      {timers ? <AmbientTimers board={timers} /> : null}

      {/* The wall's own two-action speed dial (M27-ish): "Timer starten" and
          "Ster geven", the only two of the design sheet's four quick actions a
          device principal may perform (§7 — `event:write`/`task:write` are
          `deny`). No `newEventAction`: unlike `(app)/today`'s `TodayFab`, this
          one never resolves an "add event" action at all, rather than
          building one that would be refused on submit. */}
      <TodayFab timersHref="/hub/timers" canGiveStars={progress?.canComplete ?? false} />
    </main>
  );
}
