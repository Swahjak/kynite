import { getTranslations } from 'next-intl/server';
import { requireManager } from '@/modules/devices';
import {
  SettingsNavRow,
  SettingsPage,
  SettingsPageHeader,
  SettingsSection,
} from '@/components/settings/settings-shell';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * The Beheer index (D10, docs/plans/2026-09-15-hub-equals-app.md).
 *
 * One entry point for everything a hub device may not do — the routine
 * builder, the rewards management surface, the household roster and the
 * settings tree. Each area is one icon-led row with a one-line description,
 * the same `SettingsNavRow` idiom the settings hub already uses for its own
 * sub-flows; this page composes existing primitives rather than inventing a
 * new list.
 */
export default async function ManagePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // Member-only and manage-permission, like every page under it (D10).
  await requireManager(locale, '/manage');

  const t = await getTranslations('manage');

  return (
    <SettingsPage>
      <SettingsPageHeader icon="settings" title={t('title')} description={t('subtitle')} />

      <SettingsSection title={t('areas')}>
        <SettingsNavRow
          href="/manage/routines"
          icon="restart_alt"
          label={t('routines')}
          description={t('routinesDescription')}
        />
        <SettingsNavRow
          href="/manage/rewards"
          icon="star"
          label={t('rewards')}
          description={t('rewardsDescription')}
        />
        <SettingsNavRow
          href="/manage/family"
          icon="group"
          label={t('family')}
          description={t('familyDescription')}
        />
        <SettingsNavRow
          href="/manage/settings"
          icon="settings"
          label={t('settings')}
          description={t('settingsDescription')}
        />
      </SettingsSection>
    </SettingsPage>
  );
}
