import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  SettingsBackLink,
  SettingsPage,
  SettingsPageHeader,
  SettingsSection,
} from '@/components/settings/settings-shell';
import { DeviceList, PairDevicePanel, PendingCodeList, loadDevicesPage } from '@/modules/devices';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * `(app)/settings/devices` — the parent side of kiosk pairing (M12).
 *
 * Two things live here and nothing else: minting a code, and taking one away.
 * Both are `device:manage`, which the §7 matrix grants to owners and adults and
 * to no one else — notably not to a *device*, so a paired kiosk can never
 * enrol a second one. `loadDevicesPage` refuses a non-member principal outright
 * rather than relying on that cell alone: the list of every screen in a house,
 * with the times each was last touched, is not something to render on a screen
 * in the hall.
 */
export default async function DeviceSettingsPage() {
  const data = await loadDevicesPage();
  if (!data) notFound();

  const [t, tSettings] = await Promise.all([
    getTranslations('devices'),
    getTranslations('settings'),
  ]);

  return (
    <SettingsPage>
      <SettingsBackLink label={tSettings('back')} />
      <SettingsPageHeader
        icon="tablet_mac"
        title={t('pageTitle')}
        description={t('pageSubtitle')}
      />

      {data.canManage ? <PairDevicePanel /> : null}

      <PendingCodeList
        pending={data.pending}
        serverNow={data.serverNow}
        canManage={data.canManage}
      />

      <SettingsSection title={t('list.title')}>
        <DeviceList devices={data.devices} serverNow={data.serverNow} canManage={data.canManage} />
      </SettingsSection>
    </SettingsPage>
  );
}
