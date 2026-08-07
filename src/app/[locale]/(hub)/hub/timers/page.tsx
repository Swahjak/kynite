import { getFormatter, getTranslations } from 'next-intl/server';
import { requireHubDevice } from '@/modules/devices';
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
  await requireHubDevice(locale);

  const { now } = await searchParams;

  const board = await loadTimerBoard({ now });
  const t = await getTranslations('timers');
  const format = await getFormatter();

  if (!board) {
    return (
      <main className="flex min-h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <h1 className="font-display text-h1 font-bold">{t('hub.unavailableTitle')}</h1>
        <p className="text-body-lg text-ink-secondary">{t('hub.unavailableBody')}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-full flex-col gap-6 bg-background p-6" data-testid="hub-timers">
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
