import { getTranslations } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { getPrincipal } from '@/modules/family';

/** Session-dependent: never prerendered, so `next build` needs no database. */
export const dynamic = 'force-dynamic';

/**
 * `/{locale}` — the marketing landing page, and the redirect target of
 * BLOCKING 2's self-unpair (`HubSettings`'s "This is not a wall display").
 *
 * A signed-in parent lands here too, briefly, whenever something redirects to
 * the bare locale root rather than to a specific screen — self-unpair is the
 * first caller. Without the check below they would see the M01 scaffold
 * landing page instead of their own family, which defeats the whole point of
 * "member session, if present, takes over": a device cookie clearing is not a
 * sign-out, and an account session that is still valid should not dead-end
 * on a page for people who do not have one yet.
 */
export default async function MarketingHomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const principal = await getPrincipal();

  if (principal?.kind === 'member') redirect({ href: '/today', locale });

  const t = await getTranslations('common');

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-3xl font-semibold">{t('appName')}</h1>
      <p className="text-sm opacity-70">{t('tagline')}</p>
    </main>
  );
}
