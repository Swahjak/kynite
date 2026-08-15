import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Card } from '@kynite/ui';
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
 * The wall hub's "Dagoverzicht" — the whole day in two columns.
 *
 * This is the one screen in the product that is read from two metres away
 * while nobody is holding it, and the design answers that by refusing to make
 * it scroll: everything a household glances at lands on one 1194 × 834 frame.
 * So the tab that the parent app splits over four pills is, here, two columns
 * side by side —
 *
 * 1. **what is happening now**, then the day as a list, whose rows now say who
 *    each event is for with faces rather than deferring that to a column;
 * 2. **how the routines are going**, then the task list.
 *
 * The other three tabs still exist beside this one. They are the *same*
 * content at a size you can walk up to and tap, which is the second thing a
 * wall display is for.
 *
 * `banner` is the theme slot (M26, `Pages/Vandaag — thema's`): one full-width
 * row above the columns on a day that means something. It does not add to
 * the NU block, it **replaces** it — the design sheet wraps the NU card in
 * `<sc-if geenThema>`, so on Kerst or in the zomervakantie column one opens
 * with the day list instead. Passing `null` (which is what the other 348 days
 * resolve to) puts the NU block back.
 *
 * The column ratio is the design's own (`1.55fr 1fr`): the day list carries the
 * most text and now the most furniture per row, and the routines/tasks stack is
 * the narrowest thing on the screen.
 */

export type TodayHubDagProps = {
  members: Member[];
  events: CalendarEvent[];
  timeZone: string;
  dayKey: string;
  now: Date;
  isToday: boolean;
  nowEventKey: string | null;
  /** The NU block's own inputs, from the page's `flowOf`. */
  heroEvent: CalendarEvent | null;
  flowMode: FlowMode;
  /** The instant the NU block measures against — the day's own on a browsed day. */
  referenceNow: Date;
  tasks: TodayTasksData | null;
  kids: KidProgress[] | null;
  /** The day's theme row, already resolved by the page. */
  banner?: ReactNode;
  /**
   * The per-child entry points (`ChildLauncher`), rendered *inside* this tab's
   * scroller rather than under the whole board — the design gives the tab panel
   * the entire frame below the pills ("Vandaag.dc.html":72–75), and a band
   * pinned under it was taking the bottom third of an 834px wall.
   */
  launcher?: ReactNode;
  timersHref?: string;
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

export async function TodayHubDag({
  members,
  events,
  timeZone,
  dayKey,
  now,
  isToday,
  nowEventKey,
  heroEvent,
  flowMode,
  referenceNow,
  tasks,
  kids,
  banner,
  launcher,
  timersHref,
  newEventAction,
  taskAction,
  canGiveStars = false,
}: TodayHubDagProps) {
  const t = await getTranslations('today');

  const memberSurface = Object.fromEntries(
    members.map((member) => [member.id, MEMBER_COLOR_CLASSES[member.color].surface])
  );

  return (
    <div className="flex flex-col gap-5">
      {/* Rendered bare, not in a wrapper: on the 348 ordinary days of the year
          the banner resolves to `null`, and a wrapper would leave the flex gap
          behind as a hole above the columns. */}
      {banner}

      {/* Two columns, not three (August sheet). The day list took the width the
          per-person grid used to hold, and it needed it: its rows now carry a
          time *range*, a category glyph and the faces of everyone on the event,
          which is the same "who has what" answer the third column was giving —
          in place, on the row it belongs to, rather than by repeating the whole
          day once per member.

          Per-person is not lost, it is one pill away: `TodayTabPersonen` is
          still its own tab, at a size somebody can walk up to and read. Two
          columns from `lg` rather than `xl` — a wall tablet in landscape is
          1194px wide, and this composition exists to fit that frame without a
          scrollbar. */}
      <div className="grid items-start gap-5 lg:grid-cols-[1.55fr_1fr]">
        <div className="flex flex-col gap-4">
          {/* On a themed day the banner *is* the NU block: the design sheet
              wraps this card in `<sc-if geenThema>` ("Vandaag met thema's":404),
              so Kerst and the zomervakantie take its place rather than pushing
              it down a row. Two full-width statements about the same moment,
              one above the other, is the composition a wall display cannot be
              read at a glance any more. */}
          {banner ? null : (
            <TodayNowStrip
              event={heroEvent}
              mode={flowMode}
              members={members}
              now={referenceNow}
              timeZone={timeZone}
            />
          )}
          <TodayTimeline
            members={members}
            events={events}
            timeZone={timeZone}
            dayKey={dayKey}
            now={now}
            isToday={isToday}
            nowEventKey={nowEventKey}
          />
        </div>

        <div className="flex flex-col gap-4">
          {/* The August sheet's 2×2 grid. On the wall it resolves to the two
              actions a device principal may actually perform — see
              `TodayQuickActions` for why the other two are absent here. */}
          <TodayQuickActions
            timersHref={timersHref ?? '/timers'}
            taskAction={taskAction}
            newEventAction={newEventAction}
            canGiveStars={canGiveStars}
          />

          <TodayTabRoutines kids={kids} />

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
              // Both of the list's own pills are in the grid at the top of this
              // column now; a second copy at its foot would be the same two
              // buttons twice on one screen.
              showQuickActions={false}
            />
          ) : (
            <Card className="gap-3 p-5">
              <h3 className="text-overline text-ink-muted uppercase">{t('tasks.title')}</h3>
              <p className="text-body-sm text-ink-secondary">{t('tasks.otherDay')}</p>
            </Card>
          )}
        </div>
      </div>

      {launcher}
    </div>
  );
}
