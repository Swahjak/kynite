import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Card, cn } from '@kynite/ui';
import type { CalendarEvent } from '@/modules/calendar';
import { MEMBER_COLOR_CLASSES, type Member } from '@/modules/family';
import { TaskList, type TodayTasksData } from '@/modules/tasks';
import type { FlowMode } from '../domain/flow';
import type { KidProgress } from '../page-data';
import { TodayNowStrip } from './today-now-strip';
import { TodayQuickActions } from './today-quick-actions';
import { TodayTabRoutines } from './today-tab-routines';
import { TodayTimeline } from './today-timeline';

/**
 * "Dagoverzicht" — the household's day, on the phone and on the wall.
 *
 * ## Why one component and not two
 *
 * There used to be a `TodayHubDag` beside this one. Nothing was decided by that
 * split — it was a fork, made the day after `5dc38ee` unified the two surfaces
 * on the rule that "the hub is the app with restricted permissions, not a
 * second product" — and the cost showed up immediately: the theme banner (M26)
 * landed in the hub's copy, and a family looking at their phone in the middle
 * of the zomervakantie saw nothing at all. Not because anybody decided that,
 * but because there was a second file nobody thought to change.
 *
 * So `surface` varies **presentation only** — the column ratio, the timeline's
 * density, which stack the second column carries — and never what is fetched or
 * what a principal may do. Every permission below arrives as data (`tasks`'
 * own `canWrite`/`canComplete`) or as an already-resolved node (`taskAction`,
 * `newEventAction`), decided by the loader that owns it against the §7 matrix.
 *
 * What each surface draws:
 *
 * - **`app`** — the phone's pair: the day as cards beside the household's task
 *   list, one column below `lg`. At 390px a row of time · dot · title · names
 *   runs on, so the timeline is `density="card"` — a tile with a colour bar down
 *   its left edge keeps the four facts separable.
 * - **`hub`** — the wall's two columns at the design's own `1.55fr 1fr`: what is
 *   happening *now* and then the day as a flat list, beside the routines and the
 *   task list. This is the one screen in the product read from two metres away
 *   while nobody is holding it, and the design answers that by refusing to make
 *   it scroll: everything lands on one 1194 × 834 frame.
 *
 * ## The two bands that are not the same on both
 *
 * Both are placement, both come from the design sheets, and both are kept as
 * *slots the page fills* rather than as a branch here:
 *
 * - **the NU block** — a band of `(app)/today` itself on the phone, above the
 *   tabs, so it survives a tab switch; the head of the first column on the wall
 *   ("Vandaag.dc.html"), where the panel owns the whole frame below the pills.
 *   Hence `heroEvent`/`flowMode`/`referenceNow` are only read on `hub`.
 * - **the weather card** — the top of the phone page (`0dbcd61`: what it is
 *   doing outside decides the coat before the schedule decides anything), and
 *   the head of this panel's second column on the wall.
 *
 * `banner` is *not* one of them. It is the day's headline and it belongs to the
 * day panel on both surfaces, which is the whole repair: it renders full-width
 * above the columns, and where the NU block is drawn by this component it
 * **replaces** it — the design sheet wraps the NU card in `<sc-if geenThema>`
 * ("Vandaag met thema's":404), so Kerst and the zomervakantie take its place
 * rather than pushing it down a row. On the phone the same rule is applied by
 * the page, which is where that surface's strip lives. Passing `null` (which is
 * what the other 348 days resolve to) puts the NU block back.
 */

export type TodayTabDagProps = {
  /** `app` is the phone's pair; `hub` the wall's two columns. Presentation only. */
  surface?: 'app' | 'hub';
  members: Member[];
  events: CalendarEvent[];
  timeZone: string;
  /** Household-local `YYYY-MM-DD` of the day being shown. */
  dayKey: string;
  /** The instant to measure "already happened" against. */
  now: Date;
  /** False while browsing another day — then nothing is "now" and nothing is past. */
  isToday: boolean;
  /** `CalendarEvent.key` of the live block, from the page's own `flowOf`. */
  nowEventKey: string | null;
  /** Null while browsing another day: the list is today's, or it is nothing. */
  tasks: TodayTasksData | null;
  /** The surface's own timers route — `/timers` in the app, `/hub/timers` on the wall. */
  timersHref?: string;
  /**
   * The day's theme row, already resolved by the page (`domain/theme.ts`) — on
   * both surfaces. Null on the ordinary majority of the year.
   */
  banner?: ReactNode;
  /**
   * The NU block's own inputs, from the page's `flowOf`. Read on `hub`, where
   * this panel draws the block; on the phone the strip is a band of the page.
   */
  heroEvent?: CalendarEvent | null;
  flowMode?: FlowMode;
  /** The instant the NU block measures against — the day's own on a browsed day. */
  referenceNow?: Date;
  /** Today's routine progress, for the wall's second column. */
  kids?: KidProgress[] | null;
  /**
   * The weather card (`modules/weather`'s `WeatherWidget`), resolved by the
   * page. The Vandaag sheet opens its third column with it
   * ("Vandaag.dc.html":145) and that column is this one — the August
   * recomposition merged the sheet's second and third columns, and the card
   * still sits above the quick-action grid.
   *
   * `null` on a browsed day, and the widget itself renders `null` whenever the
   * household has configured no location or nothing usable is cached, so the
   * column simply starts one card lower. That is deliberate: neither design
   * export draws an empty or unavailable weather state.
   */
  weather?: ReactNode;
  /**
   * The per-child entry points (`ChildLauncher`), rendered *inside* this tab's
   * scroller rather than under the whole board — the design gives the tab panel
   * the entire frame below the pills ("Vandaag.dc.html":72–75), and a band
   * pinned under it was taking the bottom third of an 834px wall. Hub chrome:
   * a slot the wall fills, not a branch taken here.
   */
  launcher?: ReactNode;
  /**
   * The quick-action grid's "Nieuw event" tile, already resolved by the page:
   * the dialog behind it lives in the calendar slice, and `null` wherever
   * `event:write` is denied — which on the wall is every principal (§7).
   */
  newEventAction?: ReactNode;
  /**
   * The grid's "Taak erbij" tile (`TaskComposerAction`), resolved by the page
   * for the same reason `newEventAction` is. `null` where `task:write` is
   * denied — which on the wall is every principal (§7).
   */
  taskAction?: ReactNode;
  /** `completion:write`, for the grid's "Ster geven" tile. */
  canGiveStars?: boolean;
};

