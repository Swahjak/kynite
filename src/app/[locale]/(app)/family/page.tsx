import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MemberDialog, MemberList, loadFamilyPage } from '@/modules/family';

/** Household roster + member CRUD (PRD FR1/FR2, milestone M03; invites M14). */
export default async function FamilyPage() {
  const data = await loadFamilyPage();
  // The layout guard redirects unauthenticated requests; this is belt-and-braces.
  if (!data) notFound();

  const t = await getTranslations('family');

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-bold">{data.family?.name ?? t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <MemberDialog />
      </div>

      <MemberList members={data.members} invites={data.invites} serverNow={data.serverNow} />
    </main>
  );
}
