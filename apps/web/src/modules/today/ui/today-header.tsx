import { getTranslations } from 'next-intl/server';
import { cn, Icon } from '@kynite/ui';
import { Link } from '@/i18n/navigation';
import { formatDateTime } from '@/i18n/formatting-locale';
import { CATEGORY_CLASSES, addDays, toDateKey, toWall } from '@/modules/calendar';
import { MemberAvatar, getHouseholdFormattingLocale, type Member } from '@/modules/family';
import { CONFETTI_SLUGS, specialDaysOn, upcomingCountdown } from '@/modules/holidays';
import { HolidayConfetti } from './holiday-confetti';
import { TodayClock } from './today-clock';

/**
 * The top row of `/today`: greeting, day navigation, clock.
 *
 * Three things a parent needs before anything else, in the order they are
 * asked for — who this screen is for, which day it is showing, and what time it
 * is now. The mockup lays them out as one wrapping flex row, which at 390px
 * stacks into three lines without a single media query.
 *
 * A fourth thing appears on about seventeen days a year: the festive line
 * (M26). When the day being shown is a speciale dag it gets a chip — the day's
 * emoji and its name, in the day's own accent — and in the ten nights before
 * Pakjesavond or Eerste Kerstdag, a "nog 3 nachtjes slapen" chip beside it. A
 * line under the greeting rather than a banner over the page: the day is a
 * *fact about today*, and today is what this header is for.
 *
 * The day pill is the part that is new. `/today` has always accepted `?date=`
 * — the flow, the board and the progress panel all branch on it — but nothing
 * on the page ever *offered* it, so browsing yesterday required editing a URL.
 * The chevrons are plain links (a day is a location, not a state), and the
 * label is a link home to today whenever it is not already there, which is the
 * only way back a parent will look for.
 */

export type TodayHeaderProps = {
  /** Already resolved by the page — "Goedemorgen, Tom", or the plain title. */
  greeting: string;
  /** The day being shown, and the household's real clock. */
  anchor: Date;
  now: Date;
  timeZone: string;
  /** Household-local `YYYY-MM-DD` of `anchor`. */
  dayKey: string;
  isToday: boolean;
  /**
   * The route the day pill browses. `/today` in the parent app, `/hub` on the
   * wall display — the composition is the same screen on both surfaces, and a
   * chevron that navigated a kiosk out of the `(hub)` tree would hand it to a
   * gate that sends it straight back to the pair screen.
   */
  href?: string;
  /**
   * The signed-in member, for the face at the right of the phone's header row
   * ("Vandaag.dc.html":350–357). Absent for a principal with no member row —
   * the row then simply has no face, exactly as the greeting degrades to the
   * plain title.
   */
  viewer?: Member | null;
};

