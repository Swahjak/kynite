import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

/**
 * The localized 404 (M18).
 *
 * It lives at the locale segment, which is the only place it can serve every
 * `notFound()` in the app: `(app)/settings`, `(app)/settings/devices`, the hub
 * pages and the share view all throw it in normal use — a settings section a
 * caregiver principal may not read, a share token that has been revoked — and
 * before this file every one of them rendered Next.js's built-in English
 * screen inside a Dutch household's app.
 *
 * A server component, deliberately: a 404 has nothing to recover from and no
 * state, so there is no reason to ship it to the browser. `getTranslations()`
 * reads the request locale, which `src/i18n/request.ts` resolves from the URL
 * prefix (`localePrefix: 'always'`), so a `/en/...` miss answers in English.
 */
export default async function LocaleNotFound() {
  const t = await getTranslations('errors.notFound');

  return (
    <main
      data-testid="not-found"
      className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <h1 className="font-display text-h2 font-bold">{t('title')}</h1>
      <p className="text-body text-ink-secondary">{t('body')}</p>
      <Button size="hub" render={<Link href="/today" />} nativeButton={false}>
        {t('home')}
      </Button>
    </main>
  );
}
