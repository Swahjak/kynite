import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import { Card, cn, EventRow, SectionHeading } from '@kynite/ui';
import { formatDateTime } from '@/i18n/formatting-locale';
import {
  CATEGORY_CLASSES,
  EVENT_TYPE_ICONS,
  combineDayEvents,
  titleOf,
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
    /**
     * `memberIds === null` is `combineDayEvents` saying the row's audience is
     * **withheld** (§7 `calendar:view_private` → `busy-only`), not that it is
     * empty. So the row draws no faces and carries no label — not even
     * "Iedereen", because whether a hidden hour is the household's or one
     * person's is itself part of what free/busy withholds. The lock glyph and
     * "Bezet" below are the whole of what this row is allowed to say.
     */
    const everyone =
      memberIds !== null &&
      (event.householdWide || memberIds.length === 0 || memberIds.length >= members.length);
    const people =
      memberIds === null
        ? undefined
        : everyone
          ? tCalendar('everyone')
          : joinNames(namesOf(members, memberIds));
    const faceIds =
      memberIds === null ? null : everyone ? members.map((member) => member.id) : memberIds;
    const live = isToday && event.key === nowEventKey;
    const done = isPast(event);
    const phone = density === 'card';

    return (
      <EventRow
        key={event.key}
        data-testid="today-timeline-row"
        data-category={event.category}
        size={phone ? 'compact' : 'default'}
        state={live ? 'now' : done ? 'past' : 'default'}
        busy={event.busyOnly}
        railClass={palette.solid}
        iconName={event.busyOnly ? 'lock' : EVENT_TYPE_ICONS[event.eventType]}
        // The glyph's own step (45%), not the chip-text one (32%): the design
        // system gives the icon a tone between the rail and the label so it
        // reads at 20px without competing with the title.
        iconClass={palette.icon}
        startTime={event.allDay ? t('allDay') : at(event.startsAt)}
        endTime={event.allDay ? undefined : at(event.endsAt)}
        title={titleOf(event, { untitled: tCalendar('untitled'), busy: tCalendar('busy') })}
        faces={
          faceIds === null ? undefined : (
            <MemberFaces
              members={members}
              memberIds={faceIds}
              size={phone ? 'xs' : 'sm'}
              label={people}
            />
          )
        }
        statusLabel={live ? t('now.eyebrowLive') : undefined}
      />
    );
  };

  const lastPast = past.at(-1);

  /**
   * The phone's heading is an *eyebrow*, not a card title
   * ("Vandaag.dc.html":377–380): uppercase Baloo at 12px in the muted ink,
   * sharing its row with "⌄ 1 afgerond". The wall keeps the real 19px card
   * heading, because there the list genuinely is one card among three.
   */
  const eyebrow = <h2 className="label-overline text-ink-muted">{t('timeline.title')}</h2>;

  const disclosure =
    past.length > 0 && lastPast ? (
      <TodayPastRows
        summary={t('timeline.done', {
          count: past.length,
          title: titleOf(lastPast.event, {
            untitled: tCalendar('untitled'),
            busy: tCalendar('busy'),
          }),
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
  // `placementMemberIds`, not `memberIds`: the filter is *placement*, and a
  // redacted row keeps the placement it has always had (`ownerMemberId` is
  // exactly what survives redaction for). Ids only — nothing here is rendered,
  // so nothing here names anybody.
  const memberIdsFor = ({ event, placementMemberIds }: (typeof rows)[number]) =>
    event.householdWide || placementMemberIds.length === 0
      ? members.map((member) => member.id)
      : [...placementMemberIds];

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
