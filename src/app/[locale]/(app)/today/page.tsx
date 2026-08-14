import { getTranslations } from 'next-intl/server';
import {
  NewEventFab,
  dayKeysOf,
  isSameDay,
  loadCalendarPage,
  toDateKey,
  toWall,
} from '@/modules/calendar';
import { firstNameOf, getMember, getPrincipal, greetingSlotFor, hourIn } from '@/modules/family';
import { loadTodayTasks } from '@/modules/tasks';
import {
  TodayHeader,
  TodayLive,
  TodayNowStrip,
  TodayTabDag,
  TodayTabPersonen,
  TodayTabRoutines,
  TodayTabSterren,
  TodayTabs,
  flowOf,
  loadTodayProgress,
  type DayReference,
} from '@/modules/today';
import { redirect } from '@/i18n/navigation';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * `(app)/today` — the family's day (`docs/design/vandaag-template.html`).
 *
 * The page is three bands, and each answers one question:
 *
 * 1. **The header** — who this is for, which day it is showing, what time it
 *    is. The day pill is new: `?date=` has always worked, but nothing on the
 *    page ever offered it.
 * 2. **The NU strip** — what is happening right now, in one line. It replaces
 *    M19's filled-primary hero plus its four-tile "Up Next" grid, which took
 *    the whole first screen to say two things. The day itself is what deserves
 *    that space.
 * 3. **Four tabs** — the day as a timeline beside the household's task list;
 *    the day per person; today's routine progress; today's stars. The day
 *    board's own combined/columns switcher is gone from this page: its two
 *    arrangements are now two of four peers, and the switcher lives on the
 *    pills.
 *
 * Everything the tabs need is loaded **here**, in one server pass, and handed
 * down already rendered. Switching tabs is then a re-render over data that is
 * already in the page — no request, no spinner, no loading state to design —
 * which is also why the tab choice never enters the URL.
 *
 * Route files hold no logic (architecture §2 rule 4): everything below is three
 * loaders, one pure `flowOf` call, and the slices' own components.
 */
export default async function TodayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { locale } = await params;
  const { date } = await searchParams;

  // `?date=` browses another day in the same layout. Defaults to today, which
  // is the only thing the nav ever links to.
  const data = await loadCalendarPage({ view: 'day', date });
  if (!data) redirect({ href: '/sign-in', locale });
  if (!data) return null;

  const t = await getTranslations('today');
  const tCommon = await getTranslations('common');

  /**
   * The greeting (M18).
   *
   * The slot is resolved against the *household's* timezone (`data.timeZone`),
   * not the server's: a family in Curaçao must not be wished a good evening
   * over breakfast. It degrades rather than fails — a principal with no member
   * row, or a member with a blank display name, keeps the plain title.
   */
  const principal = await getPrincipal();
  const viewer =
    principal?.kind === 'member' ? await getMember(principal.familyId, principal.memberId) : null;
  const firstName = viewer ? firstNameOf(viewer.displayName) : '';
  const slot = greetingSlotFor(hourIn(data.now, data.timeZone));

  const dayKey = toDateKey(toWall(data.anchor, data.timeZone));
  const dayEvents = data.events.filter((event) =>
    dayKeysOf(event, data.timeZone, event.allDay).includes(dayKey)
  );

  /**
   * Which day is being looked at, stated rather than smuggled.
   *
   * The flow used to receive only an instant — the real clock on today, the
   * day's own midnight on a browsed one — and every downstream decision then
   * had to guess from it. A browsed *past* day came out of that as "nothing
   * left today", which is a lie about a day that was full. So the kind is
   * explicit and `flowOf` branches on it (`modules/today/domain/flow.ts`).
   */
  const isToday = isSameDay(data.anchor, data.now, data.timeZone);
  const reference: DayReference = isToday
    ? { kind: 'today', now: data.now }
    : { kind: data.anchor.getTime() < data.now.getTime() ? 'past' : 'future', now: data.anchor };
  const flow = flowOf(dayEvents, reference);

  /**
   * The two reads that are only true of *today*.
   *
   * Routine progress is today's completions and today's stars; the task list is
   * the household's open list, whose undated rows belong to no day at all.
   * Neither has an honest form under yesterday's date, so a browsed day gets
   * `null` and the panels say so rather than showing today's numbers.
   */
  const [progress, tasks] = await Promise.all([
    isToday ? loadTodayProgress({ now: data.now }) : null,
    isToday ? loadTodayTasks({ now: data.now }) : null,
  ]);

  const nowEventKey = flow.live ? (flow.hero?.key ?? null) : null;

  return (
    <main
      className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-5 p-4 sm:p-6"
      data-testid="today-board"
    >
      {/* A subscription, not a widget — see `TodayLive`. */}
      <TodayLive />

      <TodayHeader
        greeting={firstName ? tCommon(`greeting.${slot}`, { name: firstName }) : t('title')}
        anchor={data.anchor}
        now={data.now}
        timeZone={data.timeZone}
        dayKey={dayKey}
        isToday={isToday}
      />

      <TodayNowStrip
        event={flow.hero}
        mode={flow.mode}
        members={data.members}
        now={reference.now}
        timeZone={data.timeZone}
      />

      <TodayTabs
        dag={
          <TodayTabDag
            members={data.members}
            events={data.events}
            timeZone={data.timeZone}
            dayKey={dayKey}
            now={data.now}
            isToday={isToday}
            nowEventKey={nowEventKey}
            tasks={tasks}
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
        sterren={<TodayTabSterren kids={progress?.kids ?? null} />}
      />

      {/* The shell positions it; this page owns what it does (`ui/fab.tsx`). */}
      <NewEventFab
        members={data.members}
        calendars={data.calendars}
        timeZone={data.timeZone}
        defaultStart={data.anchor}
        canWrite={data.canWrite}
      />
    </main>
  );
}
