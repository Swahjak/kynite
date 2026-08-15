import { getTranslations } from 'next-intl/server';
import { TimerControls, loadTimersPage } from '@/modules/timers';
import { PageHeader } from '@/components/kynite';

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
      <PageHeader
        icon="timer"
        iconTint="brand-container"
        iconFilled
        title={t('title')}
        subtitle={t('subtitle')}
      />

      <TimerControls page={page} />
    </main>
  );
}
