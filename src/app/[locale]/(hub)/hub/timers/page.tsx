import { getFormatter, getTranslations } from 'next-intl/server';
import { TimerBoard, loadTimerBoard } from '@/modules/timers';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The hub timers screen (M09).
 *
 * The board speaks for itself: it names what is running and how long is left,
 * and says the time is up when it is (FR30 — never "you still have to…", never
 * a parent's voice). The countdown is server-authoritative in its start time,
 * so this page can be reloaded at any point in a countdown and resume on the
 * same second.
 *
 * Addressed `/hub/timers` rather than §2's `(hub)/timers` for the same reason
 * the routine screen is: M01 put the ambient board at `(hub)/hub`, so every
 * hub URL carries the `/hub` prefix, and `(app)/timers` is the Controller's.
 * M12 owns resolving the hub's addressing with device pairing.
 */
export default async function HubTimersPage({
  searchParams,
}: {
  searchParams: Promise<{ now?: string }>;
}) {
  const { now } = await searchParams;

  const board = await loadTimerBoard({ now });
  const t = await getTranslations('timers');
  const format = await getFormatter();

  if (!board) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="font-display text-h1 font-bold">{t('hub.unavailableTitle')}</h1>
        <p className="text-body-lg text-ink-secondary">{t('hub.unavailableBody')}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-col gap-6 bg-background p-6" data-testid="hub-timers">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-display-md font-extrabold">{t('hub.title')}</h1>
        <span className="tabular-time text-display-md font-extrabold text-brand-ink">
          {format.dateTime(new Date(board.serverNow), { hour: '2-digit', minute: '2-digit' })}
        </span>
      </header>

      <TimerBoard board={board} />
    </main>
  );
}
