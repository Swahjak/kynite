import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Card, cn, Icon, SectionHeading } from '@kynite/ui';
import { formatDateTime } from '@/i18n/formatting-locale';
import {
  CATEGORY_CLASSES,
  EVENT_TYPE_ICONS,
  combineDayEvents,
  type CalendarEvent,
} from '@/modules/calendar';
import { getHouseholdFormattingLocale, MEMBER_COLOR_CLASSES, type Member } from '@/modules/family';
import { MemberFaces, joinNames, namesOf } from './member-faces';
import { TodayPastRows } from './today-past-rows';
import { TodayTimelineFilter } from './today-timeline-filter';

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
 * The row's anatomy is documented on `render` below. `density` no longer
 * changes its *shape* — since the August sheet both surfaces draw the same
 * row, divided by hairlines inside one object — only its size, and what that
 * object is: a card of its own on the wall, the page's own bordered list on a
 * phone.
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

  /**
   * One row, in the anatomy the August sheet settled on: the category rail,
   * the time *range* stacked start over end, the category glyph, the title,
   * and the faces of whoever is on it.
   *
   * Two things the row used to do and no longer does:
   *
   * - **It named people in a second line.** "Mila & Daan" under every title
   *   cost the row its second line and made a nine-event day scroll. The faces
   *   say the same thing in the space of the title's own line, and the names
   *   survive as the stack's accessible label.
   * - **It drew the category as a dot.** Eleven types share eight hues
   *   (`EVENT_TYPE_CATEGORY`), so colour alone cannot separate school from
   *   opvang, or muziek from spelen. The glyph is the half that can, and a 4px
   *   rail carries the hue better than a 8px dot did.
   *
   * The two densities now differ only in size — 24px glyph and 15px title on
   * the wall, 18px and 14px on a phone — because a parent who reads the wall
   * and then their pocket should read the same object twice.
   */
  const render = ({ event, memberIds }: (typeof rows)[number]): ReactNode => {
    const palette = CATEGORY_CLASSES[event.category];
    const everyone =
      event.householdWide || memberIds.length === 0 || memberIds.length >= members.length;
    const people = everyone ? tCalendar('everyone') : joinNames(namesOf(members, memberIds));
    const faceIds = everyone ? members.map((member) => member.id) : memberIds;
    const live = isToday && event.key === nowEventKey;
    const done = isPast(event);
    const phone = density === 'card';

    return (
      <div
        key={event.key}
        data-testid="today-timeline-row"
        data-state={live ? 'now' : done ? 'past' : 'default'}
        data-category={event.category}
        className={cn(
          'flex items-center border-t border-line-subtle first:border-t-0',
          phone ? 'min-h-12 gap-2.5 px-2 py-3' : 'gap-3 p-3',
          live && 'rounded-xl bg-primary/7',
          done && 'opacity-50'
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'w-1 shrink-0 self-stretch rounded-4xl',
            event.busyOnly ? 'bg-line' : palette.solid
          )}
        />

        {/* Start over end. The end time is what turns "10:00 Tandarts" into a
            block a parent can plan around, and it is the one fact the old row
            spent its second line on something else to avoid showing. */}
        <div className={cn('flex shrink-0 flex-col', phone ? 'w-10.5' : 'w-13')}>
          <span
            className={cn(
              'font-semibold tabular-nums',
              phone ? 'text-caption' : 'text-body-sm',
              live && 'font-bold text-primary'
            )}
          >
            {event.allDay ? t('allDay') : at(event.startsAt)}
          </span>
          {event.allDay ? null : (
            <span
              className={cn(
                'text-caption tabular-nums',
                live ? 'text-primary/70' : 'text-ink-muted'
              )}
            >
              {at(event.endsAt)}
            </span>
          )}
        </div>

        <Icon
          name={event.busyOnly ? 'lock' : EVENT_TYPE_ICONS[event.eventType]}
          size={phone ? 'sm' : 'md'}
          className={cn('shrink-0', event.busyOnly ? 'text-ink-muted' : palette.text)}
        />

        <span
          className={cn(
            'min-w-0 flex-1 truncate',
            phone ? 'text-body-sm' : 'text-body',
            live ? 'font-bold' : 'font-semibold',
            done && 'line-through',
            event.busyOnly && 'text-ink-muted'
          )}
        >
          {event.busyOnly ? tCalendar('busy') : event.title}
        </span>

        <MemberFaces
          members={members}
          memberIds={faceIds}
          size={phone ? 'xs' : 'sm'}
          label={people}
        />

        {live ? (
          <span className="shrink-0 rounded-4xl bg-primary px-2 py-0.5 text-overline text-primary-foreground uppercase">
            {t('now.eyebrowLive')}
          </span>
        ) : null}
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
      <p className={cn('text-body-sm text-ink-secondary', density === 'card' ? '' : 'px-3')}>
        {tCalendar('freeDay')}
      </p>
    ) : (
      <div className="flex flex-col">
        {disclosure}
        {rest.map(render)}
      </div>
    );

  /**
   * A household-wide event belongs to everyone's day, so it carries the whole
   * roster into the filter rather than the (empty) attendee list it was stored
   * with. Filtering to Mila and losing the family dinner would be a lie of
   * omission — the row is on her day too.
   */
  const memberIdsFor = ({ event, memberIds }: (typeof rows)[number]) =>
    event.householdWide || memberIds.length === 0
      ? members.map((member) => member.id)
      : [...memberIds];

  // One bordered list rather than nine floating tiles: the rows carry their own
  // hairlines now, so a border each drew the same line twice and cost the
  // column its rhythm. Same object as the wall's card, one step quieter.
  if (density === 'card') {
    return (
      <section data-testid="today-timeline" className={cn('flex flex-col gap-2', className)}>
        {disclosure ? null : eyebrow}
        <div className="rounded-2xl border border-line-subtle bg-card px-2">{body}</div>
      </section>
    );
  }

  // The wall's list carries the member filter in its heading row — the answer
  // the "Per persoon" column used to give, in the width it used to cost.
  return (
    <Card data-testid="today-timeline" className={cn('gap-3.5 px-2 pt-5 pb-2', className)}>
      {rows.length === 0 ? (
        <>
          <SectionHeading title={t('timeline.title')} size="card" level={2} className="px-3" />
          {body}
        </>
      ) : (
        <TodayTimelineFilter
          heading={<SectionHeading title={t('timeline.title')} size="card" level={2} />}
          faces={members.map((member) => ({
            id: member.id,
            name: member.displayName,
            avatarUrl: member.avatarUrl,
            surfaceClass: MEMBER_COLOR_CLASSES[member.color].surface,
          }))}
          rows={rest.map((row) => ({
            id: row.event.key,
            memberIds: memberIdsFor(row),
            node: render(row),
          }))}
          disclosure={disclosure}
          everyoneLabel={tCalendar('everyone')}
          emptyLabel={tCalendar('freeDay')}
        />
      )}
    </Card>
  );
}
