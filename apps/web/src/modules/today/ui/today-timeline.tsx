import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Card, cn, Icon, SectionHeading } from '@kynite/ui';
import { formatDateTime } from '@/i18n/formatting-locale';
import { CATEGORY_CLASSES, combineDayEvents, type CalendarEvent } from '@/modules/calendar';
import { getHouseholdFormattingLocale, type Member } from '@/modules/family';
import { MemberFaces, joinNames, namesOf } from './member-faces';
import { TodayPastRows } from './today-past-rows';

/**
 * "Dagoverzicht" — the whole household's day as one chronological list.
 *
 * Extracted from `today-tab-dag.tsx` in wave D1 because the wall hub draws the
 * same list in the first of three columns while the parent app draws it beside
 * the task list. One component, two callers, so the two can never disagree
 * about what a row of the day looks like.
 *
 * The list is the *merged* view, not the per-person one: one family dinner
 * attended by four people is one line, and `combineDayEvents` is the calendar
 * slice's own answer to that. Per-person is a tab of its own.
 *
 * Two rows read differently, and both are facts rather than decoration:
 *
 * - **The one happening now** gets a tinted row and the NU badge — the single
 *   thing on this list a glance should land on.
 * - **A busy-only row** — a private calendar rendered free/busy — gets a lock
 *   and the word "Bezet" instead of a title, which is exactly as much as the
 *   viewer is allowed to know.
 *
 * Everything already over collapses into one line at the top
 * (`today-past-rows.tsx`). Nothing is dropped; the morning simply stops being
 * the first six rows of the afternoon's screen.
 *
 * The row itself follows the design's hub anatomy: a fixed time gutter, the
 * category as a dot (or a lock), the title, and the names underneath. The
 * mobile shape — a bordered card with a full-height colour bar — is
 * `density="card"`, which is what a 390px column can carry without the row
 * collapsing into a run-on sentence.
 */

export type TodayTimelineProps = {
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
  /**
   * `list` is the design's hub row — a flat line in a card. `card` is the phone's
   * — each row its own bordered tile, which is what survives at 390px.
   */
  density?: 'list' | 'card';
  className?: string;
};

