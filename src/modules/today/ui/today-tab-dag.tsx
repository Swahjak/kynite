import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { formatDateTime } from '@/i18n/formatting-locale';
import { cn } from '@/lib/utils';
import { CATEGORY_CLASSES, combineDayEvents, type CalendarEvent } from '@/modules/calendar';
import { MEMBER_COLOR_CLASSES, getHouseholdFormattingLocale, type Member } from '@/modules/family';
import { TaskList, type TodayTasksData } from '@/modules/tasks';
import { MemberFaces, joinNames, namesOf } from './member-faces';
import { TodayPastRows } from './today-past-rows';

/**
 * "Dagoverzicht" — the whole household's day as one chronological timeline,
 * beside the household's task list.
 *
 * The timeline is the merged view, not the per-person one: one family dinner
 * attended by four people is one line, and `combineDayEvents` is the calendar
 * slice's own answer to that (per-person is the next tab along). Each row is a
 * time in a fixed gutter, a thread connecting it to the next, the event's
 * category as a dot, and the faces of whoever it belongs to — which in a merged
 * list is the only thing that says *whose* a row is.
 *
 * Two rows read differently, and both are facts rather than decoration:
 *
 * - **The one happening now** gets a tinted card, a 4px primary rail at the
 *   card's own left edge, and the NU badge. It is the single thing on this
 *   screen that a glance should land on.
 * - **A busy-only row** — a private calendar rendered free/busy — gets a lock
 *   and the word "Bezet" instead of a title, which is exactly as much as the
 *   viewer is allowed to know.
 *
 * Everything already over collapses into one line at the top
 * (`today-past-rows.tsx`). Nothing is dropped; the morning simply stops being
 * the first six rows of the afternoon's screen.
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
  const tCalendar = await getTranslations('calendar');
  const formattingLocale = await getHouseholdFormattingLocale();

  const at = (instant: Date) =>
    formatDateTime(instant, formattingLocale, { hour: '2-digit', minute: '2-digit', timeZone });

  const rows = combineDayEvents(
    events,
    members.map((member) => member.id),
    { timeZone, dayKey }
  );

  // "Already happened" is only meaningful on the live day: every row of a
  // browsed day is a record, and every row of a future one is ahead.
  const isPast = (event: CalendarEvent) =>
    isToday && !event.allDay && event.endsAt.getTime() <= now.getTime();

  const past = rows.filter(({ event }) => isPast(event));
  const rest = rows.filter(({ event }) => !isPast(event));

  const render = (
    { event, memberIds }: (typeof rows)[number],
    index: number,
    total: number
  ): ReactNode => {
    const palette = CATEGORY_CLASSES[event.category];
    const everyone =
      event.householdWide || memberIds.length === 0 || memberIds.length >= members.length;
    const people = everyone ? tCalendar('everyone') : joinNames(namesOf(members, memberIds));
    const faceIds = everyone ? members.map((member) => member.id) : memberIds;
    const live = isToday && event.key === nowEventKey;

    return (
      <div
        key={event.key}
        data-testid="today-timeline-row"
        data-state={live ? 'now' : 'default'}
        data-category={event.category}
        className="relative flex gap-3.5"
      >
        {/* The rail sits at the *card's* left edge, not the row's: `-left-5`
            against the card's own `p-5`. The card clips it to its radius, which
            is what gives the mockup's rounded 4px bar. */}
        {live ? (
          <span
            aria-hidden="true"
            className="absolute top-0 bottom-2 -left-5 w-1 rounded-r bg-primary"
          />
        ) : null}

        <div className="flex w-11 shrink-0 flex-col items-center">
          <span
            className={cn(
              'text-body-sm tabular-nums',
              live ? 'font-bold text-primary' : 'text-ink-secondary'
            )}
          >
            {event.allDay ? t('allDay') : at(event.startsAt)}
          </span>
          {index < total - 1 ? (
            <span aria-hidden="true" className="mt-1 min-h-6 w-px flex-1 bg-line" />
          ) : null}
        </div>

        <div
          className={cn(
            'flex min-w-0 flex-1 flex-col pb-4',
            live && '-ml-2 rounded-r-xl bg-primary/6 px-3 py-2.5'
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex min-w-0 items-center gap-2">
              {event.busyOnly ? (
                <Icon name="lock" size="xs" className="text-ink-muted" />
              ) : (
                <span
                  aria-hidden="true"
                  className={cn('size-2 shrink-0 rounded-4xl', palette.solid)}
                />
              )}
              <span
                className={cn(
                  'min-w-0 truncate text-body-sm',
                  live && 'font-bold',
                  event.busyOnly && 'text-ink-muted'
                )}
              >
                {event.busyOnly ? tCalendar('busy') : event.title}
              </span>
            </div>

            {live ? (
              <span className="rounded-4xl bg-primary px-2.5 py-0.5 text-overline text-primary-foreground uppercase">
                {t('now.eyebrowLive')}
              </span>
            ) : null}
          </div>

          <div className="mt-1 ml-4 flex min-w-0 items-center gap-1.5">
            <MemberFaces members={members} memberIds={faceIds} size="xs" />
            <span className="truncate text-caption text-ink-secondary">{people}</span>
          </div>
        </div>
      </div>
    );
  };

  const lastPast = past.at(-1);
  const memberSurface = Object.fromEntries(
    members.map((member) => [member.id, MEMBER_COLOR_CLASSES[member.color].surface])
  );

  return (
    // Two columns from `lg` up, one below it. The timeline needs the width more
    // than the task list does, and a phone stacks them in the order they are
    // read: what is happening, then what still has to happen.
    <div className="grid gap-4 lg:grid-cols-2">
      <Card data-testid="today-timeline" className="gap-4 p-5">
        <h3 className="font-display text-h3 font-bold">{t('timeline.title')}</h3>

        {rows.length === 0 ? (
          <p className="text-body-sm text-ink-secondary">{tCalendar('freeDay')}</p>
        ) : (
          <div className="flex flex-col">
            {past.length > 0 && lastPast ? (
              <TodayPastRows
                summary={t('timeline.done', {
                  count: past.length,
                  title: lastPast.event.busyOnly ? tCalendar('busy') : lastPast.event.title,
                  time: lastPast.event.allDay ? t('allDay') : at(lastPast.event.startsAt),
                })}
                label={t('timeline.showDone')}
              >
                {past.map((row, index) => render(row, index, past.length))}
              </TodayPastRows>
            ) : null}

            {rest.map((row, index) => render(row, index, rest.length))}
          </div>
        )}
      </Card>

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
