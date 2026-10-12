import type { Metadata } from 'next';
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
import { BrandMark } from '@/components/brand';
import { AppShell, type NavRailItem } from '@/components/shell/app-shell';
import { FormattingLocaleProvider } from '@/components/formatting';
import { DARK_FROM_HOUR, DARK_UNTIL_HOUR, HUB_THEME_STORAGE_KEY } from '@/components/hub';
import { HubReloadController, ServiceWorkerRegistrar } from '@/components/offline';
import { RealtimeProvider } from '@/components/realtime';
import { FabSlot } from '@/components/ui/fab';
import { Toaster } from '@/components/ui/toast';
import { defaultFormattingLocale } from '@/i18n/formatting-locale';
import { routing } from '@/i18n/routing';
import { getDevice } from '@/modules/devices';
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
import {
  ChimeSettingsPanel,
  RailTimerTile,
  TimerActivityProvider,
  loadTimerBoard,
} from '@/modules/timers';

/** Session-dependent: never prerendered, so `next build` needs no secrets. */
export const dynamic = 'force-dynamic';

/**
 * H3 PWA identity (review fix): the one tree serves two installable surfaces
 * sharing one service worker, and a static `metadata` object cannot branch. A
 * paired device keeps the hub manifest and title; a member keeps the parent
 * app's. `getPrincipal` is `React.cache`-memoised, so this costs nothing the
 * layout body does not already pay. The pair screen (no principal) is a kiosk
 * surface, so it falls into the hub branch — exactly as the old
 * `(hub)/layout.tsx` static metadata gave it.
 */
export async function generateMetadata(): Promise<Metadata> {
  const principal = await getPrincipal();
  if (principal?.kind === 'member') {
    return {
      title: 'Kynite',
      manifest: '/manifest.webmanifest',
      appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Kynite' },
    };
  }
  return {
    title: 'Kynite Hub',
    manifest: '/hub.webmanifest',
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Kynite Hub' },
  };
}

/**
 * The one route tree (H3) — a member and a paired device render the same
 * pages, and the principal decides the controls. This layout draws the shell
 * for either: the member frame (surface `app`/`desktop`) or the kiosk frame
 * (device, or the pair screen with no principal at all).
 *
 * **Auth is not here.** Each `(main)` page opens with `requireMemberOrDevice()`
 * instead, and that is not duplication — Next.js layouts do not re-render on
 * client-side navigation, so a gate in a layout runs once per full page load
 * and never again. The layout resolves the principal only to decide *which
 * shell to draw*: the pair screen legitimately has no principal, and a shell
 * that showed a rail on it would be lying.
 */
const PRE_PAINT_THEME = `(function(){try{
var r=document.documentElement;
var m=localStorage.getItem(${JSON.stringify(HUB_THEME_STORAGE_KEY)})||'auto';
var h=new Date().getHours();
var clock=h>=${DARK_FROM_HOUR}||h<${DARK_UNTIL_HOUR};
var none=window.matchMedia('(prefers-color-scheme: no-preference)').matches;
var d=m==='dark'||(m==='auto'&&(none?clock:window.matchMedia('(prefers-color-scheme: dark)').matches));
r.classList.toggle('dark',d);
r.dataset.hubTheme=d?'dark':'light';
}catch(e){}})()`;

export default async function MainLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const principal = await getPrincipal();
  const surface = await getSurface();

  const paired =
    principal?.kind === 'device' ? await getDevice(principal.familyId, principal.deviceId) : null;

  // BLOCKING 2: the timezone that governs every date and time this tree renders
  // is per-*family*, not per-request-locale. Once a principal exists, this is
  // the one place to resolve the real zone and hand it down.
  const family = principal ? await getFamily(principal.familyId) : null;
  const timeZone = family?.timezone ?? 'Europe/Amsterdam';
  const uiLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const formattingLocale = family?.formattingLocale ?? defaultFormattingLocale(uiLocale);

  const t = await getTranslations('nav');
  const tCommon = await getTranslations('common');

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

  const toRailItem = (item: NavItem): NavRailItem => ({
    key: item.label,
    href: item.href,
    icon: item.icon,
    label: labels[item.label],
  });

  // A member renders the member frame: the same destinations on a rail or a
  // bottom bar, resolved by `surface`, plus the account tile and the Google
  // re-auth banner.
  if (principal?.kind === 'member') {
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

    const userLabels: UserMenuLabels = {
      account: t('account'),
      settings: (await getTranslations('account'))('title'),
      signOut: (await getTranslations('auth'))('signOut'),
    };

    // Beheer (`/manage`) is member-only and, of the member roles, only a parent
    // may manage anything on it — `routine:write` is the least-privileged of the
    // owner/adult capabilities and stands in for "may manage" (D16). The kiosk
    // branch below never reaches this and never renders either list.
    const canManage = can(principal, 'routine:write', { familyId: principal.familyId });

    return (
      <NextIntlClientProvider timeZone={timeZone}>
        <FormattingLocaleProvider formattingLocale={formattingLocale}>
          <RealtimeProvider>
            {/* M18: mounted once for the whole member surface; deliberately
            absent from the kiosk branch. */}
            <Toaster>
              {/* B-1: the worker is registered here rather than in the root
              `[locale]` layout, because that layout also wraps `(share)` — a
              caregiver's browser must never install it at all. */}
              <ServiceWorkerRegistrar />
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

  // Kiosk branch: a device, or the pair screen (no principal). The pre-paint
  // theme script, the watchers and the timer/chime slots are all kiosk-only;
  // the pair screen shows only a brand header, no rail.
  const timers = principal?.kind === 'device' ? await loadTimerBoard() : null;

  return (
    <NextIntlClientProvider timeZone={timeZone}>
      <FormattingLocaleProvider formattingLocale={formattingLocale}>
        <RealtimeProvider>
          {/* The 6-foot scale and the theme are applied before first paint, not
          in an effect. `useHubTheme` takes over from here; this only has to be
          right for the first frame. */}
          <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_THEME }} />
          <ServiceWorkerRegistrar />
          <HubReloadController />
          {/* `TimerActivityProvider` wraps the whole shell — `IdleReturn` sits
          several client layers below it, and its context crosses that for free. */}
          <TimerActivityProvider initial={timers}>
            <AppShell
              surface="hub"
              kiosk
              device={paired ? { id: paired.id, name: paired.name } : null}
              railItems={RAIL_NAV.map(toRailItem)}
              railNavLabel={labels.mainNavigation}
              railTestId="hub-rail"
              railTimerTile={timers ? <RailTimerTile initial={timers} /> : null}
              chimeSettings={<ChimeSettingsPanel />}
              brand={<BrandMark variant="icon" className="h-7" />}
              fab={paired ? <FabSlot /> : null}
            >
              {children}
            </AppShell>
          </TimerActivityProvider>
        </RealtimeProvider>
      </FormattingLocaleProvider>
    </NextIntlClientProvider>
  );
}
