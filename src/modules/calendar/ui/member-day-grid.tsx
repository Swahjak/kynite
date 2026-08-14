'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { cn } from '@/lib/utils';
import { CategoryDot, EmptyState, MemberFace } from '@/components/kynite';
import { Icon } from '@/components/ui/icon';
// Type-only, deliberately: `@/modules/family` re-exports `server-only` query
// modules, and a value import would drag the Postgres client into this client
// bundle — see the same note in `person-columns.tsx`.
import type { Member } from '@/modules/family';
import { dayKeysOf } from '../domain/expand';
import { minutesIntoDay, toDateKey, toWall } from '../domain/zone';
import type { CalendarEvent } from '../queries';
import { EventChip } from './event-chip';
import { CATEGORY_CLASSES, GRID_END_HOUR, GRID_START_HOUR, HOUR_HEIGHT } from './tokens';
import { layout } from './time-grid';
import { useDragReschedule } from './use-drag-reschedule';

/**
 * Day view — one column per family member, sharing a single left time axis.
 *
 * M19: the day used to be `TimeGrid` with a single column, i.e. the week grid
 * at 1/7th the width. The mockups (`docs/design/stitch/.../
 * calendar_today_light_mode/code.html:58`) read the day the way a household
 * actually does — "who has what, when" — with a sticky per-member header over
 * each column and a shared band, spanning every column, for the things nobody
 * owns alone. `PersonColumns` already made that argument for `/today`; this is
 * the same board on the hour grid instead of as lists.
 *
 * An event with no member of this family attached is *not* duplicated into
 * every column: four copies of one family dinner reads as four commitments.
 * It becomes the household lane instead — its own column, next to the hour
 * gutter, rather than a translucent band floating over the member columns.
 * The band was the mockup's drawing, but as an overlay it sat *on top of* the
 * member chips at the same hour and swallowed their clicks; a lane says the
 * same thing ("this belongs to all of us") and leaves every chip reachable.
 *
 * Drag-to-reschedule survives: vertically only. Horizontal movement in the
 * week grid means "another day"; here it would mean "another person", which is
 * a different edit (ownership) and is not something a drag should silently
 * perform — so `columnWidth` is 0, which is exactly what day view already
 * passed when it was one column wide.
 */

export type MemberDayGridProps = {
  members: Member[];
  events: CalendarEvent[];
  timeZone: string;
  /** The day being shown. */
  day: Date;
  /** Rendered as "now" — passed in rather than read, so snapshots are stable. */
  now?: Date | null;
  onSelect?: (event: CalendarEvent) => void;
};

const GRID_HOURS = GRID_END_HOUR - GRID_START_HOUR;
/** Sticky per-member column header, in px — the overlays start below it. */
const HEADER_HEIGHT = 48;