export async function TodayHeader({
  greeting,
  anchor,
  now,
  timeZone,
  dayKey,
  isToday,
  href = '/today',
  viewer,
}: TodayHeaderProps) {
  const t = await getTranslations('today');
  const tHolidays = await getTranslations('holidays');
  const formattingLocale = await getHouseholdFormattingLocale();

  /**
   * The festive half (M26), all of it computed from `dayKey` — which the page
   * already resolved in the *household's* timezone, so a family in Curaçao is
   * not told it is Kerst while it still is not.
   *
   * The chip follows the day being *shown*: browsing to 5 december and finding
   * Pakjesavond there is the same fact, stated a week early. The countdown and
   * the confetti do not — "nog 3 nachtjes slapen" under yesterday's date is a
   * wrong number, and a party for a day already past is a strange thing for a
   * screen to throw.
   */
  const special = specialDaysOn(dayKey);
  const countdown = isToday ? upcomingCountdown(dayKey) : null;
  const celebrating = isToday && special.some((day) => CONFETTI_SLUGS.includes(day.slug));

  const wall = toWall(anchor, timeZone);
  const previous = toDateKey(addDays(wall, -1));
  const next = toDateKey(addDays(wall, 1));

  // The pill's own label: "Vandaag" while on today, the day's date otherwise —
  // a date is what makes "am I looking at Thursday or Friday" answerable at a
  // glance, and it is the only place that fact appears once the clock stops
  // being the day being shown.
  const label = isToday
    ? t('title')
    : formatDateTime(anchor, formattingLocale, {
        day: 'numeric',
        month: 'short',
        weekday: 'short',
      });

  const chevron =
    'flex size-8 items-center justify-center rounded-4xl text-ink-muted transition-colors duration-200 ease-brand hover:bg-surface-container hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none';

  return (
    // One row, and it stays one row at 390px. It used to be
    // `flex-wrap`, which on a phone put the greeting on line one and gave the
    // *entire* second line to a day-navigation pill nobody had asked for —
    // where the design gives that row a greeting, a date and a face
    // ("Vandaag.dc.html":350–357). The pill survives (it is the only way to
    // browse another day) with its label hidden below `sm`, which is the two
    // chevrons and nothing else.
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* One step down on a phone: the design sets the greeting at 24px on
            390px and 32px once there is room for it. */}
        <h1 className="font-display text-h2 font-extrabold sm:text-h1" data-testid="today-greeting">
          {greeting}
        </h1>

        {/* The day, under the greeting rather than only beside the clock — a
            phone hides the clock (it has one of its own in the status bar), and
            without this line nothing on the screen would say which day it is. */}
        <span className="text-caption text-ink-secondary sm:hidden">
          {formatDateTime(anchor, formattingLocale, {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone,
          })}
        </span>

        {(special.length > 0 || countdown) && (
          <div className="flex flex-wrap items-center gap-2" data-testid="today-festive">
            {special.map((day) => (
              <span
                key={day.slug}
                data-testid="today-special-day"
                data-slug={day.slug}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-4xl px-2.5 py-1 text-body-sm font-semibold',
                  CATEGORY_CLASSES[day.accent].surface,
                  CATEGORY_CLASSES[day.accent].text
                )}
              >
                <span role="img" aria-label={tHolidays('badgeLabel')}>
                  {day.emoji}
                </span>
                {tHolidays(`days.${day.slug}`)}
              </span>
            ))}

            {/* The one number small children ask for by name. Always the
                brand's festive orange, whatever the day's own accent is — it
                is the *anticipation* that is being coloured, not the day. */}
            {countdown && (
              <span
                data-testid="today-countdown"
                data-slug={countdown.slug}
                className="inline-flex items-center gap-1.5 rounded-4xl bg-cat-orange-surface px-2.5 py-1 text-body-sm font-semibold text-cat-orange-fg"
              >
                <span aria-hidden="true">{countdown.emoji}</span>
                {tHolidays('countdown', {
                  count: countdown.nights,
                  day: tHolidays(`days.${countdown.slug}`),
                })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* One burst, once per day, per device — and only on the handful of days
          that earn it (`HolidayConfetti`). Mounted here so `/today` and `/hub`
          both get it without either page knowing. */}
      {celebrating && <HolidayConfetti dayKey={dayKey} />}

      <div className="flex shrink-0 items-center gap-2">
        <nav
          data-testid="today-day-nav"
          aria-label={t('dayNav.label')}
          className="flex items-center gap-1.5 rounded-4xl border border-line-subtle bg-card p-1.5 shadow-sm"
        >
          <Link
            href={`${href}?date=${previous}`}
            aria-label={t('dayNav.previous')}
            data-testid="today-day-prev"
            className={chevron}
          >
            <Icon name="chevron_left" size="sm" />
          </Link>

          {isToday ? (
            <span className="hidden px-1 font-display text-body-sm font-bold sm:inline">
              {label}
            </span>
          ) : (
            <Link
              href={href}
              data-testid="today-day-reset"
              className="rounded-4xl px-2 font-display text-body-sm font-bold hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {label}
            </Link>
          )}

          <Link
            href={`${href}?date=${next}`}
            aria-label={t('dayNav.next')}
            data-testid="today-day-next"
            className={chevron}
          >
            <Icon name="chevron_right" size="sm" />
          </Link>
        </nav>

        {/* The phone's own face, at the design's 36px. Above `sm` the shell's
          rail already carries it in the user menu, and two faces for one
          person on one screen is one too many. */}
        {viewer ? (
          <MemberAvatar
            displayName={viewer.displayName}
            avatarUrl={viewer.avatarUrl}
            color={viewer.color}
            size="default"
            className="shrink-0 sm:hidden"
          />
        ) : null}

        {/* Only *today* gets a ticking clock. A browsed day keeps its own static
          date rather than silently jumping forward at midnight because a tab
          was left open on it — see `TodayClock`'s own note on the rollover.
          Hidden below `sm`: a phone already carries the time in its status bar,
          and the design gives that space back to the day itself. */}
        {isToday ? (
          <TodayClock now={now} timeZone={timeZone} dayKey={dayKey} className="hidden sm:flex" />
        ) : (
          <div
            data-testid="today-clock"
            className={cn('hidden flex-col items-end text-right sm:flex')}
          >
            <span className="font-display text-h2 font-bold tabular-nums">
              {formatDateTime(anchor, formattingLocale, {
                day: 'numeric',
                month: 'short',
                timeZone,
              })}
            </span>
            <span className="text-body-sm text-ink-secondary">
              {formatDateTime(anchor, formattingLocale, { dateStyle: 'full', timeZone })}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
