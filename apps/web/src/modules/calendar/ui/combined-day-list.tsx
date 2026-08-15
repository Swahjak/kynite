'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
import { Card, EmptyState } from '@kynite/ui';
// Type-only, deliberately — see the same note in `person-columns.tsx`:
// `@/modules/family` re-exports `server-only` queries, and a value import here
// would put the Postgres client in the browser bundle.
import type { Member } from '@/modules/family';
import { combineDayEvents } from '../domain/day-board';
import { toDateKey, toWall } from '../domain/zone';
import type { CalendarEvent } from '../queries';
import { DayAgendaRow } from './day-agenda-row';
import { isCurrent, useNowTick } from './use-now-tick';

/**
 * The day board's combined mode: everybody's day as one chronological list.
 *
 * Same row as the columns draw (`calendar.md` § "Day agenda", via
 * `DayAgendaRow`) and the same card shape — only the grouping changes, so the
 * two modes read as two arrangements of one board rather than two components
 * that happen to be near each other.
 *
 * The *who* sub-label carries the weight here. Inside Mila's column a name
 * means "shared with someone"; in a merged list it is the only thing that says
 * whose event a row is, so every member on the event is named — de-duplicated
 * to a single row by `combineDayEvents`, because one family dinner is one
 * line, and rendered as "Iedereen" when nobody is named at all.
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
  const formatDateTime = useDateTimeFormat();
  const dayKey = toDateKey(toWall(day, timeZone));
  // The board is server-rendered; "which of these is happening" is not.
  const tick = useNowTick(now);

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
        .map((member) => member.displayName),
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
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1 pt-2">
            {rows.map(({ event, people }, index) => (
              <DayAgendaRow
                key={event.key}
                event={event}
                hub={hub}
                people={people}
                onSelect={onSelect}
                current={isCurrent(event, tick)}
                past={Boolean(tick && event.endsAt.getTime() < tick.getTime())}
                last={index === rows.length - 1}
              />
            ))}
          </div>
        )}
      </Card>

      <p className="sr-only">{formatDateTime(day, { dateStyle: 'full' })}</p>
    </div>
  );
}
