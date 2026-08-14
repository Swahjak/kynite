import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/ui/icon';
import { Link } from '@/i18n/navigation';
import { formatDateTime } from '@/i18n/formatting-locale';
import { cn } from '@/lib/utils';
import { addDays, toDateKey, toWall } from '@/modules/calendar';
import { getHouseholdFormattingLocale } from '@/modules/family';
import { TodayClock } from './today-clock';

/**
 * The top row of `/today`: greeting, day navigation, clock.
 *
 * Three things a parent needs before anything else, in the order they are
 * asked for — who this screen is for, which day it is showing, and what time it
 * is now. The mockup lays them out as one wrapping flex row, which at 390px
 * stacks into three lines without a single media query.
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
};

export async function TodayHeader({
  greeting,
  anchor,
  now,
  timeZone,
  dayKey,
  isToday,
}: TodayHeaderProps) {
  const t = await getTranslations('today');
  const formattingLocale = await getHouseholdFormattingLocale();

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
    'flex size-8 items-center justify-center rounded-4xl text-ink-muted transition-colors duration-200 ease-brand hover:bg-surface-container hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="font-display text-h1 font-extrabold" data-testid="today-greeting">
        {greeting}
      </h1>

      <nav
        data-testid="today-day-nav"
        aria-label={t('dayNav.label')}
        className="flex items-center gap-1.5 rounded-4xl border border-line-subtle bg-card p-1.5 shadow-sm"
      >
        <Link
          href={`/today?date=${previous}`}
          aria-label={t('dayNav.previous')}
          data-testid="today-day-prev"
          className={chevron}
        >
          <Icon name="chevron_left" size="sm" />
        </Link>

        {isToday ? (
          <span className="px-1 font-display text-body-sm font-bold">{label}</span>
        ) : (
          <Link
            href="/today"
            data-testid="today-day-reset"
            className="rounded-4xl px-2 font-display text-body-sm font-bold hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {label}
          </Link>
        )}

        <Link
          href={`/today?date=${next}`}
          aria-label={t('dayNav.next')}
          data-testid="today-day-next"
          className={chevron}
        >
          <Icon name="chevron_right" size="sm" />
        </Link>
      </nav>

      {/* Only *today* gets a ticking clock. A browsed day keeps its own static
          date rather than silently jumping forward at midnight because a tab
          was left open on it — see `TodayClock`'s own note on the rollover. */}
      {isToday ? (
        <TodayClock now={now} timeZone={timeZone} dayKey={dayKey} />
      ) : (
        <div data-testid="today-clock" className={cn('flex flex-col items-end text-right')}>
          <span className="font-display text-h2 font-bold tabular-nums">
            {formatDateTime(anchor, formattingLocale, { day: 'numeric', month: 'short', timeZone })}
          </span>
          <span className="text-body-sm text-ink-secondary">
            {formatDateTime(anchor, formattingLocale, { dateStyle: 'full', timeZone })}
          </span>
        </div>
      )}
    </header>
  );
}
