import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PageHeader } from '@kynite/ui';
import { OAuthConsentForm, loadOAuthConsentPage, scopeMessageKey } from '@/modules/oauth-consent';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * M-C: the MCP/OAuth-provider consent screen. `mcp()`'s `consentPage` option
 * (`src/server/auth.ts`) points here — better-auth's `/oauth2/authorize` flow
 * redirects an authenticated member with a consented client past this page
 * straight to the redirect_uri, and otherwise lands here with `client_id`,
 * `scope` (and, for an OIDC claims request, `claims`) in the query string.
 *
 * The layout guard (`(app)/layout.tsx`) already requires a member session;
 * `loadOAuthConsentPage` returning `null` covers everything else that makes
 * this page unshowable (missing/unknown/disabled client) with the same
 * `notFound()` — see its own doc comment for why those are not distinguished.
 */
export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const data = await loadOAuthConsentPage(query);
  if (!data) notFound();

  const t = await getTranslations('oauth');

  const scopeLabels = data.scopes.map((scope) => {
    const key = scopeMessageKey(scope);
    return key ? t(`scopes.${key}`) : t('unknownScope', { scope });
  });

  return (
    <main
      className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 p-4 sm:p-6"
      data-testid="oauth-consent-page"
    >
      <PageHeader
        icon="lock"
        iconTint="brand-container"
        title={t('pageTitle')}
        subtitle={t('pageSubtitle', { client: data.client.name ?? t('unknownClient') })}
      />

      <OAuthConsentForm
        scopesHeading={t('scopesHeading')}
        scopeLabels={scopeLabels}
        approveLabel={t('approve')}
        denyLabel={t('deny')}
        footer={t('footer')}
        oauthQuery={data.oauthQuery}
      />
    </main>
  );
}
