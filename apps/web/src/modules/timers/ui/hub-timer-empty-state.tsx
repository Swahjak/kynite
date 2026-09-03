'use client';

import { useTranslations } from 'next-intl';
import { Button, EmptyState } from '@kynite/ui';
import { Link } from '@/i18n/navigation';

/**
 * The fullscreen hub timer with nothing running — reached either directly
 * (`(hub)/hub/timer/page.tsx`, before any timer exists) or live (the last
 * timer on the board is stopped while a family is looking at
 * `HubTimerScreen`, which renders this same component rather than a second
 * copy of the copy).
 *
 * A client component, deliberately, even though the page-level dead end could
 * have been a server one: `HubTimerScreen` (`useTimerChannel`, `'use client'`)
 * is the *other* place this renders, and a client component cannot mount an
 * async server component inline — only pass one down as `children`. Reading
 * `useTranslations()` here instead of `getTranslations()` is what lets both
 * call sites share the one component.
 */
export function HubTimerEmptyState() {
  const t = useTranslations('hub.timer');

  return (
    <main
      data-testid="hub-timer-empty"
      className="flex min-h-full flex-col items-center justify-center bg-background px-6 py-4"
    >
      <EmptyState
        size="hub"
        heading
        icon="timer"
        title={t('emptyTitle')}
        description={t('emptyBody')}
        action={
          <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
            <Button variant="outline" size="hub" render={<Link href="/hub" />} nativeButton={false}>
              {t('backToBoard')}
            </Button>
            <Button size="hub" render={<Link href="/hub/timers" />} nativeButton={false}>
              {t('startOne')}
            </Button>
          </div>
        }
      />
    </main>
  );
}
