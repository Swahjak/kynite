'use client';

import { useTranslations } from 'next-intl';
import { useDateTimeFormat } from '@/components/formatting';
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
 * The hub's IndexedDB mirror, as the component that can change its mind after
 * mount (docs/architecture.md §6: family state is mirrored to IDB on every load
 * and every SSE event, and "boot renders from IDB then reconciles").
 *
 * ## What changed in M25, and why
 *
 * This used to *be* the hub's board: it owned the heading, the clock and the
 * columns, because the reconcile has to swap all of them together or the wall
 * contradicts itself. The wall now renders the same composition `(app)/today`
 * does — the hub is the app with restricted permissions, not a second product —
 * and that composition is Server Components all the way down (`TodayHeader`,
 * `TodayNowStrip`, the four tabs). None of it can be re-rendered from a
 * snapshot in the browser.
 *
 * So the mirror keeps its contract by changing what it swaps *to*. In the
 * ordinary case — the document and the snapshot describe the same render, which
 * is every online load and every ordinary offline reload — this component is a
 * pass-through and the wall shows the full composition. Only when the device
 * genuinely knows something **newer** than the document it was served (a tablet
 * that kept receiving events after its last navigation, then rebooted offline)
 * does it draw the cached board itself: the day, the clock and the events from
 * that snapshot, in the compact shape this file has always drawn.
 *
 * That is a real degradation and it is stated rather than hidden: the cached
 * board carries the schedule and not the tasks, the routine progress or the
 * stars, because a snapshot of those is a *number* and a stale number on a wall
 * is worse than an absent one (the same argument `AmbientTimers` and
 * `ChildLauncher` are excluded from the payload for). The alternative — making
 * the whole composition client-rendered so it could be replayed from IDB — buys
 * a fresher board in one rare case at the cost of moving four server components
 * and their queries into the browser bundle.
 *
 * The three rules of the swap are unchanged and live in `useMirroredHubState`:
 * same family, strictly fresher, live data always wins.
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
  greeting,
  /**
   * The live composition, server-rendered by the page. Rendered as-is unless a
   * strictly fresher snapshot is adopted, in which case the cached board below
   * takes its place.
   */
  children,
}: {
  familyId: string;
  snapshot: HubBoardSnapshot;
  /**
   * The household greeting the live header shows, passed through so the cached
   * board keeps the same `h1` rather than announcing itself differently the one
   * time the wall is offline.
   */
  greeting: string;
  children?: React.ReactNode;
}) {
  const board = useMirroredHubState(familyId, snapshot);
  const t = useTranslations('calendar');
  const formatDateTime = useDateTimeFormat();

  // Adoption is by `generatedAt` and only ever upward, so this is exactly
  // "the device knew something newer than the document".
  if (board.generatedAt === snapshot.generatedAt) return <>{children}</>;

  return (
    <div data-testid="hub-cached-board" className="flex min-h-0 flex-1 flex-col gap-4">
      {/* The same three-part row the live header draws — greeting, the day, the
          clock — at the composition's own scale rather than the 72px
          `display-hub` step the old ambient board used. The kiosk type scale is
          applied on the document element (`[data-surface='hub']`), so every
          token here is already the wall's size; a second, bigger heading on top
          of that was what pushed the board into an internal scroll. */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h1 font-extrabold" data-testid="today-greeting">
          {greeting}
        </h1>

        <div data-testid="today-clock" className="flex flex-col items-end text-right">
          <span className="font-display text-h2 font-bold tabular-nums">
            {formatDateTime(board.now, { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-body-sm text-ink-secondary">
            {formatDateTime(board.anchor, { dateStyle: 'full' })}
          </span>
        </div>
      </header>

      <p className="text-body-sm text-ink-secondary">{t('hub.cachedBoard')}</p>

      {/* FR28's "default view", as the only two shapes a cached wall board can
          carry: the per-person day columns, or "what is coming up". The switch
          travelled with the snapshot, so a reconciled board draws the events it
          was fetched for in the layout they were fetched for. */}
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
    </div>
  );
}
