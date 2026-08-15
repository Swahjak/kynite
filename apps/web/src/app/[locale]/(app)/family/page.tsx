import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@/components/kynite';
import { SettingsPage } from '@/components/settings/settings-shell';
import { MemberDialog, MemberList, loadFamilyPage } from '@/modules/family';

/** Household roster + member CRUD (PRD FR1/FR2, milestone M03; invites M14). */
export default async function FamilyPage() {
  const data = await loadFamilyPage();
  // The layout guard redirects unauthenticated requests; this is belt-and-braces.
  if (!data) notFound();

  const t = await getTranslations('family');

  return (
    <SettingsPage>
      <PageHeader
        icon="group"
        iconTint="brand-container"
        title={data.family?.name ?? t('title')}
        subtitle={t('subtitle')}
        action={<MemberDialog />}
      />

      <MemberList members={data.members} invites={data.invites} serverNow={data.serverNow} />
    </SettingsPage>
  );
}
