import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
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

  const [params, accounts, t] = await Promise.all([
    searchParams,
    listLinkedAccounts(principal.familyId),
    getTranslations('google'),
  ]);

  const single = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <GoogleAccountsPanel
        accounts={accounts}
        missingConfig={missingGoogleConfig()}
        error={single(params.error)}
        linkedEmail={single(params.linked)}
      />
    </main>
  );
}