export async function TodayTabDag({
  surface = 'app',
  members,
  events,
  timeZone,
  dayKey,
  now,
  isToday,
  nowEventKey,
  tasks,
  timersHref,
  banner,
  heroEvent = null,
  flowMode = 'next',
  referenceNow,
  kids = null,
  weather,
  launcher,
  newEventAction,
  taskAction,
  canGiveStars = false,
}: TodayTabDagProps) {
  const t = await getTranslations('today');

  const hub = surface === 'hub';

  const memberSurface = Object.fromEntries(
    members.map((member) => [member.id, MEMBER_COLOR_CLASSES[member.color].surface])
  );

  return (
    <div className="flex flex-col gap-5" data-surface-variant={surface}>
      {/* Rendered bare, not in a wrapper: on the 348 ordinary days of the year
          the banner resolves to `null`, and a wrapper would leave the flex gap
          behind as a hole above the columns. */}
      {banner}

      {/* Two columns on both, at each surface's own ratio. On the wall it is the
          August sheet's `1.55fr 1fr`: the day list took the width the per-person
          grid used to hold, and it needed it — its rows now carry a time
          *range*, a category glyph and the faces of everyone on the event, which
          is the same "who has what" answer the third column was giving. Per
          person is not lost, it is one pill away (`TodayTabPersonen`). From `lg`
          rather than `xl` because a wall tablet in landscape is 1194px wide and
          this composition exists to fit that frame without a scrollbar; the
          phone splits evenly and stacks below `lg`, in the order the day is
          read — what is happening, then what still has to happen. */}
      <div
        className={cn(
          'grid items-start',
          hub ? 'gap-5 lg:grid-cols-[1.55fr_1fr]' : 'gap-4 lg:grid-cols-2'
        )}
      >
        <div className="flex flex-col gap-4">
          {/* On a themed day the banner *is* the NU block — see the note above.
              Absent altogether on the phone, whose strip is a band of the page
              and would otherwise be drawn twice. */}
          {hub && !banner ? (
            <TodayNowStrip
              event={heroEvent}
              mode={flowMode}
              members={members}
              now={referenceNow ?? now}
              timeZone={timeZone}
            />
          ) : null}

          <TodayTimeline
            members={members}
            events={events}
            timeZone={timeZone}
            dayKey={dayKey}
            now={now}
            isToday={isToday}
            nowEventKey={nowEventKey}
            density={hub ? 'list' : 'card'}
          />
        </div>

        <div className="flex flex-col gap-4">
          {/* Bare, like `banner`: on a household with no location configured the
              widget resolves to nothing, and a wrapper would leave the column's
              flex gap behind as a hole above what follows. Empty on the phone,
              which draws the card at the top of the page instead. */}
          {weather}

          {/* The August sheet's 2×2 grid — a *wall* affordance, and only that.
              Its four tiles all already have a home on the phone: "Nieuw event"
              is the FAB, "Taak erbij" is the task list's own quick-add pill,
              "Timer" is the pill beside it and "Ster geven" is a tab. A grid
              there would be a third copy of the same four buttons on a 390px
              screen — the very argument that turned the list's pills off here.
              The wall has none of those: no FAB, no quick-add (`task:write` is
              denied), and a 56px target because a thumb aims at it from an
              arm's length away. Of the sheet's four tiles it then draws the two
              a device principal may actually perform, each gated on the
              permission its action would need — see `TodayQuickActions`. */}
          {hub ? (
            <TodayQuickActions
              timersHref={timersHref ?? '/timers'}
              taskAction={taskAction}
              newEventAction={newEventAction}
              canGiveStars={canGiveStars}
            />
          ) : null}

          {/* The wall carries today's routines in this column as well: it has
              one frame and no scroll, and "how the routines are going" is the
              second thing a household glances at. The phone reaches the same
              panel one pill away, and stacking it here would push the task list
              off the bottom of a phone screen. */}
          {hub ? <TodayTabRoutines kids={kids} /> : null}

          {tasks ? (
            <TaskList
              tasks={tasks.tasks}
              members={tasks.members.map((member) => ({
                id: member.id,
                displayName: member.displayName,
              }))}
              canWrite={tasks.canWrite}
              canComplete={tasks.canComplete}
              title={t('tasks.title')}
              memberSurface={memberSurface}
              timersHref={timersHref}
              // Off on the wall only: both of the list's own pills are in the
              // grid at the top of this column there, and a second copy at its
              // foot would be the same two buttons twice on one screen. On the
              // phone, where there is no grid, they are the whole affordance.
              showQuickActions={!hub}
            />
          ) : (
            <Card className="gap-3 p-5">
              <h3 className="text-overline text-ink-muted uppercase">{t('tasks.title')}</h3>
              {/* A browsed day has no honest task list: an undated task belongs
                  to no day at all, and today's dated ones are not that day's. */}
              <p className="text-body-sm text-ink-secondary">{t('tasks.otherDay')}</p>
            </Card>
          )}
        </div>
      </div>

      {launcher}
    </div>
  );
}
