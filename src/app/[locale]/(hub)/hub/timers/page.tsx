import { getFormatter, getTranslations } from 'next-intl/server';
import { requireHubDevice } from '@/modules/devices';
import {
  DURATION_PRESETS,
  TimerBoard,
  loadTimerBoard,
  type TimerQuickStart,
} from '@/modules/timers';

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
 * Addressing is settled in `(hub)/layout.tsx`: the hub tree keeps its `/hub`
 * prefix, and this page is reached only behind a device principal (M12).
 */
export default async function HubTimersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ now?: string }>;
}) {
  const { locale } = await params;
  const { now } = await searchParams;
  await requireHubDevice(locale, '/hub/timers', { now });

  const board = await loadTimerBoard({ now });
  const t = await getTranslations('timers');
  const hub = await getTranslations('hub.timers');
  const format = await getFormatter();

  // M19, owner decision: the wall starts timers, it does not only display them.
  // `timer:control` is `allow` for a device principal (§7), so the Server
  // Action was already there and only the control was missing. The copy comes
  // from the `hub` namespace and is passed *into* the shared board — the board
  // is the same component on both surfaces, and a hub-only fork of it is
  // exactly what M19's architecture decision forbids.
  const quickStart: TimerQuickStart[] = DURATION_PRESETS.map((seconds) => {
    const minutes = Math.round(seconds / 60);
    return {
      seconds,
      label: hub('start', { minutes }),
      ariaLabel: hub('startNamed', { minutes }),
      // Not the button's face. "5 min" as a timer *name* makes every wall timer
      // identically titled; this is the name the tile, the stop control and the
      // warning line all speak, so it has to be a name.
      startLabel: hub('quickStartLabel', { minutes }),
    };
  });

  if (!board) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="font-display text-h1 font-bold">{t('hub.unavailableTitle')}</h1>
        <p className="text-body-lg text-ink-secondary">{t('hub.unavailableBody')}</p>
      </main>
    );
  }

  return (
    // Same tightened kiosk rhythm as the routines screen — see the note there
    // (M19 review, F8).
    <main
      className="flex min-h-full flex-col gap-4 bg-background px-6 py-4"
      data-testid="hub-timers"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-display-md font-extrabold">{t('hub.title')}</h1>
        {/* The Stitch board clock token (72px) — see the routines screen. */}
        <span className="tabular-time text-display-hub font-extrabold text-brand-ink">
          {format.dateTime(new Date(board.serverNow), { hour: '2-digit', minute: '2-digit' })}
        </span>
      </header>

      <TimerBoard
        board={board}
        quickStart={quickStart}
        quickStartTitle={hub('startTitle')}
        atMaximumLabel={hub('atMaximum')}
      />
    </main>
  );
}
