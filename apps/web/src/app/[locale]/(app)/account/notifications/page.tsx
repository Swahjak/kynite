import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  SettingsBackLink,
  SettingsPage,
  SettingsPageHeader,
} from '@/components/settings/settings-shell';
import { PushOptIn, loadNotificationsPage } from '@/modules/notifications';

/** Session- and env-dependent: never prerendered (`next build` needs no secrets). */
export const dynamic = 'force-dynamic';

/**
 * Notification settings (milestone M11) — a member's own push opt-in, so it
 * lives under `/account` (H4 review), not `/manage`: every member, a child
 * included, owns their devices' subscriptions.
 *
 * This page exists so that push opt-in has somewhere deliberate to live: §6
 * step 1 requires the prompt to follow a meaningful action and never a first
 * load, which means it has to be behind navigation a parent chose.
 */
export default async function NotificationSettingsPage() {
  const data = await loadNotificationsPage();
  if (!data) notFound();

  const [t, tAccount] = await Promise.all([
    getTranslations('notifications.settings'),
    getTranslations('account'),
  ]);

  return (
    <SettingsPage>
      <SettingsBackLink href="/account" label={tAccount('back')} />
      <SettingsPageHeader
        icon="notifications"
        title={t('pageTitle')}
        description={t('pageSubtitle')}
      />

      <PushOptIn publicKey={data.publicKey} subscriptionCount={data.subscriptionCount} />
    </SettingsPage>
  );
}
