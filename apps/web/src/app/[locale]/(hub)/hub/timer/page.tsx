import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@kynite/ui';
import { requireHubDevice } from '@/modules/devices';
import { HubTimerEmptyState, HubTimerScreen, loadTimerBoard } from '@/modules/timers';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The fullscreen hub timer (M-T2) — the Google-Nest-Hub-reference screen a
 * family lands on the instant a countdown starts on the wall: one giant ring,
 * pause/stop either side of it, every other running timer along the bottom
 * edge. `docs/adr` carries no entry of its own for this — it is
 * `(hub)/hub/timers`' board, re-drawn at hero scale, not a new capability, so
 * it reads the same `loadTimerBoard()` and answers to the same
 * `requireHubDevice` gate that route does.
 *
 * Addressing: singular `/hub/timer`, deliberately distinct from the existing
 * plural `/hub/timers` (the board with the quick-start presets). Both stay —
 * `/hub/timers` is still where a timer is *started* from the rail-less wall
 * (a direct visit, or the empty state below), `/hub/timer` is where the wall
 * *watches* one once it exists. `IdleReturn` (`components/hub/idle-return.tsx`)
 * reads the same distinction to decide whether to bounce home.
 *
 * Two dead ends read the exact same copy and controls
 * (`HubTimerEmptyState`) — no board at all (a device with no family, the
 * `unavailableTitle` case `/hub/timers` also has) is folded into the same
 * "nothing to watch" empty state rather than a second one of its own; there
 * is nothing a family standing at the wall can do differently for either.
 */
export default async function HubTimerPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ now?: string }>;
}) {
  const { locale } = await params;
  const { now } = await searchParams;
  await requireHubDevice(locale, '/hub/timer', { now });

  const board = await loadTimerBoard({ now });

  if (!board) {
    const t = await getTranslations('timers');
    return (
      <main className="min-h-full" data-testid="hub-timer-unavailable">
        <EmptyState
          size="hub"
          heading
          title={t('hub.unavailableTitle')}
          description={t('hub.unavailableBody')}
        />
      </main>
    );
  }

  if (board.timers.length === 0) return <HubTimerEmptyState />;

  return <HubTimerScreen board={board} />;
}
