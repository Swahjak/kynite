'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useMirroredHubState } from '@/components/offline';
// Type-only, like `person-columns.tsx` — `@/modules/family` re-exports
// `server-only` queries, and a value import here would put the database client
// in the browser bundle.
import type { Member } from '@/modules/family';
import { daysOf, type CalendarView } from '../domain/window';
import type { CalendarEvent } from '../queries';
import { AgendaView } from './agenda-view';
import { PersonColumns } from './person-columns';

/**
 * The hub board, as the client component that owns its own state.
 *
 * The page above is still the thing that *reads* the family (server-rendered,
 * per family, with the server's clock). What this adds is the second half of
 * docs/architecture.md §6's mirror sentence — "boot renders from IDB then
 * reconciles" — which needs a component that can change its mind after mount.
 *
 * Everything a person reads from six feet away lives inside here for one
 * reason: the reconcile must be atomic across the board. A date heading from a
 * cached document sitting above columns from a newer snapshot would be a wall
 * display contradicting itself, which is worse than either version alone. So
 * the day, the clock and the columns all come from the same payload —
 * whichever payload won.
 *
 * The wall clock is the one honest exception to "everything is from the
 * payload": it is the render instant, and it is what M09's countdowns are
 * derived from, so a cached document showing an old minute is corrected by the
 * next render rather than by this component pretending to know the time.
 */

export type HubBoardSnapshot = {
  /** Server render instant — the mirror compares these, never a device clock. */
  generatedAt: number;
  /** The day the board is showing, not the day it was saved. */
  anchor: Date;
  now: Date;
  timeZone: string;
  /**
   * Which board this is (PRD FR28, M16) — part of the mirrored payload rather
   * than a prop for the same reason `anchor` and `timeZone` are: a boot from
   * IndexedDB must not draw yesterday's events in today's layout. The view and
   * the events it was fetched for travel together or not at all.
   */
  view: CalendarView;
  weekStartsOn: number;
  members: Member[];
  events: CalendarEvent[];
};

export function HubBoard({
  familyId,
  snapshot,
  /**
   * Rendered between the header and the columns — M09's ambient timers, which
   * the *page* still owns. They are server-rendered children passed through,
   * not part of the mirrored payload: a countdown is derived from a running
   * row and the server clock, and a snapshot of one would be a wrong number on
   * a wall (`HUB_NETWORK_TIMEOUT_SECONDS` makes the same argument).
   */
  children,
}: {
  familyId: string;
  snapshot: HubBoardSnapshot;
  children?: React.ReactNode;
}) {
  const board = useMirroredHubState(familyId, snapshot);
  const t = useTranslations('calendar');
  const format = useFormatter();

  return (
    <>
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-display-md font-extrabold">{t('hub.title')}</h1>
          <p className="text-body-lg text-ink-secondary">
            {format.dateTime(board.anchor, { dateStyle: 'full' })}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {/* A real wall clock — the one deliberately live thing on the board. */}
          <span
            data-testid="hub-clock"
            className="tabular-time text-display-md font-extrabold text-brand-ink"
          >
            {format.dateTime(board.now, { hour: '2-digit', minute: '2-digit' })}
          </span>
          {/* FR21's offline indicator used to sit here. M12 moved it into the
              kiosk shell's chrome, which every hub surface shares: two of them
              on one board (the shell's and this one's) is not a stronger
              signal, it is a duplicated one. Same component, same derivation
              from the SSE connection rather than `navigator.onLine` (§6). */}
        </div>
      </header>

      {children}

      {/* FR28's "default view", as the only two shapes a wall display can
          carry: the per-person day columns, or "what is coming up". The
          switch is server-decided (`family.hubDefaultView`) and arrives in
          the payload, so a change in the Controller reaches the wall on the
          next render — no re-pairing, and nothing stored on the device. */}
      {board.view === 'agenda' ? (
        <AgendaView
          days={daysOf('agenda', {
            anchor: board.anchor,
            timeZone: board.timeZone,
            weekStartsOn: board.weekStartsOn,
          })}
          events={board.events}
          timeZone={board.timeZone}
          today={board.now}
          hub
          // No `onSelect`: `event:write` is `deny` for a device principal (§7),
          // so the hub offers no editing rather than offering some that would
          // be refused.
        />
      ) : (
        <PersonColumns
          members={board.members}
          events={board.events}
          timeZone={board.timeZone}
          day={board.anchor}
          now={board.now}
          hub
        />
      )}
    </>
  );
}
