import { getTranslations } from 'next-intl/server';
import { RealtimeProvider } from '@/components/realtime';
import { Link, redirect } from '@/i18n/navigation';
import { SignOutButton, getPrincipal } from '@/modules/family';
import { GoogleReauthBanner } from '@/modules/google';

/** Session-dependent: never prerendered, so `next build` needs no secrets. */
export const dynamic = 'force-dynamic';

/**
 * Parent app shell — an account session is required (docs/architecture.md §2).
 * `src/proxy.ts` already turns cookie-less requests away; this layout is the
 * authoritative check, because a cookie is not a session.
 *
 * The principal must be a **member** since M12. A paired kiosk resolves to a
 * principal too, and it must not satisfy this tree: a wall tablet that reached
 * `/settings` would render the whole parent shell and then have the §7 matrix
 * refuse every control on it, which is worse than a redirect. A paired browser
 * is sent to the board instead — that is the surface it has.
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

  // A paired browser is a kiosk regardless of what other cookies it carries
  // (see `modules/family/principal.ts` on resolution order), so it goes to the
  // board rather than to a sign-in form it cannot escape.
  if (principal?.kind === 'device') redirect({ href: '/hub', locale });
  if (principal?.kind !== 'member') redirect({ href: '/sign-in', locale });
  // `redirect()` throws, but next-intl's wrapper is not typed `never`.
  if (!principal) return null;

  const t = await getTranslations('nav');

  return (
    // One stream for the parent app, the mirror of the hub tree's layout (§4).
    <RealtimeProvider>
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
            {/* M11: push opt-in has to be reachable by deliberate navigation —
                §6 step 1 forbids prompting on a page load. */}
            <Link
              href="/settings/notifications"
              className="px-2 py-1 font-display text-sm font-medium"
            >
              {t('notifications')}
            </Link>
            {/* M12: pairing a wall display has to be reachable without a
                deep link — a kiosk that cannot be paired is not a kiosk. */}
            <Link href="/settings/devices" className="px-2 py-1 font-display text-sm font-medium">
              {t('devices')}
            </Link>
          </nav>
          <SignOutButton />
        </header>
        {/* A Google account that needs re-linking has stopped syncing silently —
          the one failure a family cannot be expected to notice (§5). */}
        <GoogleReauthBanner principal={principal} />
        {children}
      </div>
    </RealtimeProvider>
  );
}
