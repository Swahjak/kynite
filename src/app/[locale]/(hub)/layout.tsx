import type { Metadata } from 'next';
import {
  DARK_FROM_HOUR,
  DARK_UNTIL_HOUR,
  HUB_THEME_STORAGE_KEY,
  KioskShell,
} from '@/components/hub';
import { HubReloadController } from '@/components/offline';
import { RealtimeProvider } from '@/components/realtime';
import { getPrincipal } from '@/modules/family';
import { getDevice } from '@/modules/devices';
import { ChimeSettingsPanel } from '@/modules/timers';

/**
 * The kiosk layout (M12) — the `(hub)` tree's own shell, no longer the app's.
 *
 * **Addressing.** The hub lives at `/hub/*`, not at the locale root, and M12
 * settles that deliberately rather than by inertia. `docs/architecture.md` §2
 * draws `(hub)/` with `page.tsx` at the group root, but a route group does not
 * consume a URL segment, so `(hub)/page.tsx` and `(app)/today/page.tsx` would
 * both want `/[locale]` and Next.js refuses the tree outright. `/hub/*` is also
 * what §7 itself writes ("`/hub/pair` exchanges it for a device session"), what
 * `public/hub.webmanifest` scopes an installed kiosk to, and what the service
 * worker's `isHubUrl()` matches to pick the hub caching strategy (§6). Three
 * things already depend on the prefix; the diagram is the odd one out. What M12
 * *does* fix is the part that mattered: this group now has a real layout of its
 * own instead of inheriting the parent app's.
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
r.dataset.surface='hub';
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
  // `params` is awaited (and unused) so the segment stays dynamic under Next
  // 16's async params — the shell must never be prerendered into the static
  // shell with one family's device name baked in.
  await params;

  const principal = await getPrincipal();
  const paired =
    principal?.kind === 'device' ? await getDevice(principal.familyId, principal.deviceId) : null;

  return (
    // One stream for the whole wall display (§4): the board, the timers and the
    // star chart share a connection instead of opening one each.
    <RealtimeProvider>
      {/* The 6-foot scale and the theme are applied before first paint, not in
          an effect. Both hang off the *document* element (globals.css keys the
          kiosk type scale on `[data-surface='hub']`, and the design system's
          dark variant on `.dark`), and a wall display that painted the parent
          app's 16px scale and then reflowed to 22px on hydration would flash
          the wrong layout across the room on every boot and every service
          worker reload. `useHubTheme` takes over from here and keeps both in
          sync; this only has to be right for the first frame, so it reads the
          same localStorage key and the same media query and nothing else. */}
      <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_THEME }} />
      <HubReloadController />
      {/* The chime control is rendered here, not inside the shell: the shell is
          a client component and `@/modules/timers` carries `server-only`
          queries (see `chime-settings-panel.tsx`). A server component may
          import the barrel, so the slice's own boundary stays intact. */}
      <KioskShell
        device={paired ? { id: paired.id, name: paired.name } : null}
        chimeSettings={<ChimeSettingsPanel />}
      >
        {children}
      </KioskShell>
    </RealtimeProvider>
  );
}
