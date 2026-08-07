import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/ui/icon';
import { TimerControls, loadTimersPage } from '@/modules/timers';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The Controller's timer surface (M09).
 *
 * A parent starts a timer here — from a routine step's saved prescription or
 * ad hoc — and it appears on the hub. The write is server-authoritative in its
 * start time, so "reflects on the hub" is a matter of the hub noticing the new
 * row (polling today, SSE in M10), not of two clocks agreeing.
 */
export default async function TimersPage() {
  const page = await loadTimersPage();
  const t = await getTranslations('timers');

  if (!page) return null;

  return (
    <main
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 p-4 sm:p-6"
      data-testid="timers-page"
    >
      <header className="flex items-center gap-4">
        <span
          aria-hidden
          className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-container text-brand-container-ink shadow-sm"
        >
          <Icon name="timer" size="xl" filled />
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-h1 font-bold">{t('title')}</h1>
          <p className="text-body text-ink-secondary">{t('subtitle')}</p>
        </div>
      </header>

      <TimerControls page={page} />
    </main>
  );
}
