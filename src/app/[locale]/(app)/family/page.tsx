import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SettingsIconTile, SettingsPage } from '@/components/settings/settings-shell';
import { MemberDialog, MemberList, loadFamilyPage } from '@/modules/family';

/** Household roster + member CRUD (PRD FR1/FR2, milestone M03; invites M14). */
export default async function FamilyPage() {
  const data = await loadFamilyPage();
  // The layout guard redirects unauthenticated requests; this is belt-and-braces.
  if (!data) notFound();

  const t = await getTranslations('family');

  return (
    <SettingsPage>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <SettingsIconTile icon="group" size="lg" />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-display text-h1 font-bold text-ink">
              {data.family?.name ?? t('title')}
            </h1>
            <p className="text-body-sm text-ink-secondary">{t('subtitle')}</p>
          </div>
        </div>
        <MemberDialog />
      </div>

      <MemberList members={data.members} invites={data.invites} serverNow={data.serverNow} />
    </SettingsPage>
  );
}
