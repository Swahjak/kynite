import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
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

  const t = await getTranslations('devices');

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold">{t('pageTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>

      {data.canManage ? <PairDevicePanel /> : null}

      <PendingCodeList
        pending={data.pending}
        serverNow={data.serverNow}
        canManage={data.canManage}
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-h3 font-semibold">{t('list.title')}</h2>
        <DeviceList devices={data.devices} serverNow={data.serverNow} canManage={data.canManage} />
      </section>
    </main>
  );
}
