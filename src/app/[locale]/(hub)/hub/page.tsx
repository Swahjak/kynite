import { getTranslations } from 'next-intl/server';
import { HubBoard, loadCalendarPage } from '@/modules/calendar';
import { AmbientTimers, loadTimerBoard } from '@/modules/timers';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The hub ambient board (M06): one column per member in `sortOrder`, each in
 * their own color, at 6-foot legibility.
 *
 * Two things are deliberately different from `(app)/today`. Private calendars
 * render free/busy only — a kitchen wall is not a private surface — which
 * `loadCalendarPage({ surface: 'hub' })` enforces. And there is no event
 * dialog at all: `event:write` is `deny` for a device principal (§7), so the
 * board offers no writes rather than offering some that would be refused.
 *
 * M01 put this at `(hub)/hub` rather than `(hub)/` as §2 describes; M12 owns
 * resolving that along with device pairing, so the addressing stands for now.
 */
export default async function HubPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; now?: string }>;
}) {
  const { date, now } = await searchParams;

  // The board is an ambient "today" surface; `?date=` renders another day,
  // which is what a tomorrow-preview needs and what makes the board
  // snapshot-testable without freezing a clock.
  const data = await loadCalendarPage({ view: 'day', date, surface: 'hub' });
  // Renders nothing when nothing is running, so the board is unchanged the
  // rest of the day.
  const timers = await loadTimerBoard({ now });
  const t = await getTranslations('calendar');

  if (!data) {
    // No paired device session exists until M12; until then an unauthenticated
    // hub says so rather than rendering an empty board that looks broken.
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="font-display text-h1 font-bold">{t('hub.unpairedTitle')}</h1>
        <p className="text-body-lg text-ink-secondary">{t('hub.unpairedBody')}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col gap-4 bg-background p-6" data-testid="hub-board">
      {/* §6: family state is mirrored to IndexedDB on every load and every SSE
          event, and a boot renders from IDB then reconciles. Both halves live
          in `HubBoard`, because the reconcile has to swap the heading, the day
          and the columns together or the wall contradicts itself.

          `generatedAt` is the server's render instant and the only thing the
          mirror compares: a snapshot is adopted over this document strictly
          when it is newer, from the same family, and the stream is not up. */}
      <HubBoard
        familyId={data.familyId}
        snapshot={{
          // The server's own render instant, not `Date.now()` in a client
          // component: two snapshots must be comparable across devices.
          generatedAt: data.now.getTime(),
          anchor: data.anchor,
          now: data.now,
          timeZone: data.timeZone,
          members: data.members,
          events: data.events,
        }}
      >
        {/* M09: a running timer is on the board without anyone navigating to
            it. Passed as a child rather than mirrored — a countdown comes from
            the server's clock, and a cached one would be a wrong number. */}
        {timers ? <AmbientTimers board={timers} /> : null}
      </HubBoard>
    </main>
  );
}
