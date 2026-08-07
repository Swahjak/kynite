import { getTranslations } from 'next-intl/server';
import { Icon } from '@/components/ui/icon';
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
    <main
      className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-8 p-4 sm:p-6"
      data-testid="routines-page"
    >
      {/* The stitch page furniture: an icon medallion beside the title, the
          subtitle underneath, and the primary action pinned to the right of the
          same row (`chores_routines_…/code.html` header block). */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-container text-brand-container-ink shadow-sm"
          >
            <Icon name="checklist" size="xl" filled />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-h1 font-bold">{t('title')}</h1>
            <p className="text-body-lg text-ink-secondary">{t('subtitle')}</p>
          </div>
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
