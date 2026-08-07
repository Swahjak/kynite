import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PushOptIn, loadNotificationsPage } from '@/modules/notifications';

/** Session- and env-dependent: never prerendered (`next build` needs no secrets). */
export const dynamic = 'force-dynamic';

/**
 * Notification settings (milestone M11, minimal — the full settings tree is
 * M16's).
 *
 * This page exists so that push opt-in has somewhere deliberate to live: §6
 * step 1 requires the prompt to follow a meaningful action and never a first
 * load, which means it has to be behind navigation a parent chose.
 */
export default async function NotificationSettingsPage() {
  const data = await loadNotificationsPage();
  if (!data) notFound();

  const t = await getTranslations('notifications.settings');

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold">{t('pageTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('pageSubtitle')}</p>
      </div>

      <PushOptIn publicKey={data.publicKey} subscriptionCount={data.subscriptionCount} />
    </main>
  );
}
