import { getTranslations } from 'next-intl/server';
import { RoutineDialog, RoutineList, loadRoutinesPage } from '@/modules/routines';
import { redirect } from '@/i18n/navigation';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The parent's routine builder (FR6). Route files hold no logic
 * (docs/architecture.md §2 rule 4): everything is `loadRoutinesPage` plus the
 * slice's own components.
 */
export default async function RoutinesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  const data = await loadRoutinesPage();
  if (!data) redirect({ href: '/sign-in', locale });
  if (!data) return null;

  const t = await getTranslations('routines');

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-6 p-6" data-testid="routines-page">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-h1 font-bold">{t('title')}</h1>
          <p className="text-body-lg text-ink-secondary">{t('subtitle')}</p>
        </div>
        {data.canWrite ? <RoutineDialog members={data.members} timeZone={data.timeZone} /> : null}
      </header>

      <RoutineList
        routines={data.routines}
        members={data.members}
        timeZone={data.timeZone}
        canWrite={data.canWrite}
      />
    </main>
  );
}
