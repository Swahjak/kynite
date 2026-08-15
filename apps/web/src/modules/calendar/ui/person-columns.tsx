'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { Card, cn } from '@kynite/ui';
import { CategoryDot, EmptyState, MemberFace } from '@/components/kynite';
// Type-only, and deliberately so: this is a client component, and
// `@/modules/family` re-exports `queries.ts`, which is `server-only` and pulls
// the Postgres client. A value import here would put the database driver (and
// its connection string) in the browser bundle — Next fails the build on it,
// which is how this was caught. A type import is erased at compile time.
import type { Member } from '@/modules/family';
import { dayKeysOf } from '../domain/expand';
import { toDateKey, toWall } from '../domain/zone';
import type { CalendarEvent } from '../queries';
import { DayAgendaRow } from './day-agenda-row';
import { isCurrent, useNowTick } from './use-now-tick';
import { CATEGORY_CLASSES } from './tokens';

/**
 * The per-person column board: one column per member, in `member.sortOrder`,
 * each in that member's own color. It is the hub's ambient surface and the
 * parent app's `/today`, differing only in scale.
 *
 * Ordering is `sortOrder` and nothing else — a board whose columns move
 * around is a board nobody can read at a glance from across the kitchen. That
 * is also why an event belonging to no one in particular ("family dinner")
 * gets its own shared row instead of being duplicated into every column: four
 * copies of one evening reads as four commitments.
 */

export type PersonColumnsProps = {
  members: Member[];
  events: CalendarEvent[];
  timeZone: string;
  /** The day being shown. */
  day: Date;
  now?: Date | null;
  hub?: boolean;
  onSelect?: (event: CalendarEvent) => void;
};

