'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@kynite/ui';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * The route-level error boundary for everything under `[locale]` (M18).
 *
 * It sits at the locale segment rather than inside `(app)`, so the parent app,
 * the auth forms, the marketing page and the caregiver share view are all
 * covered by one boundary — every one of them renders inside
 * `[locale]/layout.tsx`'s `NextIntlClientProvider`, which is why the copy here
 * can be translated at all. The kiosk overrides it with its own
 * (`(hub)/error.tsx`): a wall tablet needs a *recovery*, not a button.
 *
 * `reset()` is offered before "go home" because the common case is a transient
 * failure — a database blip, a Google call that timed out — and re-rendering
 * the segment costs nothing. The `console.error` is deliberate: Next reports
 * the digest but not the message in production, and the browser console is the
 * only place a parent can be asked to look.
 *
 * "Go home" is offered to people who *have* a home. The caregiver share view
 * (`/s/…`) is reached with a link and a token and nothing else: its viewer has
 * no session, and `/today` would bounce them to a sign-in form for an account
 * they do not have. There, `reset()` is the only honest offer.
 */

/** The share tree's first segment — see `proxy.ts`'s `SHARE_SECTION`. */
const SHARE_SEGMENT = 's';
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');
  // Locale-stripped by `usePathname`, so the first segment is the section.
  const pathname = usePathname();
  const shared = pathname === `/${SHARE_SEGMENT}` || pathname.startsWith(`/${SHARE_SEGMENT}/`);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      data-testid="route-error"
      className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <h1 className="font-display text-h2 font-bold">{t('title')}</h1>
      <p className="text-body text-ink-secondary">{t('body')}</p>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" size="hub" onClick={reset} data-testid="route-error-retry">
          {t('retry')}
        </Button>
        {shared ? null : (
          <Button variant="outline" size="hub" render={<Link href="/today" />} nativeButton={false}>
            {t('home')}
          </Button>
        )}
      </div>

      {error.digest ? (
        <p className="text-caption text-ink-muted" data-testid="route-error-digest">
          {t('reference', { digest: error.digest })}
        </p>
      ) : null}
    </main>
  );
}
