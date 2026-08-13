'use client';

import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { EmptyState } from '@/components/kynite';
import { Card } from '@/components/ui/card';
// Type-only, deliberately — see the same note in `person-columns.tsx`:
// `@/modules/family` re-exports `server-only` queries, and a value import here
// would put the Postgres client in the browser bundle.
import type { Member } from '@/modules/family';
import { combineDayEvents } from '../domain/day-board';
import { toDateKey, toWall } from '../domain/zone';
import type { CalendarEvent } from '../queries';
import { EventRow, type EventRowPerson } from './event-row';

/**
 * The day board's combined mode: everybody's day as one chronological list.
 *
 * Same row as the columns draw (`calendar.md` § "Event list item", via
 * `EventRow`) and the same card shape — only the grouping changes, so the two
 * modes read as two arrangements of one board rather than two components that
 * happen to be near each other.
 *
 * The trailing faces carry the weight here. Inside Mila's column a face means
 * "shared with someone"; in a merged list it is the only thing that says whose
 * event a row is, so every member on the event gets one — de-duplicated to a
 * single row by `combineDayEvents`, because one family dinner is one line.
 */

export type CombinedDayListProps = {
  members: Member[];
  events: CalendarEvent[];
  timeZone: string;
  /** The day being shown. */
  day: Date;
  now?: Date | null;
  hub?: boolean;
  onSelect?: (event: CalendarEvent) => void;
};

export function CombinedDayList({
  members,
  events,
  timeZone,
  day,
  now,
  hub = false,
  onSelect,
}: CombinedDayListProps) {
  const t = useTranslations('calendar');
  const format = useFormatter();
  const dayKey = toDateKey(toWall(day, timeZone));

  const rows = useMemo(() => {
    const byId = new Map(members.map((member) => [member.id, member]));

    return combineDayEvents(
      events,
      members.map((member) => member.id),
      { timeZone, dayKey }
    ).map(({ event, memberIds }) => ({
      event,
      people: memberIds
        .map((id) => byId.get(id))
        .filter((member): member is Member => member !== undefined)
        .map((member): EventRowPerson => ({
          id: member.id,
          displayName: member.displayName,
          avatarUrl: member.avatarUrl,
          color: member.color,
        })),
    }));
  }, [members, events, timeZone, dayKey]);

  return (
    <div data-slot="combined-day-list" className="flex min-h-0 flex-1 flex-col gap-3">
      {/* The same nested content card the columns sit in: `padding:8px`, since
          the rows carry their own (`calendar.md` § "Event list item"). */}
      <Card size="sm" className="min-h-0 flex-1 gap-1 p-2">
        {rows.length === 0 ? (
          <EmptyState
            size={hub ? 'page' : 'inline'}
            icon="wb_sunny"
            title={t('freeDay')}
            className="flex-1 justify-center"
          />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {rows.map(({ event, people }, index) => (
              <EventRow
                key={event.key}
                event={event}
                hub={hub}
                people={people}
                onSelect={onSelect}
                past={Boolean(now && event.endsAt.getTime() < now.getTime())}
                first={index === 0}
              />
            ))}
          </div>
        )}
      </Card>

      <p className="sr-only">{format.dateTime(day, { dateStyle: 'full' })}</p>
    </div>
  );
}
