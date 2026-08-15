import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  SettingsBackLink,
  SettingsPage,
  SettingsPageHeader,
  SettingsSection,
} from '@/components/settings/settings-shell';
import { CreateShareLinkPanel, ShareLinkList, loadSharingPage } from '@/modules/sharing';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * `(app)/settings/sharing` — the parent side of caregiver links (M13).
 *
 * Two things live here: making a link, and taking one away — both
 * `share:manage`, which the §7 matrix grants to owners and adults and to nobody
 * else. `loadSharingPage` refuses a non-member principal outright rather than
 * relying on that cell alone, for the same reason `loadDevicesPage` does: the
 * list of every open door into a household is not something to render on a
 * screen in the hall, or behind a link that is itself one of those doors.
 *
 * This is also where the usage telemetry surfaces. That placement is the
 * feature, not a detail — a share link is the one credential in this product
 * with no person attached to it, so "opened 4 times, last opened yesterday" is
 * the only evidence a parent has when deciding whether a link still belongs to
 * somebody.
 */
export default async function SharingSettingsPage() {
  const data = await loadSharingPage();
  if (!data) notFound();

  const [t, tSettings] = await Promise.all([
    getTranslations('sharing'),
    getTranslations('settings'),
  ]);

  return (
    <SettingsPage>
      <SettingsBackLink label={tSettings('back')} />
      <SettingsPageHeader icon="share" title={t('pageTitle')} description={t('pageSubtitle')} />

      {data.canManage ? (
        <CreateShareLinkPanel members={data.members} calendars={data.calendars} />
      ) : null}

      <SettingsSection title={t('list.title')}>
        <ShareLinkList links={data.links} serverNow={data.serverNow} canManage={data.canManage} />
      </SettingsSection>
    </SettingsPage>
  );
}
