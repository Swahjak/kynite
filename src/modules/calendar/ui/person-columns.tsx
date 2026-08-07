'use client';

import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
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
        <section
          data-slot="shared-events"
          className={cn('flex flex-col gap-2 rounded-xl bg-surface p-3', hub && 'p-4')}
        >
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
        </section>
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
            <section
              key={member.id}
              data-slot="member-column"
              data-member-id={member.id}
              className="flex min-h-0 min-w-0 flex-col gap-2 rounded-xl bg-surface p-3"
            >
              <header className="flex items-center gap-2 border-b border-line pb-2">
                <Avatar size={hub ? 'hub' : 'default'}>
                  {member.avatarUrl ? <AvatarImage src={member.avatarUrl} alt="" /> : null}
                  <AvatarFallback className={palette.surface}>
                    {member.displayName.trim().slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
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
                <span className={cn('size-3 shrink-0 rounded-full', palette.solid)} />
              </header>

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
                {memberEvents.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-1 py-6 text-center">
                    <Icon name="wb_sunny" size={hub ? 'xl' : 'md'} className="text-ink-muted" />
                    <span className={cn('text-ink-muted', hub ? 'text-body' : 'text-caption')}>
                      {t('freeDay')}
                    </span>
                  </div>
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
            </section>
          );
        })}
      </div>

      <p className="sr-only">{format.dateTime(day, { dateStyle: 'full' })}</p>
    </div>
  );
}