export function MemberDayGrid({
  members,
  events,
  timeZone,
  day,
  now,
  onSelect,
}: MemberDayGridProps) {
  const t = useTranslations('calendar');
  const formatDateTime = useDateTimeFormat();
  const dayKey = toDateKey(toWall(day, timeZone));

  const { byMember, sharedTimed, allDayByMember, sharedAllDay } = useMemo(() => {
    const columns = new Map<string, CalendarEvent[]>(members.map((member) => [member.id, []]));
    const allDayColumns = new Map<string, CalendarEvent[]>(
      members.map((member) => [member.id, []])
    );
    const shared: CalendarEvent[] = [];
    const sharedAllDayEvents: CalendarEvent[] = [];

    for (const event of events) {
      if (!dayKeysOf(event, timeZone, event.allDay).includes(dayKey)) continue;

      /**
       * Attribution first, all-day second.
       *
       * The all-day branch used to run before this and threw the owner away, so
       * "Mila — zwemkamp" landed in a household strip that reads as everyone's.
       * An all-day block belongs to whoever it belongs to; only the clock is
       * missing, not the ownership.
       */
      const targets = new Set<string>(event.attendeeMemberIds);
      if (event.ownerMemberId) targets.add(event.ownerMemberId);

      if (targets.size === 0) {
        (event.allDay ? sharedAllDayEvents : shared).push(event);
        continue;
      }

      const owned = [...targets].filter((id) => columns.has(id));
      /**
       * Attributed, but to nobody this grid renders — a soft-deleted member, or
       * one filtered out of the board. It is *dropped*, not promoted into the
       * household lane: that lane spans the whole family, so promoting it would
       * show one person's appointment to everyone standing at the screen. A
       * missing block is a display gap; a leaked one is a privacy failure.
       */
      if (owned.length === 0) continue;

      const target = event.allDay ? allDayColumns : columns;
      for (const id of owned) target.get(id)!.push(event);
    }

    const byStart = (a: CalendarEvent, b: CalendarEvent) =>
      a.startsAt.getTime() - b.startsAt.getTime();

    shared.sort(byStart);
    sharedAllDayEvents.sort(byStart);
    for (const list of allDayColumns.values()) list.sort(byStart);

    return {
      byMember: columns,
      sharedTimed: shared,
      allDayByMember: allDayColumns,
      sharedAllDay: sharedAllDayEvents,
    };
  }, [members, events, timeZone, dayKey]);

  const hasAllDay =
    sharedAllDay.length > 0 || members.some((member) => allDayByMember.get(member.id)?.length);

  // Vertical-only: see the component note. `columnWidth: 0` disables the
  // horizontal half of the gesture inside the hook.
  const drag = useDragReschedule({
    columnWidth: 0,
    columnCount: members.length,
    columnIndexOf: () => 0,
  });

  const hours = Array.from({ length: GRID_HOURS + 1 }, (_, index) => GRID_START_HOUR + index);
  const showNow = now ? toDateKey(toWall(now, timeZone)) === dayKey : false;
  // Clamped: before `GRID_START_HOUR` an unclamped line floats above the grid
  // and over the sticky headers.
  const nowTop = now
    ? Math.min(
        Math.max(((minutesIntoDay(now, timeZone) - GRID_START_HOUR * 60) / 60) * HOUR_HEIGHT, 0),
        GRID_HOURS * HOUR_HEIGHT
      )
    : 0;

  const bodyHeight = GRID_HOURS * HOUR_HEIGHT;

  return (
    <div data-slot="member-day-grid" className="flex min-h-0 flex-1 flex-col">
      {hasAllDay && (
        <div
          data-slot="all-day-row"
          className="flex items-start gap-2 border-b border-line bg-surface-container-low/60 px-3 py-2"
        >
          <span className="label-overline w-11 shrink-0 pt-1 text-ink-muted">{t('allDay')}</span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {/* Grouped by member, in the same order as the columns below: an
                all-day block that belongs to somebody is marked with their face
                and their colour, so the strip answers "whose holiday is this?"
                without opening anything. */}
            {members.map((member) => {
              const owned = allDayByMember.get(member.id) ?? [];
              if (owned.length === 0) return null;

              const palette = CATEGORY_CLASSES[member.color];

              return (
                <div
                  key={member.id}
                  data-slot="all-day-member"
                  data-member-id={member.id}
                  // The rule is neutral, deliberately (M23): this bracket holds
                  // one member's all-day events, and colouring it in *their*
                  // hue would put member colour on an event surface — where the
                  // only hue allowed is the event type's, carried by the chips
                  // inside it. The face beside it is what says whose these are.
                  className="flex min-w-32 flex-1 items-center gap-1.5 rounded-xl border-l-4 border-line-subtle py-0.5 pl-1.5"
                >
                  <MemberFace
                    size="sm"
                    avatarUrl={member.avatarUrl}
                    name={member.displayName}
                    surfaceClass={palette.surface}
                    className="shrink-0"
                  />
                  <span className="sr-only">{member.displayName}</span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {owned.map((event) => (
                      <EventChip
                        key={event.key}
                        event={event}
                        variant="row"
                        showTime={false}
                        onSelect={onSelect}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Only what nobody owns lands in the household strip. */}
            {sharedAllDay.map((event) => (
              <EventChip
                key={event.key}
                event={event}
                variant="row"
                showTime={false}
                onSelect={onSelect}
                className="min-w-32 flex-1"
              />
            ))}
          </div>
        </div>
      )}

      {/* One scroll container for both axes: the hour gutter sticks to the
          left edge and the member headers to the top, so a phone can scroll
          four columns sideways without losing either reference. */}
      <div className="relative flex min-h-0 flex-1 overflow-auto">
        <div className="flex min-w-max flex-1">
          {/* Hour gutter */}
          <div className="sticky left-0 z-30 w-14 shrink-0 bg-surface" aria-hidden>
            <div
              className="sticky top-0 z-10 bg-surface"
              style={{ height: HEADER_HEIGHT }}
              data-slot="grid-corner"
            />
            {hours.slice(0, -1).map((hour) => (
              <div
                key={hour}
                style={{ height: HOUR_HEIGHT }}
                className="relative -top-2 pr-2 text-right tabular-time text-caption text-ink-muted"
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          <div className="relative flex min-w-max flex-1">
            {/* Hour lines and the cross-column overlays, drawn once behind
                every column and offset past the sticky header strip. */}
            <div
              className="pointer-events-none absolute inset-x-0 z-0"
              style={{ top: HEADER_HEIGHT, height: bodyHeight }}
              aria-hidden
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute inset-x-0 border-t border-line-subtle"
                  style={{ top: (hour - GRID_START_HOUR) * HOUR_HEIGHT }}
                />
              ))}
            </div>

            {/* The household lane: what nobody owns alone, in a column of its
                own so it can never sit on top of a member's chip. */}
            {sharedTimed.length > 0 && (
              <div
                data-slot="shared-column"
                className="relative flex w-36 min-w-0 grow flex-col border-l border-line-subtle bg-surface-container-low/40"
              >
                <div
                  className="glass sticky top-0 z-20 flex items-center justify-center gap-2 px-2"
                  style={{ height: HEADER_HEIGHT }}
                >
                  <Icon name="group" size="sm" className="text-ink-muted" />
                  <span className="label-overline truncate text-ink-secondary">
                    {t('everyone')}
                  </span>
                </div>

                <div className="relative" style={{ height: bodyHeight }}>
                  <TimedChips
                    events={sharedTimed}
                    timeZone={timeZone}
                    dayKey={dayKey}
                    drag={drag}
                    onSelect={onSelect}
                  />
                </div>
              </div>
            )}

            {members.map((member) => {
              const memberEvents = byMember.get(member.id) ?? [];
              const memberAllDay = allDayByMember.get(member.id) ?? [];
              // `member_color` and `event_category` are the same eight
              // design-system keys, so one palette table serves both.
              const palette = CATEGORY_CLASSES[member.color];

              return (
                <div
                  key={member.id}
                  data-slot="member-column"
                  data-member-id={member.id}
                  className="relative flex w-36 min-w-0 grow flex-col border-l border-line-subtle"
                >
                  <div
                    className="glass sticky top-0 z-20 flex items-center justify-center gap-2 px-2"
                    style={{ height: HEADER_HEIGHT }}
                  >
                    <MemberFace
                      size="sm"
                      avatarUrl={member.avatarUrl}
                      name={member.displayName}
                      surfaceClass={palette.surface}
                    />
                    <span className="label-overline truncate text-ink-secondary">
                      {member.displayName}
                    </span>
                    <CategoryDot size="sm" className={palette.solid} />
                  </div>

                  <div className="relative" style={{ height: bodyHeight }}>
                    {/* "Free day" means free — an all-day block is still a
                        commitment, so a member with only those does not get the
                        empty state. */}
                    {memberEvents.length === 0 && memberAllDay.length === 0 ? (
                      <div data-slot="member-day-empty" className="absolute inset-x-1 top-4">
                        {/* The shared zero-state, in its `framed` form — the
                            dashed outline `EmptyState` already owns, rather
                            than a fourth hand-rolled copy of it. */}
                        <EmptyState
                          framed
                          icon="self_improvement"
                          title={t('freeDay')}
                          className="opacity-70"
                        />
                      </div>
                    ) : (
                      <TimedChips
                        events={memberEvents}
                        timeZone={timeZone}
                        dayKey={dayKey}
                        drag={drag}
                        onSelect={onSelect}
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* The now line spans every lane, so it is a sibling of the columns
                rather than a child of one. `pointer-events-none`, so sitting
                above the chips costs no clicks. */}
            {showNow && (
              <div
                data-testid="now-line"
                className="pointer-events-none absolute inset-x-0 z-20 border-t border-now"
                style={{ top: HEADER_HEIGHT + nowTop }}
              >
                <span className="absolute -top-1 -left-1 size-2 rounded-full bg-now" />
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="sr-only">{formatDateTime(day, { dateStyle: 'full' })}</p>
    </div>
  );
}

/**
 * The positioned chips of one lane — a member's column or the household one.
 *
 * Shared rather than duplicated so both lanes agree about overlap layout, drag
 * offsets and the post-drag click guard; the only difference between them is
 * which events they are handed.
 */
function TimedChips({
  events,
  timeZone,
  dayKey,
  drag,
  onSelect,
}: {
  events: CalendarEvent[];
  timeZone: string;
  dayKey: string;
  drag: ReturnType<typeof useDragReschedule>;
  onSelect?: (event: CalendarEvent) => void;
}) {
  return layout(events, timeZone, dayKey).map((positioned) => {
    const offset = drag.offsetFor(positioned.event);
    const isDragging = drag.drag?.key === positioned.event.key;
    const width = 100 / positioned.columnCount;

    return (
      <EventChip
        key={positioned.event.key}
        event={positioned.event}
        variant="block"
        onSelect={onSelect}
        onPointerDown={drag.onPointerDown}
        suppressClick={drag.shouldIgnoreClick}
        continuesBefore={positioned.continuesBefore}
        continuesAfter={positioned.continuesAfter}
        className={cn(
          'touch-none',
          isDragging && 'z-30 opacity-90 shadow-lg',
          positioned.event.editable && 'cursor-grab active:cursor-grabbing'
        )}
        style={{
          top: positioned.top + offset.top,
          height: positioned.height,
          left: `calc(${positioned.columnIndex * width}% + 2px)`,
          width: `calc(${width}% - 4px)`,
          right: 'auto',
        }}
      />
    );
  });
}
