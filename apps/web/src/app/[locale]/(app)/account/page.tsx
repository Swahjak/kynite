import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  SettingsNavRow,
  SettingsPage,
  SettingsPageHeader,
  SettingsSection,
} from '@/components/settings/settings-shell';
import { NotificationPreferencesForm, loadNotificationsPage } from '@/modules/notifications';
import { SurfacePreferenceForm, getSurfacePreference } from '@/modules/surface';

/** Session-dependent: never prerendered, so `next build` needs no secrets. */
export const dynamic = 'force-dynamic';

/**
 * A member's own settings (H4 review): their notification preferences and the
 * surface their browser renders as. Both are authorized by `member:self`, so
 * unlike `/manage/*` every signed-in member reaches this — a child included.
 * The `(app)` layout already turns a device and a signed-out visitor away.
 *
 * The sections are the ones that used to sit on the settings hub, moved here
 * unchanged; family-wide settings stay under `/manage/settings`.
 */
export default async function AccountPage() {
  const [notifications, surfacePreference] = await Promise.all([
    loadNotificationsPage(),
    getSurfacePreference(),
  ]);
  if (!notifications) notFound();

  const [t, tAccount] = await Promise.all([
    getTranslations('settings'),
    getTranslations('account'),
  ]);

  return (
    <SettingsPage>
      <SettingsPageHeader
        icon="settings"
        title={tAccount('title')}
        description={tAccount('subtitle')}
      />

      <SettingsSection
        id="notifications"
        title={t('notifications.title')}
        description={t('notifications.description')}
      >
        <NotificationPreferencesForm preferences={notifications.preferences} />
        <SettingsNavRow
          href="/account/notifications"
          icon="notifications"
          label={t('notifications.manage')}
          bordered
        />
      </SettingsSection>

      <SettingsSection
        id="surface"
        title={t('surface.title')}
        description={t('surface.description')}
      >
        <SurfacePreferenceForm preference={surfacePreference} />
      </SettingsSection>
    </SettingsPage>
  );
}