export async function TodayTimeline({
  members,
  events,
  timeZone,
  dayKey,
  now,
  isToday,
  nowEventKey,
  density = 'list',
  className,
}: TodayTimelineProps) {
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

  const render = ({ event, memberIds }: (typeof rows)[number]): ReactNode => {
    const palette = CATEGORY_CLASSES[event.category];
    const everyone =
      event.householdWide || memberIds.length === 0 || memberIds.length >= members.length;
    const people = everyone ? tCalendar('everyone') : joinNames(namesOf(members, memberIds));
    const faceIds = everyone ? members.map((member) => member.id) : memberIds;
    const live = isToday && event.key === nowEventKey;
    const done = isPast(event);

    if (density === 'card') {
      return (
        <div
          key={event.key}
          data-testid="today-timeline-row"
          data-state={live ? 'now' : done ? 'past' : 'default'}
          data-category={event.category}
          className={cn(
            'flex min-h-12 items-center gap-2.5 rounded-xl p-3',
            live ? 'bg-primary/7' : 'border border-line-subtle bg-card',
            done && 'opacity-55'
          )}
        >
          <span
            className={cn(
              'w-10.5 shrink-0 text-caption font-semibold tabular-nums',
              live ? 'font-bold text-primary' : 'text-ink-secondary'
            )}
          >
            {event.allDay ? t('allDay') : at(event.startsAt)}
          </span>

          {/* A 4px full-height bar rather than a dot: at this size a dot is
              lost against the card's own border. */}
          <span
            aria-hidden="true"
            className={cn(
              'w-1 self-stretch rounded-4xl',
              event.busyOnly ? 'bg-line' : palette.solid
            )}
          />

          <div className="min-w-0 flex-1">
            <span
              className={cn(
                'block truncate text-body-sm font-semibold',
                done && 'line-through',
                event.busyOnly && 'text-ink-muted'
              )}
            >
              {event.busyOnly ? tCalendar('busy') : event.title}
            </span>
            <span className="block truncate text-caption text-ink-secondary">{people}</span>
          </div>

          {live ? (
            <span className="shrink-0 rounded-4xl bg-primary px-2.5 py-0.5 text-overline text-primary-foreground uppercase">
              {t('now.eyebrowLive')}
            </span>
          ) : null}
          {event.busyOnly ? (
            <Icon name="lock" size="xs" className="shrink-0 text-ink-muted" />
          ) : null}
        </div>
      );
    }

    return (
      <div
        key={event.key}
        data-testid="today-timeline-row"
        data-state={live ? 'now' : done ? 'past' : 'default'}
        data-category={event.category}
        className={cn(
          'flex gap-3 rounded-xl px-2.5 py-2',
          live && 'bg-primary/7',
          done && 'opacity-50'
        )}
      >
        <span
          className={cn(
            'w-11 shrink-0 text-body-sm font-semibold tabular-nums',
            live ? 'font-bold text-primary' : 'text-ink-secondary'
          )}
        >
          {event.allDay ? t('allDay') : at(event.startsAt)}
        </span>

        {event.busyOnly ? (
          <Icon name="lock" size="xs" className="mt-0.5 shrink-0 text-ink-muted" />
        ) : (
          <span
            aria-hidden="true"
            className={cn('mt-1.5 size-2 shrink-0 rounded-4xl', palette.solid)}
          />
        )}

        <div className="min-w-0 flex-1">
          <span
            className={cn(
              'block text-body-sm',
              live && 'font-bold',
              done && 'line-through',
              event.busyOnly && 'text-ink-muted'
            )}
          >
            {event.busyOnly ? tCalendar('busy') : event.title}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-caption text-ink-secondary">
            <MemberFaces members={members} memberIds={faceIds} size="xs" />
            <span className="truncate">{people}</span>
          </span>
        </div>
      </div>
    );
  };

  const lastPast = past.at(-1);

  /**
   * The phone's heading is an *eyebrow*, not a card title
   * ("Vandaag.dc.html":374–377): uppercase Baloo at 12px in the muted ink,
   * sharing its row with "1 afgerond ⌄". The wall keeps the real 19px card
   * heading, because there the list genuinely is one card among three.
   */
  const eyebrow = <h2 className="label-overline text-ink-muted">{t('timeline.title')}</h2>;

  const disclosure =
    past.length > 0 && lastPast ? (
      <TodayPastRows
        summary={t('timeline.done', {
          count: past.length,
          title: lastPast.event.busyOnly ? tCalendar('busy') : lastPast.event.title,
          time: lastPast.event.allDay ? t('allDay') : at(lastPast.event.startsAt),
        })}
        label={t('timeline.showDone')}
        header={density === 'card' ? eyebrow : undefined}
      >
        {past.map(render)}
      </TodayPastRows>
    ) : null;

  const body =
    rows.length === 0 ? (
      <p className="text-body-sm text-ink-secondary">{tCalendar('freeDay')}</p>
    ) : (
      <div className={cn('flex flex-col', density === 'card' ? 'gap-2' : '-mx-2.5 gap-0.5')}>
        {disclosure}
        {rest.map(render)}
      </div>
    );

  // The phone's rows are already tiles with their own borders; wrapping them in
  // a second white card put a card inside a card and cost 40px of a 390px
  // column. The design draws them straight on the page ground.
  if (density === 'card') {
    return (
      <section data-testid="today-timeline" className={cn('flex flex-col gap-2', className)}>
        {disclosure ? null : eyebrow}
        {body}
      </section>
    );
  }

  return (
    <Card data-testid="today-timeline" className={cn('gap-4 p-5', className)}>
      <SectionHeading title={t('timeline.title')} size="card" level={2} />
      {body}
    </Card>
  );
}
