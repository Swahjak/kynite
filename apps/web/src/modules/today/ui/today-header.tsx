import { getTranslations } from 'next-intl/server';
import { FaceStack, Icon, PageHeader, cn, type StackedFace } from '@kynite/ui';
import { Link } from '@/i18n/navigation';
import { formatDateTime } from '@/i18n/formatting-locale';
import { CATEGORY_CLASSES, addDays, toDateKey, toWall } from '@/modules/calendar';
import {
  MEMBER_COLOR_CLASSES,
  MemberAvatar,
  getHouseholdFormattingLocale,
  type Member,
} from '@/modules/family';
import { CONFETTI_SLUGS, specialDaysOn, upcomingCountdown } from '@/modules/holidays';
import { HolidayConfetti } from './holiday-confetti';
import { TodayClock } from './today-clock';

/**
 * The top band of the day — on the phone (`(app)/today`) and on the wall hub
 * (`(hub)/hub`), which are the same screen at two sizes.
 *
 * Three things a family needs before anything else, in the order they are asked
 * for — who this screen is for, which day it is showing, and what time it is
 * now. A fourth appears on about seventeen days a year: the festive line (M26),
 * the day's own chip and, in the ten nights before Pakjesavond or Eerste
 * Kerstdag, "nog 3 nachtjes slapen" beside it.
 *
 * ## Why one component and not two
 *
 * There used to be a `TodayHubHeader` next to this one. Nothing was decided by
 * that split — it was a fork — and the cost showed up immediately: the festive
 * treatment landed on the phone half and the wall stayed quiet on Pakjesavond,
 * because by then there was a second file nobody thought to change. `5dc38ee`'s
 * rule for this whole composition is that "the hub is the app with restricted
 * permissions, not a second product", so the header follows it too:
 * `surface` varies **presentation only** — type scale, chrome, which cluster
 * sits on the right — and never what is fetched or what a principal may do.
 *
 * What each surface draws:
 *
 * - **`app`** — a plain flex row that stays one row at 390px: the greeting over
 *   the day and the festive line, then the day pill, the viewer's own face and
 *   (above `sm`) the clock. The greeting is *personal* because the page hands
 *   one in; see `viewer` below.
 * - **`hub`** — the design's kiosk band (`PageHeader surface="hub"`): the
 *   household greeting at `display-md` over the full date and the festive line,
 *   and on the right the day chevrons, the household's faces and a clock two
 *   type steps larger than anything else on the screen. A wall tablet has
 *   nobody signed in by construction (§7), so it passes no `viewer` and gets no
 *   personal chrome — that is a prop it does not pass, not a branch taken here.
 *
 * The day pill/chevrons exist on both. `/today` has always accepted `?date=`,
 * but nothing on either page ever *offered* it, so browsing yesterday required
 * editing a URL — which a kiosk with no address bar cannot do at all. They are
 * plain links (a day is a location, not a state), and the label is a link home
 * to today whenever it is not already there.
 */

export type TodayHeaderProps = {
  /**
   * Already resolved by the page — "Goedemorgen, Tom" on a phone, the plain
   * household "Goedemorgen" on the wall. Resolved *there* rather than here
   * because only the page knows its principal.
   */
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
   * wall display — a chevron that navigated a kiosk out of the `(hub)` tree
   * would hand it to a gate that sends it straight back to the pair screen.
   */
  href?: string;
  /** `app` is the phone's row; `hub` the wall's kiosk band. Presentation only. */
  surface?: 'app' | 'hub';
  /**
   * The signed-in member, for the face at the right of the phone's header row
   * ("Vandaag.dc.html":350–357). Absent for a principal with no member row —
   * the row then simply has no face, exactly as the greeting degrades to the
   * plain title — and absent on the wall, which has no signed-in member to
   * draw and must not go looking for one.
   */
  viewer?: Member | null;
  /**
   * The household, for the wall's face row ("Vandaag.dc.html":56–61). Empty on
   * the phone, where the shell's rail already carries the one face that screen
   * is about.
   */
  members?: Member[];
};

