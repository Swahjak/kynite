import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Card } from '@kynite/ui';
import type { CalendarEvent } from '@/modules/calendar';
import { MEMBER_COLOR_CLASSES, type Member } from '@/modules/family';
import { TaskList, type TodayTasksData } from '@/modules/tasks';
import type { FlowMode } from '../domain/flow';
import type { KidProgress } from '../page-data';
import { TodayNowStrip } from './today-now-strip';
import { TodayTabPersonen } from './today-tab-personen';
import { TodayTabRoutines } from './today-tab-routines';
import { TodayTimeline } from './today-timeline';

/**
 * The wall hub's "Dagoverzicht" — the whole day in three columns.
 *
 * This is the one screen in the product that is read from two metres away
 * while nobody is holding it, and the design answers that by refusing to make
 * it scroll: everything a household glances at lands on one 1194 × 834 frame.
 * So the tab that the parent app splits over four pills is, here, three columns
 * side by side —
 *
 * 1. **what is happening now**, then the day as a list;
 * 2. **who has what**, the per-person grid;
 * 3. **how the routines are going**, then the task list.
 *
 * The other three tabs still exist beside this one. They are the *same*
 * content at a size you can walk up to and tap, which is the second thing a
 * wall display is for.
 *
 * `banner` is the theme slot (M26, `Pages/Vandaag — thema's`): one full-width
 * row above the three columns on a day that means something. It does not add to
 * the NU block, it **replaces** it — the design sheet wraps the NU card in
 * `<sc-if geenThema>`, so on Kerst or in the zomervakantie column one opens
 * with the day list instead. Passing `null` (which is what the other 348 days
 * resolve to) puts the NU block back.
 *
 * The column ratio is the design's own (`1.15fr 1fr 0.95fr`): the day list
 * carries the most text, the per-person grid is two columns of short lines, and
 * the routines/tasks stack is the narrowest thing on the screen.
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

      {/* The design's own ratio: the day list carries the most text, the
          per-person grid is two columns of short lines, and the routines/tasks
          stack is the narrowest thing on the screen. Three columns from `lg`
          rather than `xl` — a wall tablet in landscape is 1194px wide, and this
          composition exists to fit that frame without a scrollbar. */}
      <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_1fr_0.95fr]">
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

        <TodayTabPersonen
          members={members}
          events={events}
          timeZone={timeZone}
          dayKey={dayKey}
          now={now}
          isToday={isToday}
          nowEventKey={nowEventKey}
        />

        <div className="flex flex-col gap-4">
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
