import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MemberDialog, MemberList, getFamily, getPrincipal, listMembers } from '@/modules/family';

/** Household roster + member CRUD (PRD FR1/FR2, milestone M03). */
export default async function FamilyPage() {
  const principal = await getPrincipal();
  // The layout guard redirects unauthenticated requests; this is belt-and-braces.
  if (!principal) notFound();

  const [family, members, t] = await Promise.all([
    getFamily(principal.familyId),
    listMembers(principal.familyId),
    getTranslations('family'),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-bold">{family?.name ?? t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <MemberDialog />
      </div>

      <MemberList members={members} />
    </main>
  );
}
