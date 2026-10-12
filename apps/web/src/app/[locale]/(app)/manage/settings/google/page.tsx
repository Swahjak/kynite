import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  SettingsBackLink,
  SettingsPage,
  SettingsPageHeader,
} from '@/components/settings/settings-shell';
import { canOwn, getPrincipal } from '@/modules/family';
import { GoogleAccountsPanel, listLinkedAccounts, missingGoogleConfig } from '@/modules/google';

/** Session- and env-dependent: never prerendered (`next build` needs no secrets). */
export const dynamic = 'force-dynamic';

/**
 * Google linking surface (milestone M05, minimal — full settings is M16).
 * The OAuth start/callback routes behind it are real and functional.
 */
export default async function GoogleSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const principal = await getPrincipal();
  // The layout guard redirects unauthenticated requests; this is belt-and-braces.
  if (!principal) notFound();

  // Read-path gate: `listLinkedAccounts` returns linked Google emails and
  // calendars for the whole family, which a caregiver/viewer principal (a
  // real login, not just a share link) has no capability to see. Same
  // `google:link` chokepoint the mutating actions in `./actions.ts` use, via
  // the same `canOwn` helper `GoogleReauthBanner` uses, so the two agree.
  if (!canOwn(principal, 'google:link')) notFound();

  const [params, accounts, t, tSettings] = await Promise.all([
    searchParams,
    listLinkedAccounts(principal.familyId),
    getTranslations('google'),
    getTranslations('settings'),
  ]);

  const single = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  return (
    <SettingsPage>
      <SettingsBackLink label={tSettings('back')} />
      <SettingsPageHeader icon="calendar_month" title={t('title')} description={t('subtitle')} />

      <GoogleAccountsPanel
        accounts={accounts}
        missingConfig={missingGoogleConfig()}
        error={single(params.error)}
        linkedEmail={single(params.linked)}
      />
    </SettingsPage>
  );
}
