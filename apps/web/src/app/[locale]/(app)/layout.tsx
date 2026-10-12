import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import {
  OVERFLOW_NAV,
  PRIMARY_NAV,
  RAIL_FOOTER_NAV,
  RAIL_NAV,
  withoutManage,
  type NavItem,
  type NavLabels,
} from '@/components/app-nav/nav-items';
import type { UserMenuLabels, UserMenuUser } from '@/components/app-nav/user-menu';
import { AppShell, type NavRailItem } from '@/components/shell/app-shell';
import { FormattingLocaleProvider } from '@/components/formatting';
import { ServiceWorkerRegistrar } from '@/components/offline';
import { RealtimeProvider } from '@/components/realtime';
import { FabSlot } from '@/components/ui/fab';
import { Toaster } from '@/components/ui/toast';
import { redirect } from '@/i18n/navigation';
import { defaultFormattingLocale } from '@/i18n/formatting-locale';
import { routing } from '@/i18n/routing';
import {
  MemberAvatar,
  can,
  getFamily,
  getMember,
  getPrincipal,
  signOutAction,
} from '@/modules/family';
import { GoogleReauthBanner } from '@/modules/google';
import { getSurface } from '@/modules/surface';

/** Session-dependent: never prerendered, so `next build` needs no secrets. */
export const dynamic = 'force-dynamic';

/**
 * Parent app shell — an account session is required (docs/architecture.md §2).
 * `src/proxy.ts` already turns cookie-less requests away; this layout is the
 * authoritative check, because a cookie is not a session.
 *
 * The principal must be a **member** since M12. A paired kiosk resolves to a
 * principal too, and it must not satisfy this tree: a wall tablet that reached
 * `/manage` would render the whole parent shell and then have the §7 matrix
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
  if (principal?.kind === 'device') redirect({ href: '/today', locale });
  if (principal?.kind !== 'member') redirect({ href: '/sign-in', locale });
  // `redirect()` throws, but next-intl's wrapper is not typed `never`, so the
  // narrowing has to be restated for the compiler. Unreachable at runtime.
  if (principal?.kind !== 'member') return null;

  // H2: which surface this member renders as — `app` (phone) or `desktop`
  // (rail). A device principal never reaches this tree (redirected above), so
  // the resolver can only return `app`/`desktop` here.
  const surface = await getSurface();

  const t = await getTranslations('nav');
  const tCommon = await getTranslations('common');

  // BLOCKING 2: the timezone that governs every date and time this tree
  // renders is per-*family*, not per-request-locale — `request.ts` can only
  // offer a static default (Europe/Amsterdam) for surfaces with no principal
  // yet. Once a member principal exists, this is the one place to resolve
  // the real zone and hand it down.
  const family = await getFamily(principal.familyId);
  const timeZone = family?.timezone ?? 'Europe/Amsterdam';
  // The household's date/time convention (`src/i18n/formatting-locale.ts`) — a
  // second, next-intl-independent context, not a `NextIntlClientProvider`
  // override.
  const uiLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const formattingLocale = family?.formattingLocale ?? defaultFormattingLocale(uiLocale);

  // The signed-in member's face, at the foot of the nav, where it also carries
  // the sign-out. A member row that has gone missing is not an error here — the
  // shell simply renders no account tile.
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
    tasks: t('tasks'),
    stars: t('stars'),
    routines: t('routines'),
    activeRoutines: t('activeRoutines'),
    rewards: t('rewards'),
    settings: t('settings'),
    timers: t('timers'),
    family: t('family'),
    notifications: t('notifications'),
    devices: t('devices'),
    sharing: t('sharing'),
    manage: t('manage'),
    more: t('more'),
    mainNavigation: t('mainNavigation'),
    appName: tCommon('appName'),
  };

  // Beheer (`/manage`) is member-only and, of the member roles, only a parent
  // may manage anything on it — `routine:write` is the least-privileged of the
  // owner/adult capabilities and stands in for "may manage" (D16).
  const canManage = can(principal, 'routine:write', { familyId: principal.familyId });

  const userLabels: UserMenuLabels = {
    account: t('account'),
    settings: (await getTranslations('account'))('title'),
    signOut: (await getTranslations('auth'))('signOut'),
  };

  const toRailItem = (item: NavItem): NavRailItem => ({
    key: item.label,
    href: item.href,
    icon: item.icon,
    label: labels[item.label],
  });

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
            {/* The one shell (D9). Navigation is chosen by `surface` inside; the
            destinations, labels and member-only slots are all handed in here. */}
            <AppShell
              surface={surface}
              railItems={RAIL_NAV.map(toRailItem)}
              railFooterItems={(canManage ? RAIL_FOOTER_NAV : withoutManage(RAIL_FOOTER_NAV)).map(
                toRailItem
              )}
              railNavLabel={labels.mainNavigation}
              railTestId="app-rail"
              railBrandHref="/today"
              railBrandLabel={labels.appName}
              member={{
                labels,
                primary: PRIMARY_NAV,
                overflow: canManage ? OVERFLOW_NAV : withoutManage(OVERFLOW_NAV),
                user,
                userLabels,
                signOut: signOutAction,
              }}
              banner={<GoogleReauthBanner principal={principal} />}
              fab={<FabSlot />}
            >
              {children}
            </AppShell>
          </Toaster>
        </RealtimeProvider>
      </FormattingLocaleProvider>
    </NextIntlClientProvider>
  );
}
