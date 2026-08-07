import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { MobileNav } from '@/components/app-nav/mobile-nav';
import { ServiceWorkerRegistrar } from '@/components/offline';
import { RealtimeProvider } from '@/components/realtime';
import { Link, redirect } from '@/i18n/navigation';
import { SignOutButton, getFamily, getPrincipal } from '@/modules/family';
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

  // BLOCKING 2: the timezone that governs every date and time this tree
  // renders is per-*family*, not per-request-locale — `request.ts` can only
  // offer a static default (Europe/Amsterdam) for surfaces with no principal
  // yet. Once a member principal exists, this is the one place to resolve
  // the real zone and hand it down: a nested `NextIntlClientProvider` with no
  // `messages`/`locale` inherits both from the root provider automatically
  // (see `NextIntlClientProviderServer`), so only `timeZone` needs overriding
  // here. Every `useFormatter()` below this point — hub clock, event chips,
  // `/today` — now formats in the family's zone instead of the server's.
  const family = await getFamily(principal.familyId);
  const timeZone = family?.timezone ?? 'Europe/Amsterdam';

  return (
    // One stream for the parent app, the mirror of the hub tree's layout (§4).
    <NextIntlClientProvider timeZone={timeZone}>
      <RealtimeProvider>
        {/* B-1: the worker is registered here rather than in the root
          `[locale]` layout, because that layout also wraps `(share)` — a
          caregiver's browser must never install it at all. */}
        <ServiceWorkerRegistrar />
        <div className="flex min-h-dvh flex-col">
          {/* NB-6 (M13 carry-forward, fixed in M15): ten flat links overflow a
            390px phone viewport. `sm:flex` keeps this header for tablet and
            desktop; below `sm` it is replaced entirely by `MobileNav`'s fixed
            bottom bar, so the two never render at once. */}
          <header className="hidden items-center justify-between gap-4 border-b border-border px-4 py-2 sm:flex">
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
              {/* M16: the settings hub. Every household setting lives behind
                this one link now; the three deep links below it stay because
                each is a flow of its own and both nav shapes have pointed at
                them since M11–M13. */}
              <Link href="/settings" className="px-2 py-1 font-display text-sm font-medium">
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
              {/* M13: a caregiver link is minted here and — more importantly —
                revoked here. The one credential in this product with nobody's
                face attached to it needs a door a parent can find. */}
              <Link href="/settings/sharing" className="px-2 py-1 font-display text-sm font-medium">
                {t('sharing')}
              </Link>
            </nav>
            <SignOutButton />
          </header>
          {/* Mobile counterpart to the header above: no link list (that's
            `MobileNav`'s bottom bar), just sign-out so it stays reachable. */}
          <header className="flex items-center justify-end border-b border-border px-4 py-2 sm:hidden">
            <SignOutButton />
          </header>
          {/* A Google account that needs re-linking has stopped syncing silently —
          the one failure a family cannot be expected to notice (§5). */}
          <GoogleReauthBanner principal={principal} />
          {/* `pb-16` reserves room above the fixed mobile bottom nav so the last
            row of content is never occluded by it; the desktop header takes
            no fixed space, so nothing is reserved there. */}
          <div className="flex-1 pb-16 sm:pb-0">{children}</div>
        </div>
        <MobileNav
          labels={{
            today: t('today'),
            calendar: t('calendar'),
            routines: t('routines'),
            rewards: t('rewards'),
            settings: t('settings'),
            timers: t('timers'),
            family: t('family'),
            notifications: t('notifications'),
            devices: t('devices'),
            sharing: t('sharing'),
            more: t('more'),
            mainNavigation: t('mainNavigation'),
          }}
        />
      </RealtimeProvider>
    </NextIntlClientProvider>
  );
}
