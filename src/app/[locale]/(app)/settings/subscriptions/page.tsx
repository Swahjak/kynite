import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  SettingsBackLink,
  SettingsPage,
  SettingsPageHeader,
} from '@/components/settings/settings-shell';
import { IcsSubscriptionsPanel, loadSubscriptionsPage } from '@/modules/ics';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * `(app)/settings/subscriptions` — calendars the household follows but does not
 * own (M25): the school's holidays, the sports club's fixtures.
 *
 * A sibling route to `/settings/google` rather than a section on the settings
 * hub, for the reason the hub page itself gives: each of the four (now five)
 * routes that kept their own page is "a flow rather than a field". Adding a
 * feed is a flow — paste, validate against a real server, name it — and it can
 * fail in half a dozen ways a settings field never does.
 *
 * `loadSubscriptionsPage` refuses a non-member principal and anyone without
 * `ics:manage` outright, so a child's login or a wall tablet gets a 404 rather
 * than a list of the household's feed URLs.
 */
export default async function SubscriptionsSettingsPage() {
  const data = await loadSubscriptionsPage();
  if (!data) notFound();

  const [t, tSettings] = await Promise.all([getTranslations('ics'), getTranslations('settings')]);

  return (
    <SettingsPage>
      <SettingsBackLink label={tSettings('back')} />
      <SettingsPageHeader icon="event" title={t('title')} description={t('subtitle')} />

      <IcsSubscriptionsPanel subscriptions={data.subscriptions} canManage={data.canManage} />
    </SettingsPage>
  );
}