export function PersonColumns({
  members,
  events,
  timeZone,
  day,
  now,
  hub = false,
  onSelect,
}: PersonColumnsProps) {
  const t = useTranslations('calendar');
  const formatDateTime = useDateTimeFormat();
  const dayKey = toDateKey(toWall(day, timeZone));
  // The board is server-rendered; "which of these is happening" is not.
  const tick = useNowTick(now);

  const { byMember, shared } = useMemo(() => {
    const columns = new Map<string, CalendarEvent[]>(members.map((member) => [member.id, []]));
    const sharedEvents: CalendarEvent[] = [];

    for (const event of events) {
      if (!dayKeysOf(event, timeZone, event.allDay).includes(dayKey)) continue;

      const targets = new Set<string>();
      if (event.ownerMemberId) targets.add(event.ownerMemberId);
      for (const attendee of event.attendeeMemberIds) targets.add(attendee);

      // A household event is everybody's, whatever attribution says (M23).
      const owned = event.householdWide ? [] : [...targets].filter((id) => columns.has(id));
      if (owned.length === 0) sharedEvents.push(event);
      else for (const id of owned) columns.get(id)!.push(event);
    }

    for (const list of columns.values()) {
      list.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    }
    sharedEvents.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

    return { byMember: columns, shared: sharedEvents };
  }, [members, events, timeZone, dayKey]);

  /**
   * The *who* sub-label inside a member's column (`calendar.md` § "Day
   * agenda").
   *
   * Everyone *else*, and that is the point: inside Mila's column every row is
   * already Mila's, so repeating her name on each line would say nothing. A
   * name here means "this one is shared with somebody", which is the fact the
   * column cannot otherwise show — and an empty result falls through to
   * "Iedereen" only for a household event, since a row in Mila's column that
   * names nobody else is simply hers alone.
   */
  const withFor = (event: CalendarEvent, columnMember: Member): string[] => {
    if (event.householdWide) return [];

    const others = new Set<string>(event.attendeeMemberIds);
    if (event.ownerMemberId) others.add(event.ownerMemberId);
    others.delete(columnMember.id);

    const names = members.filter((member) => others.has(member.id)).map((m) => m.displayName);
    return names.length > 0 ? [columnMember.displayName, ...names] : [columnMember.displayName];
  };

  return (
    <div data-slot="person-columns" className="flex min-h-0 flex-1 flex-col gap-3">
      {shared.length > 0 && (
        // `layout.md` § "Content area": the board's blocks are the shell's
        // nested content cards — white, rounded, `0 1px 2px rgba(0,0,0,0.04)`
        // and *no* border (`components.md` § Cards: elevation, not outline, is
        // what separates a card from the ground). `Card` is that shape.
        // `calendar.md` § "Event list item": the list container takes
        // `padding:8px` rather than the card's own 20px, "since rows carry
        // their own padding".
        <Card data-slot="shared-events" size="sm" className="gap-1 p-2">
          <h3 className="label-overline px-2 pt-1 text-ink-muted">{t('everyone')}</h3>
          <div className="flex flex-col">
            {shared.map((event, index) => (
              // No names: the block's own label already says "Iedereen", which
              // is exactly what the row's sub-label falls back to.
              <DayAgendaRow
                key={event.key}
                event={event}
                hub={hub}
                onSelect={onSelect}
                current={isCurrent(event, tick)}
                past={Boolean(tick && event.endsAt.getTime() < tick.getTime())}
                last={index === shared.length - 1}
              />
            ))}
          </div>
        </Card>
      )}

      <div
        data-slot="member-columns"
        // Keyboard-reachable, because it scrolls: a column whose only content
        // is the "free day" zero-state holds nothing focusable, so without this
        // the pane would be unreachable without a pointer (WCAG 2.1.1, and
        // axe's `scrollable-region-focusable`).
        tabIndex={0}
        className={cn(
          'min-h-0 flex-1 gap-3',
          // Phone: a horizontal rail. Four columns squeezed into 390px is four
          // unreadable slivers — a household board has to be readable from the
          // doorway, so the columns keep a legible width and the *board*
          // moves instead. 240px (`min-w-60`) puts one column plus a peek of
          // the next on a 390px screen, which is what makes it read as a rail
          // rather than a page. Snap is `proximity`, not `mandatory`: a parent
          // scanning two columns at once should be allowed to stop between
          // them. (The design system has no horizontal-scroll pattern of its
          // own — its week strip is a 7-column grid — so this follows its
          // spacing and card rules rather than a documented rail.)
          'flex snap-x snap-proximity overflow-x-auto overscroll-x-contain scroll-smooth pb-1 [-webkit-overflow-scrolling:touch]',
          // Tablet and up it already fits, so nothing about those widths
          // changes: back to the grid, no scrolling, no snapping.
          'sm:grid sm:snap-none sm:overflow-visible sm:pb-0',
          'sm:grid-cols-2',
          members.length >= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2',
          members.length >= 4 && 'xl:grid-cols-4'
        )}
      >
        {members.map((member) => {
          const memberEvents = byMember.get(member.id) ?? [];
          // `member_color` and `event_category` are the same eight design-system
          // keys, so one palette table serves both.
          const palette = CATEGORY_CLASSES[member.color];

          return (
            <Card
              key={member.id}
              data-slot="member-column"
              data-member-id={member.id}
              size="sm"
              className={cn(
                'min-h-0 gap-1 p-2',
                // The rail's cells: a readable fixed width that snaps, until
                // the grid takes over at `sm` and they become 1fr again.
                'w-60 shrink-0 snap-start sm:w-auto sm:min-w-0 sm:shrink'
              )}
            >
              {/* `Card/Stat`'s header rule: "Header row separated by
                  `border-bottom:1px solid #e1e3e4`" — the `#e1e3e4` divider
                  tone (`--line-subtle`), not the darker `#c4c5d9` outline. */}
              <header className="flex items-center gap-2 border-b border-line-subtle px-2 pt-1 pb-2">
                <MemberFace
                  size={hub ? 'hub' : 'default'}
                  avatarUrl={member.avatarUrl}
                  name={member.displayName}
                  surfaceClass={palette.surface}
                />
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      'truncate font-display font-bold',
                      hub ? 'text-h2' : 'text-body-lg'
                    )}
                  >
                    {member.displayName}
                  </div>
                  <div className="text-caption text-ink-muted">
                    {t('eventCount', { count: memberEvents.length })}
                  </div>
                </div>
                {/* The member's own color, present on every surface they own. */}
                <CategoryDot size="md" className={cn('size-3', palette.solid)} />
              </header>

              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {memberEvents.length === 0 ? (
                  <EmptyState
                    size={hub ? 'page' : 'inline'}
                    icon="wb_sunny"
                    title={t('freeDay')}
                    className="flex-1 justify-center"
                  />
                ) : (
                  memberEvents.map((event, index) => (
                    <DayAgendaRow
                      key={event.key}
                      event={event}
                      hub={hub}
                      people={withFor(event, member)}
                      onSelect={onSelect}
                      current={isCurrent(event, tick)}
                      // A finished event stays visible but recedes; nothing in
                      // this product marks a past thing as a failure. The
                      // recede is never `opacity-*` over text — M17's axe sweep
                      // measured a dimmed chip title at 2.27:1 on the wall
                      // display — so the row drains title and dot to
                      // `--ink-muted` instead, which still clears AA.
                      past={Boolean(tick && event.endsAt.getTime() < tick.getTime())}
                      last={index === memberEvents.length - 1}
                    />
                  ))
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <p className="sr-only">{formatDateTime(day, { dateStyle: 'full' })}</p>
    </div>
  );
}