export async function TodayHeader({
  greeting,
  anchor,
  now,
  timeZone,
  dayKey,
  isToday,
  href = '/today',
  surface = 'app',
  viewer,
  members = [],
}: TodayHeaderProps) {
  const t = await getTranslations('today');
  const tHolidays = await getTranslations('holidays');
  const formattingLocale = await getHouseholdFormattingLocale();

  const hub = surface === 'hub';

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
  // being the day being shown. The wall says "Vandaag" instead: the full date
  // is already spelled out under the greeting there, and a kiosk must not say
  // the same thing twice.
  const label = isToday
    ? t('title')
    : formatDateTime(anchor, formattingLocale, {
        day: 'numeric',
        month: 'short',
        weekday: 'short',
      });

  const chevron = cn(
    'flex items-center justify-center rounded-4xl text-ink-muted transition-colors duration-200 ease-brand hover:bg-surface-container hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
    hub ? 'size-9' : 'size-8'
  );

  /**
   * The festive line itself. A `<span>` rather than a `<div>` because on the
   * hub it lives inside `PageHeader`'s subtitle paragraph; `display: flex` is
   * what makes it a row either way, so both surfaces draw what they drew.
   */
  const festive =
    special.length > 0 || countdown ? (
      <span data-testid="today-festive" className="flex flex-wrap items-center gap-2">
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

        {/* The one number small children ask for by name. Always the brand's
            festive orange, whatever the day's own accent is — it is the
            *anticipation* that is being coloured, not the day. */}
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
      </span>
    ) : null;

  // One burst, once per day, per device — and only on the handful of days that
  // earn it (`HolidayConfetti`). Mounted here, so a parent opening `/today` on
  // Pakjesavond and a family walking past the hub on Koningsdag get the same
  // thing without either page knowing about it.
  const confetti = celebrating ? <HolidayConfetti dayKey={dayKey} /> : null;

  const dayNav = (
    <nav
      data-testid="today-day-nav"
      aria-label={t('dayNav.label')}
      className={cn(
        'flex items-center',
        // The phone draws it as a card, because on a 390px row it is the only
        // thing marking that cluster off from the greeting. The wall's chevrons
        // sit bare at the head of the right-hand cluster instead — the design
        // sheet does not draw them at all, and they earn their place by being
        // the only way back from a browsed day.
        hub ? 'gap-0.5' : 'gap-1.5 rounded-4xl border border-line-subtle bg-card p-1.5 shadow-sm'
      )}
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
        // Only offered when it means something: on today it would be a link to
        // the page you are already on. The phone keeps the word as a static
        // label above `sm`; the wall has the date beside it already.
        hub ? null : (
          <span className="hidden px-1 font-display text-body-sm font-bold sm:inline">{label}</span>
        )
      ) : (
        <Link
          href={href}
          data-testid="today-day-reset"
          className="rounded-4xl px-2 font-display text-body-sm font-bold hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {hub ? t('title') : label}
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
  );

  if (hub) {
    const faces: StackedFace[] = members.map((member) => ({
      id: member.id,
      name: member.displayName,
      avatarUrl: member.avatarUrl,
      surfaceClass: MEMBER_COLOR_CLASSES[member.color].surface,
    }));

    return (
      <>
        <PageHeader
          surface="hub"
          // The slot ("Goedemorgen"/"Goedemiddag"/"Goedenavond") is picked off
          // the real wall clock on the server, so it is the one string on the
          // board that changes without anything on the board having changed —
          // which is why it carries a handle a visual baseline can pin.
          title={<span data-testid="today-greeting">{greeting}</span>}
          subtitle={
            <>
              {formatDateTime(anchor, formattingLocale, { dateStyle: 'full', timeZone })}
              {festive}
            </>
          }
          action={
            <div className="flex items-center gap-4">
              {dayNav}

              {/* Four separate faces, not a stack. `FaceStack` overlaps by
                  default (`-space-x-2`), which is right on an event card where
                  the faces answer "whose is this" as one picture — but the wall
                  header's row *is* the household, drawn at the design's 34px
                  with a 6px gap ("Vandaag.dc.html":56–61), and at the kiosk type
                  scale the overlap was clipping the initials of every face but
                  the last. */}
              <FaceStack
                faces={faces}
                size="default"
                label={t('familyLabel')}
                className="space-x-0 gap-1.5"
              />

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
        {confetti}
      </>
    );
  }

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

        {festive}
      </div>

      {confetti}

      <div className="flex shrink-0 items-center gap-2">
        {dayNav}

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
