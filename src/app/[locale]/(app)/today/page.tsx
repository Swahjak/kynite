import { getFormatter, getTranslations } from 'next-intl/server';
import { cn } from '@/lib/utils';
import {
  NewEventFab,
  PersonColumns,
  dayKeysOf,
  isSameDay,
  loadCalendarPage,
  toDateKey,
  toWall,
} from '@/modules/calendar';
import { firstNameOf, getMember, getPrincipal, greetingSlotFor, hourIn } from '@/modules/family';
import {
  KidsProgress,
  NowHero,
  TodayLive,
  UP_NEXT_LIMIT,
  UpNextGrid,
  flowOf,
  loadTodayProgress,
  type DayReference,
} from '@/modules/today';
import { redirect } from '@/i18n/navigation';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * `(app)/today` — the family's day, recomposed to the mockup
 * (`docs/design/stitch/.../today_s_flow_light_mode/code.html`, and
 * `docs/rebuild-design-gaps.md` §3, which recorded that none of it existed).
 *
 * M19 phase 2 turns what was a greeting over a column board into the three-part
 * flow the mockup describes: a filled-primary **NOW** hero with a progress
 * ring, an **Up Next** grid of tinted blocks, and a **Kids' Progress** sidebar
 * — over a 12-column 8/4 split on a desktop and a single stack at 390px.
 *
 * The per-person board is *kept*, below the flow. It is still the only view
 * that answers "what does each of us have today" at a glance, and it carries
 * the `member-column` hooks the e2e suite reads; the flow above it answers a
 * different question ("what is happening, and what is next") that the board
 * never did.
 *
 * Route files hold no logic (architecture §2 rule 4): everything here is two
 * loaders, one pure `flowOf` call and the slices' own components.
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
  const format = await getFormatter();

  /**
   * The greeting (M18).
   *
   * `/today` is the first screen a signed-in parent lands on, and until M18 it
   * opened with the word "Vandaag" and a date — true, and completely anonymous.
   * The slot is resolved against the *household's* timezone (`data.timeZone`),
   * not the server's: a family in Curaçao must not be wished a good evening
   * over breakfast.
   *
   * It degrades rather than fails: a principal with no member row, or a member
   * with a blank display name, simply keeps the plain title.
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
  const flow = flowOf(dayEvents, reference, UP_NEXT_LIMIT);

  // "Kids' Progress" is *today's* progress: routine steps due now, stars earned
  // since this morning. There is no such thing for a day being browsed — a
  // future day has no completions and a past one would need a historical read
  // this panel does not do — so the sidebar is simply absent there rather than
  // showing today's numbers under yesterday's date.
  const progress = isToday ? await loadTodayProgress({ now: data.now }) : null;

  return (
    <main
      className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-6"
      data-testid="today-board"
    >
      {/* A subscription, not a widget — see `TodayLive`. */}
      <TodayLive />

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-h1 font-bold" data-testid="today-greeting">
          {firstName ? tCommon(`greeting.${slot}`, { name: firstName }) : t('title')}
        </h1>
        {/* The mockup's "● Online • Monday, Oct 14" line. The dot is the
            product's own liveness cue and the date is the same one this page
            has always carried. There is deliberately no second clock: M19 phase
            1 put a live one in the shell's glass header, and two clocks on one
            screen is one clock too many. */}
        <p className="flex items-center gap-2 text-body text-ink-secondary">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-4xl bg-success" />
          {format.dateTime(data.anchor, { dateStyle: 'full' })}
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-12">
        <div
          className={cn(
            'flex min-w-0 flex-col gap-6',
            progress ? 'lg:col-span-8' : 'lg:col-span-12'
          )}
        >
          <NowHero
            event={flow.hero}
            mode={flow.mode}
            members={data.members}
            now={reference.now}
            timeZone={data.timeZone}
            dayKey={dayKey}
          />

          <UpNextGrid
            events={flow.upNext}
            members={data.members}
            timeZone={data.timeZone}
            limit={UP_NEXT_LIMIT}
            mode={flow.mode}
          />

          <section className="flex min-h-0 flex-col gap-3">
            <h3 className="pl-1 text-overline text-ink-muted uppercase">{t('board.title')}</h3>
            <PersonColumns
              members={data.members}
              events={data.events}
              timeZone={data.timeZone}
              day={data.anchor}
              now={data.now}
            />
          </section>
        </div>

        {progress ? <KidsProgress kids={progress.kids} className="lg:col-span-4" /> : null}
      </div>

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
