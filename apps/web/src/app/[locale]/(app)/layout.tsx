import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { AppRail } from '@/components/app-nav/app-rail';
import { MobileNav } from '@/components/app-nav/mobile-nav';
import type { NavLabels } from '@/components/app-nav/nav-items';
import type { UserMenuLabels, UserMenuUser } from '@/components/app-nav/user-menu';
import { FormattingLocaleProvider } from '@/components/formatting';
import { ServiceWorkerRegistrar } from '@/components/offline';
import { RealtimeProvider } from '@/components/realtime';
import { FabSlot } from '@/components/ui/fab';
import { Toaster } from '@/components/ui/toast';
import { redirect } from '@/i18n/navigation';
import { defaultFormattingLocale } from '@/i18n/formatting-locale';
import { routing } from '@/i18n/routing';
import { MemberAvatar, getFamily, getMember, getPrincipal, signOutAction } from '@/modules/family';
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
  // `redirect()` throws, but next-intl's wrapper is not typed `never`, so the
  // narrowing has to be restated for the compiler. Unreachable at runtime.
  if (principal?.kind !== 'member') return null;

  const t = await getTranslations('nav');
  const tCommon = await getTranslations('common');

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
  // The household's date/time convention (`src/i18n/formatting-locale.ts`) — a
  // second, next-intl-independent context, not a `NextIntlClientProvider`
  // override: see `FormattingLocaleProvider`'s doc comment for why reusing
  // `locale` here would break every `Link` this tree renders (`AppRail`,
  // `MobileNav`, ...).
  const uiLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const formattingLocale = family?.formattingLocale ?? defaultFormattingLocale(uiLocale);

  // The signed-in member's face. M21 moved it from the (now deleted) glass
  // header to the foot of the nav, where it also carries the sign-out. A member
  // row that has gone missing is not an error here — the shell simply renders
  // no account tile, exactly as the header degraded before.
  const me = await getMember(principal.familyId, principal.memberId);
  const user: UserMenuUser | undefined = me
    ? {
        name: me.displayName,
        avatar: (
          <MemberAvatar
            displayName={me.displayName}
            avatarUrl={me.avatarUrl}
            color={me.color}
            size="default"
            className="ring-2 ring-primary/20"
          />
        ),
      }
    : undefined;

  const labels: NavLabels = {
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
    appName: tCommon('appName'),
  };

  const userLabels: UserMenuLabels = {
    account: t('account'),
    signOut: (await getTranslations('auth'))('signOut'),
  };

  return (
    // One stream for the parent app, the mirror of the hub tree's layout (§4).
    <NextIntlClientProvider timeZone={timeZone}>
      <FormattingLocaleProvider formattingLocale={formattingLocale}>
        <RealtimeProvider>
          {/* M18: mounted once for the whole parent surface; deliberately absent
          from the hub and share trees. */}
          <Toaster>
            {/* B-1: the worker is registered here rather than in the root
          `[locale]` layout, because that layout also wraps `(share)` — a
          caregiver's browser must never install it at all. */}
            <ServiceWorkerRegistrar />
            {/* M19: the shell is the stitch shell — an 80px icon rail on tablet and
          desktop, a bottom tab bar on phones and a FAB
          slot pages can fill. It replaces the flat row of ten text links this
          layout used to be (docs/rebuild-design-gaps.md §2). Every one of those
          ten destinations is still reachable: six on the rail, four behind the
          "More" sheet both nav shapes open. `sm:pl-20` clears the fixed rail. */}
            <AppRail labels={labels} user={user} userLabels={userLabels} signOut={signOutAction} />
            {/* M21: no header. It carried a clock, the calendar's view pill, the
          avatar and a bare sign-out button, and cost 80px of every page for
          them. The avatar and its sign-out moved into the nav (`user-menu.tsx`),
          the pill went back to the calendar page that owns it, and the clock —
          decorative in a surface that is held in the hand, unlike the wall
          tablet's — was dropped. `pt-safe` moves with it, so a notched phone
          still keeps its first row of content out from under the status bar. */}
            <div className="pt-safe flex min-h-dvh flex-col sm:pl-20">
              {/* A Google account that needs re-linking has stopped syncing silently —
          the one failure a family cannot be expected to notice (§5). */}
              <GoogleReauthBanner principal={principal} />
              {/* `pb-24` reserves room above the fixed mobile bottom bar so the last
            row of content is never occluded by it; the rail is fixed too and
            takes no space out of the flow, so nothing is reserved for it. */}
              <div className="flex-1 pb-24 sm:pb-0">{children}</div>
            </div>
            <MobileNav
              labels={labels}
              user={user}
              userLabels={userLabels}
              signOut={signOutAction}
            />
            <FabSlot />
          </Toaster>
        </RealtimeProvider>
      </FormattingLocaleProvider>
    </NextIntlClientProvider>
  );
}
