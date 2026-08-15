import { getTranslations } from 'next-intl/server';
import { Card, cn, Icon, SectionHeading } from '@kynite/ui';
import { formatDateTime } from '@/i18n/formatting-locale';
import { CATEGORY_CLASSES, dayKeysOf, titleOf, type CalendarEvent } from '@/modules/calendar';
import { MemberAvatar, getHouseholdFormattingLocale, type Member } from '@/modules/family';

/**
 * "Per persoon" — one compact column per member.
 *
 * The question this tab answers is the one a merged timeline genuinely cannot:
 * "what does *Daan* have today". So an event that belongs to two children
 * appears in both columns — the duplication is the point here, exactly as it is
 * wrong one tab to the left.
 *
 * Compact by design: a time, a category dot, a title, one line each. The full
 * event card lives on `/calendar`; this is the scan a parent does while making
 * lunch, and four columns of full cards is a scroll rather than a glance.
 *
 * Three row states, all of them facts:
 * - **past** — struck through and dimmed. It happened; it is not a task.
 * - **now** — tinted and bold, the same primary wash the timeline uses.
 * - **busy** — a lock and "Bezet", for a private calendar rendered free/busy.
 *
 * A household event is nobody's column and everybody's day, so it gets its own
 * "Iedereen" column at the end rather than four copies of one dinner.
 */

export type TodayTabPersonenProps = {
  members: Member[];
  events: CalendarEvent[];
  timeZone: string;
  dayKey: string;
  now: Date;
  isToday: boolean;
  nowEventKey: string | null;
  /**
   * A fixed column count. The design draws the wall's middle card as a 2 × 2
   * grid ("Vandaag.dc.html":148–183) and that is what this was for — but it
   * draws it at 13px, where the kiosk type scale is 1.45× with a 16px floor,
   * and "08:15 Ochtendroutine" at 20px does not fit half of a 230px card at
   * any setting. Left unset the grid is fluid (`minmax(11rem, 1fr)`), which
   * resolves to one column in the wall's middle card and to two or four across
   * a full-width tab — the design's *shape* wherever the type allows it, and a
   * readable line where it does not.
   */
  columnCount?: 2;
};

export async function TodayTabPersonen({
  members,
  events,
  timeZone,
  dayKey,
  now,
  isToday,
  nowEventKey,
  columnCount,
}: TodayTabPersonenProps) {
  const t = await getTranslations('today');
  const tCalendar = await getTranslations('calendar');
  const formattingLocale = await getHouseholdFormattingLocale();

  const at = (instant: Date) =>
    formatDateTime(instant, formattingLocale, { hour: '2-digit', minute: '2-digit', timeZone });

  const onDay = events.filter((event) => dayKeysOf(event, timeZone, event.allDay).includes(dayKey));

  const columns = new Map<string, CalendarEvent[]>(members.map((member) => [member.id, []]));
  const shared: CalendarEvent[] = [];

  for (const event of onDay) {
    const targets = new Set<string>(event.attendeeMemberIds);
    if (event.ownerMemberId) targets.add(event.ownerMemberId);

    // A household event is everybody's, whatever attribution says.
    const owned = event.householdWide ? [] : [...targets].filter((id) => columns.has(id));
    if (owned.length === 0) shared.push(event);
    else for (const id of owned) columns.get(id)!.push(event);
  }

  const byStart = (a: CalendarEvent, b: CalendarEvent) =>
    Number(a.allDay) - Number(b.allDay) || a.startsAt.getTime() - b.startsAt.getTime();

  for (const list of columns.values()) list.sort(byStart);
  shared.sort(byStart);

  const row = (event: CalendarEvent) => {
    const palette = CATEGORY_CLASSES[event.category];
    const live = isToday && event.key === nowEventKey;
    const past = isToday && !event.allDay && event.endsAt.getTime() <= now.getTime();

    return (
      <li
        key={event.key}
        data-state={live ? 'now' : past ? 'past' : 'default'}
        className={cn(
          'flex items-baseline gap-1.5',
          past && 'opacity-50',
          live && '-mx-1.5 rounded-lg bg-primary/8 px-1.5 py-1'
        )}
      >
        {event.busyOnly ? (
          <Icon name="lock" size="xs" className="shrink-0 self-center text-ink-muted" />
        ) : (
          <span
            aria-hidden="true"
            className={cn('size-1.5 shrink-0 self-center rounded-4xl', palette.solid)}
          />
        )}
        {/* Wraps rather than truncates. The design writes every line out in
            full ("Vandaag.dc.html":148–183) and it fits there at 13px; the
            kiosk type scale is 1.45× with a 16px floor, so the same line in
            the same column has to go somewhere, and a second line is a smaller
            loss than "12:30 We…". */}
        <span
          className={cn(
            'min-w-0 break-words text-body-sm',
            live && 'font-bold',
            past && 'line-through',
            event.busyOnly && 'text-ink-muted'
          )}
        >
          <span className="tabular-nums">{event.allDay ? t('allDay') : at(event.startsAt)}</span>{' '}
          {titleOf(event, { untitled: tCalendar('untitled'), busy: tCalendar('busy') })}
        </span>
      </li>
    );
  };

  return (
    <Card data-testid="today-person-columns" className="gap-4 p-5">
      <SectionHeading title={t('tabs.personen')} size="card" level={2} />

      <div
        className={cn(
          'grid gap-x-4 gap-y-5',
          columnCount === 2
            ? 'grid-cols-2'
            : '[grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]'
        )}
      >
        {members.map((member) => (
          <div key={member.id} data-member-id={member.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <MemberAvatar
                displayName={member.displayName}
                avatarUrl={member.avatarUrl}
                color={member.color}
                size="sm"
              />
              <span className="truncate text-body-sm font-semibold">{member.displayName}</span>
            </div>

            {(columns.get(member.id) ?? []).length === 0 ? (
              <p className="text-caption text-ink-muted">{tCalendar('freeDay')}</p>
            ) : (
              <ul className="flex flex-col gap-2.5">{columns.get(member.id)!.map(row)}</ul>
            )}
          </div>
        ))}

        {shared.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-4xl bg-surface-container text-ink-muted">
                <Icon name="group" size="xs" />
              </span>
              <span className="truncate text-body-sm font-semibold">{tCalendar('everyone')}</span>
            </div>
            <ul className="flex flex-col gap-2.5">{shared.map(row)}</ul>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
