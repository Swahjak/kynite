import { getTranslations } from 'next-intl/server';
import { Link, redirect } from '@/i18n/navigation';
import { SignOutButton, getPrincipal } from '@/modules/family';
import { GoogleReauthBanner } from '@/modules/google';

/** Session-dependent: never prerendered, so `next build` needs no secrets. */
export const dynamic = 'force-dynamic';

/**
 * Parent app shell — an account session is required (docs/architecture.md §2).
 * `src/proxy.ts` already turns cookie-less requests away; this layout is the
 * authoritative check, because a cookie is not a session.
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const principal = await getPrincipal();

  if (!principal) redirect({ href: '/sign-in', locale });
  // `redirect()` throws, but next-intl's wrapper is not typed `never`.
  if (!principal) return null;

  const t = await getTranslations('nav');

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-2">
        <nav className="flex items-center gap-2">
          <Link href="/today" className="px-2 py-1 font-display text-sm font-medium">
            {t('today')}
          </Link>
          <Link href="/calendar" className="px-2 py-1 font-display text-sm font-medium">
            {t('calendar')}
          </Link>
          <Link href="/routines" className="px-2 py-1 font-display text-sm font-medium">
            {t('routines')}
          </Link>
          <Link href="/rewards" className="px-2 py-1 font-display text-sm font-medium">
            {t('rewards')}
          </Link>
          <Link href="/timers" className="px-2 py-1 font-display text-sm font-medium">
            {t('timers')}
          </Link>
          <Link href="/family" className="px-2 py-1 font-display text-sm font-medium">
            {t('family')}
          </Link>
          <Link href="/settings/google" className="px-2 py-1 font-display text-sm font-medium">
            {t('settings')}
          </Link>
        </nav>
        <SignOutButton />
      </header>
      {/* A Google account that needs re-linking has stopped syncing silently —
          the one failure a family cannot be expected to notice (§5). */}
      <GoogleReauthBanner principal={principal} />
      {children}
    </div>
  );
}
