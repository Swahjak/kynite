'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { OfflineIndicator, useMirroredHubState } from '@/components/offline';
// Type-only, like `person-columns.tsx` — `@/modules/family` re-exports
// `server-only` queries, and a value import here would put the database client
// in the browser bundle.
import type { Member } from '@/modules/family';
import type { CalendarEvent } from '../queries';
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
          {/* FR21: a non-disruptive indicator, derived from the SSE connection
              and never from `navigator.onLine` (§6). Renders nothing while the
              stream is healthy, so the board is unchanged the rest of the day. */}
          <OfflineIndicator />
        </div>
      </header>

      {children}

      <PersonColumns
        members={board.members}
        events={board.events}
        timeZone={board.timeZone}
        day={board.anchor}
        now={board.now}
        hub
      />
    </>
  );
}
