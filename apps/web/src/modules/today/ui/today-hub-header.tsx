import { getTranslations } from 'next-intl/server';
import { FaceStack, Icon, PageHeader, type StackedFace } from '@kynite/ui';
import { Link } from '@/i18n/navigation';
import { formatDateTime } from '@/i18n/formatting-locale';
import { addDays, toDateKey, toWall } from '@/modules/calendar';
import { MEMBER_COLOR_CLASSES, getHouseholdFormattingLocale, type Member } from '@/modules/family';
import { TodayClock } from './today-clock';

/**
 * The wall hub's top band — greeting, the day in words, the family, the clock.
 *
 * A different header from the parent app's, and deliberately so. The app greets
 * *a person* and gives them a day picker; a wall tablet has nobody signed in by
 * construction, and the two things it has to say from two metres away are what
 * time it is and which day this is. So the composition is the design's: the
 * greeting and the full date on the left, and on the right the household's
 * faces beside a clock set two type steps larger than anything else on the
 * screen.
 *
 * The day chevrons survive, quietly, at the head of the right-hand cluster.
 * `?date=` is what a tomorrow-preview is, and a wall with no control for it
 * would be a feature reachable only by typing a URL into a kiosk that has no
 * address bar. They are the one thing here the design sheet does not draw, and
 * they earn their place by being the only way back from a browsed day.
 */

export type TodayHubHeaderProps = {
  /** Already resolved by the page — the household-scale "Goedemorgen". */
  greeting: string;
  anchor: Date;
  now: Date;
  timeZone: string;
  /** Household-local `YYYY-MM-DD` of `anchor`. */
  dayKey: string;
  isToday: boolean;
  members: Member[];
  /** The route the chevrons browse — `/hub`, so a kiosk stays in its own tree. */
  href?: string;
};

export async function TodayHubHeader({
  greeting,
  anchor,
  now,
  timeZone,
  dayKey,
  isToday,
  members,
  href = '/hub',
}: TodayHubHeaderProps) {
  const t = await getTranslations('today');
  const formattingLocale = await getHouseholdFormattingLocale();

  const wall = toWall(anchor, timeZone);
  const previous = toDateKey(addDays(wall, -1));
  const next = toDateKey(addDays(wall, 1));

  const faces: StackedFace[] = members.map((member) => ({
    id: member.id,
    name: member.displayName,
    avatarUrl: member.avatarUrl,
    surfaceClass: MEMBER_COLOR_CLASSES[member.color].surface,
  }));

  const chevron =
    'flex size-9 items-center justify-center rounded-4xl text-ink-muted transition-colors duration-200 ease-brand hover:bg-surface-container hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

  return (
    <PageHeader
      surface="hub"
      title={greeting}
      subtitle={formatDateTime(anchor, formattingLocale, { dateStyle: 'full', timeZone })}
      action={
        <div className="flex items-center gap-4">
          <nav
            data-testid="today-day-nav"
            aria-label={t('dayNav.label')}
            className="flex items-center gap-0.5"
          >
            <Link
              href={`${href}?date=${previous}`}
              aria-label={t('dayNav.previous')}
              data-testid="today-day-prev"
              className={chevron}
            >
              <Icon name="chevron_left" size="sm" />
            </Link>

            {/* Only offered when it means something: on today it would be a
                link to the page you are already on. */}
            {isToday ? null : (
              <Link
                href={href}
                data-testid="today-day-reset"
                className="rounded-4xl px-2 font-display text-body-sm font-bold hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {t('title')}
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

          <FaceStack faces={faces} size="default" label={t('familyLabel')} />

          {/* The one element on the screen sized for the far side of the
              kitchen, beside the NU block. A browsed day keeps its own date
              rather than ticking forward at midnight — see `TodayClock`. */}
          {isToday ? (
            <TodayClock now={now} timeZone={timeZone} dayKey={dayKey} variant="hub" />
          ) : (
            <span
              data-testid="today-clock"
              className="font-display text-display-md font-extrabold tabular-nums"
            >
              {formatDateTime(anchor, formattingLocale, {
                day: 'numeric',
                month: 'short',
                timeZone,
              })}
            </span>
          )}
        </div>
      }
    />
  );
}
