import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { DARK_FROM_HOUR, DARK_UNTIL_HOUR, HUB_THEME_STORAGE_KEY } from '@/components/hub';
import { BrandMark } from '@/components/brand';
import { AppShell, type NavRailItem } from '@/components/shell/app-shell';
import { FormattingLocaleProvider } from '@/components/formatting';
import { HubReloadController, ServiceWorkerRegistrar } from '@/components/offline';
import { RealtimeProvider } from '@/components/realtime';
import { FabSlot } from '@/components/ui/fab';
import { defaultFormattingLocale } from '@/i18n/formatting-locale';
import { routing } from '@/i18n/routing';
import { getFamily, getPrincipal } from '@/modules/family';
import { getDevice } from '@/modules/devices';
import {
  ChimeSettingsPanel,
  RailTimerTile,
  TimerActivityProvider,
  loadTimerBoard,
} from '@/modules/timers';

/**
 * The kiosk layout (M12) — the `(hub)` tree's own shell, no longer the app's.
 *
 * **Addressing.** The hub lives at `/hub/*`, not at the locale root, and M12
 * settles that deliberately rather than by inertia. `docs/architecture.md` §2
 * draws `(hub)/` with `page.tsx` at the group root, but a route group does not
 * consume a URL segment, so `(hub)/page.tsx` and `(app)/today/page.tsx` would
 * both want `/[locale]` and Next.js refuses the tree outright.
 *
 * **Auth is not here.** Each hub page opens with `requireDevicePrincipal()`
 * instead, and that is not duplication — Next.js layouts do not re-render on
 * client-side navigation, so a gate in a layout is a gate that runs once per
 * full page load and never again. The layout resolves the principal only to
 * decide *which shell to draw*: the pair screen legitimately has no device, and
 * a shell that showed a clock and a settings button on it would be lying.
 */
export const dynamic = 'force-dynamic';

/**
 * The pre-paint script, built from the same constants `hub-theme.ts` exports so
 * the first frame and every frame after it cannot disagree about when "auto"
 * means dark. It mirrors `resolveHubTheme()` exactly: an explicit pin wins, a
 * device that states a preference wins over the clock, and only a device that
 * states none falls back to the hour.
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

export const metadata: Metadata = {
  title: 'Kynite Hub',
  manifest: '/hub.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Kynite Hub' },
};

export default async function HubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const principal = await getPrincipal();
  const paired =
    principal?.kind === 'device' ? await getDevice(principal.familyId, principal.deviceId) : null;

  // BLOCKING 2: same rule as `(app)/layout.tsx` — the wall clock and every
  // event chip on the board must read in the family's zone, not the server's.
  const family = principal?.kind === 'device' ? await getFamily(principal.familyId) : null;
  const timeZone = family?.timezone ?? 'Europe/Amsterdam';

  // M-T2: the rail's timer tile and `IdleReturn`'s "don't bounce off
  // `/hub/timer`" exemption both need to know what is running, so it is read
  // once here. `loadTimerBoard()` takes no `now`: unlike a page, a layout is
  // never handed `searchParams`. `RailTimerTile` reads the pin itself,
  // client-side, rather than the layout faking one it was never handed.
  const timers = principal?.kind === 'device' ? await loadTimerBoard() : null;
  // The household's date/time convention (`src/i18n/formatting-locale.ts`).
  const uiLocale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const formattingLocale = family?.formattingLocale ?? defaultFormattingLocale(uiLocale);

  // The rail's destinations, as data — the device's five tiles (M-R1).
  const tNav = await getTranslations('hub.nav');
  const railItems: NavRailItem[] = [
    { key: 'vandaag', href: '/hub', icon: 'calendar_month', label: tNav('vandaag'), exact: true },
    { key: 'kalender', href: '/hub/kalender', icon: 'view_column', label: tNav('kalender') },
    { key: 'routines', href: '/hub/routines', icon: 'restart_alt', label: tNav('routines') },
    { key: 'taken', href: '/hub/taken', icon: 'checklist', label: tNav('taken') },
    { key: 'sterren', href: '/hub/store', icon: 'bar_chart', label: tNav('sterren') },
  ];

  return (
    // One stream for the whole wall display (§4): the board, the timers and the
    // star chart share a connection instead of opening one each.
    <NextIntlClientProvider timeZone={timeZone}>
      <FormattingLocaleProvider formattingLocale={formattingLocale}>
        <RealtimeProvider>
          {/* The 6-foot scale and the theme are applied before first paint, not in
          an effect. `useHubTheme` takes over from here; this only has to be
          right for the first frame. */}
          <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_THEME }} />
          {/* B-1: registered per-surface now, not from the root `[locale]`
          layout — see `(app)/layout.tsx` for why. */}
          <ServiceWorkerRegistrar />
          <HubReloadController />
          {/* `TimerActivityProvider` wraps the whole shell — `IdleReturn` sits
          several client layers below it, and its context crosses that for free. */}
          <TimerActivityProvider initial={timers}>
            {/* The one shell (D9), in kiosk mode. Kiosk-only behaviour is either
            mounted here (the watchers, wake lock, theme live in the shell's
            kiosk frame) or handed in as slots (`chimeSettings`, `railTimerTile`,
            `brand`, the FAB) — never decided by the shell itself. */}
            <AppShell
              surface="hub"
              kiosk
              device={paired ? { id: paired.id, name: paired.name } : null}
              railItems={railItems}
              railNavLabel={tNav('label')}
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
