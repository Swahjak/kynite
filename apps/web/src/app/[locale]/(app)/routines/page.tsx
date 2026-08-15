import { getTranslations } from 'next-intl/server';
import { RoutineDialog, RoutineList, loadRoutinesPage } from '@/modules/routines';
import { PageHeader } from '@/components/kynite';
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
      <PageHeader
        icon="checklist"
        iconTint="brand-container"
        iconFilled
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          data.canWrite ? <RoutineDialog members={data.members} timeZone={data.timeZone} /> : null
        }
      />

      <RoutineList
        routines={data.routines}
        members={data.members}
        timeZone={data.timeZone}
        canWrite={data.canWrite}
      />
    </main>
  );
}
