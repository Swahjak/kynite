import { getTranslations } from 'next-intl/server';
import { RoutineDialog, RoutineManager, loadRoutinesPage } from '@/modules/routines';
import { redirect } from '@/i18n/navigation';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The parent's routine builder (FR6). Route files hold no logic
 * (docs/architecture.md §2 rule 4): everything is `loadRoutinesPage` plus the
 * slice's own components.
 *
 * The header is the design sheet's own (`Routines.dc.html`, mobile beheer): the
 * word and the one thing you can add, and nothing else. The subtitle a
 * `PageHeader` would carry is a sentence a parent reads once and then scrolls
 * past forever, and this screen is opened to change one routine's time.
 */
export default async function RoutinesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  const data = await loadRoutinesPage();
  if (!data) redirect({ href: '/sign-in', locale });
  if (!data) return null;

  const t = await getTranslations('routines');

  return (
    <main
      className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6"
      data-testid="routines-page"
    >
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-h1 font-extrabold text-ink">{t('title')}</h1>
        {data.canWrite ? (
          <RoutineDialog members={data.members} timeZone={data.timeZone} compact />
        ) : null}
      </header>

      <RoutineManager
        routines={data.routines}
        members={data.members}
        timeZone={data.timeZone}
        canWrite={data.canWrite}
      />
    </main>
  );
}
