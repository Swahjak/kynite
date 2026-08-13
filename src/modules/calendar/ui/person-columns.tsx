'use client';

import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { CategoryDot, EmptyState, MemberFace } from '@/components/kynite';
import { Card } from '@/components/ui/card';
// Type-only, and deliberately so: this is a client component, and
// `@/modules/family` re-exports `queries.ts`, which is `server-only` and pulls
// the Postgres client. A value import here would put the database driver (and
// its connection string) in the browser bundle — Next fails the build on it,
// which is how this was caught. A type import is erased at compile time.
import type { Member } from '@/modules/family';
import { dayKeysOf } from '../domain/expand';
import { toDateKey, toWall } from '../domain/zone';
import type { CalendarEvent } from '../queries';
import { EventChip } from './event-chip';
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
  const format = useFormatter();
  const dayKey = toDateKey(toWall(day, timeZone));

  const { byMember, shared } = useMemo(() => {
    const columns = new Map<string, CalendarEvent[]>(members.map((member) => [member.id, []]));
    const sharedEvents: CalendarEvent[] = [];

    for (const event of events) {
      if (!dayKeysOf(event, timeZone, event.allDay).includes(dayKey)) continue;

      const targets = new Set<string>();
      if (event.ownerMemberId) targets.add(event.ownerMemberId);
      for (const attendee of event.attendeeMemberIds) targets.add(attendee);

      const owned = [...targets].filter((id) => columns.has(id));
      if (owned.length === 0) sharedEvents.push(event);
      else for (const id of owned) columns.get(id)!.push(event);
    }

    for (const list of columns.values()) {
      list.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    }
    sharedEvents.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

    return { byMember: columns, shared: sharedEvents };
  }, [members, events, timeZone, dayKey]);

  return (
    <div data-slot="person-columns" className="flex min-h-0 flex-1 flex-col gap-3">
      {shared.length > 0 && (
        // `layout.md` § "Content area": the board's blocks are the shell's
        // nested content cards — white, rounded, `0 1px 2px rgba(0,0,0,0.04)`
        // and *no* border (`components.md` § Cards: elevation, not outline, is
        // what separates a card from the ground). `Card` is that shape.
        <Card data-slot="shared-events" size="sm" className={cn('gap-2 p-3', hub && 'p-4')}>
          <h3 className="label-overline text-ink-muted">{t('everyone')}</h3>
          <div className={cn('flex flex-wrap gap-2')}>
            {shared.map((event) => (
              <EventChip
                key={event.key}
                event={event}
                variant="row"
                hub={hub}
                onSelect={onSelect}
                className="min-w-40 flex-1"
              />
            ))}
          </div>
        </Card>
      )}

      <div
        data-slot="member-columns"
        className={cn(
          'grid min-h-0 flex-1 gap-3',
          // Columns on a wide/hub board, a scrollable stack on a phone.
          'grid-cols-1 sm:grid-cols-2',
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
              className="min-h-0 min-w-0 gap-2 p-3"
            >
              {/* `Card/Stat`'s header rule: "Header row separated by
                  `border-bottom:1px solid #e1e3e4`" — the `#e1e3e4` divider
                  tone (`--line-subtle`), not the darker `#c4c5d9` outline. */}
              <header className="flex items-center gap-2 border-b border-line-subtle pb-2">
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

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                {memberEvents.length === 0 ? (
                  <EmptyState
                    size={hub ? 'page' : 'inline'}
                    icon="wb_sunny"
                    title={t('freeDay')}
                    className="flex-1 justify-center"
                  />
                ) : (
                  memberEvents.map((event) => (
                    <EventChip
                      key={event.key}
                      event={event}
                      variant="row"
                      hub={hub}
                      onSelect={onSelect}
                      className={cn(
                        // A finished event stays visible but recedes; nothing
                        // in this product marks a past thing as a failure.
                        //
                        // The recede is on the *fill*, not the whole chip. It
                        // used to be `opacity-50`, which took the text down
                        // with it: M17's axe sweep measured the title at
                        // 2.27:1 on the wall display, and the arithmetic says
                        // opacity would have to stay above 0.85 to clear AA —
                        // by which point it is not a recede at all. Draining
                        // the category tint to a neutral surface reads as
                        // "done" just as well and leaves every word legible.
                        now && event.endsAt.getTime() < now.getTime() && 'border-line bg-surface/60'
                      )}
                    />
                  ))
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <p className="sr-only">{format.dateTime(day, { dateStyle: 'full' })}</p>
    </div>
  );
}
