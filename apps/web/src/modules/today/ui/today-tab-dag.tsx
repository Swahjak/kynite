import { getTranslations } from 'next-intl/server';
import { Card } from '@kynite/ui';
import type { CalendarEvent } from '@/modules/calendar';
import { MEMBER_COLOR_CLASSES, type Member } from '@/modules/family';
import { TaskList, type TodayTasksData } from '@/modules/tasks';
import { TodayTimeline } from './today-timeline';

/**
 * "Dagoverzicht" — the household's day beside the household's task list.
 *
 * The two halves are both shared components now: the timeline is
 * `TodayTimeline` (which the wall hub also draws, in the first of its three
 * columns) and the list is the tasks slice's own `TaskList`. What this file
 * owns is only the *pairing* of them, which is the parent app's arrangement —
 * the hub puts the task list in a third column instead, beside the routines.
 *
 * Two columns from `lg` up, one below it. The timeline needs the width more
 * than the task list does, and a phone stacks them in the order they are read:
 * what is happening, then what still has to happen.
 */

export type TodayTabDagProps = {
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
};

export async function TodayTabDag({
  members,
  events,
  timeZone,
  dayKey,
  now,
  isToday,
  nowEventKey,
  tasks,
  timersHref,
}: TodayTabDagProps) {
  const t = await getTranslations('today');

  const memberSurface = Object.fromEntries(
    members.map((member) => [member.id, MEMBER_COLOR_CLASSES[member.color].surface])
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Cards, not the hub's flat list. The parent app is a phone first, and
          at 390px a row of time · dot · title · names runs on; a tile with a
          colour bar down its left edge keeps the four facts separable. */}
      <TodayTimeline
        members={members}
        events={events}
        timeZone={timeZone}
        dayKey={dayKey}
        now={now}
        isToday={isToday}
        nowEventKey={nowEventKey}
        density="card"
      />

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
          {/* A browsed day has no honest task list: an undated task belongs to
              no day at all, and today's dated ones are not that day's. */}
          <p className="text-body-sm text-ink-secondary">{t('tasks.otherDay')}</p>
        </Card>
      )}
    </div>
  );
}
