import type { Metadata } from 'next';
import { HubReloadController } from '@/components/offline';
import { RealtimeProvider } from '@/components/realtime';

/**
 * The hub tree's only shared shell: one `EventSource` for the whole wall
 * display (docs/architecture.md §4), and the kiosk's own PWA identity (§6).
 *
 * It renders no element of its own — the kiosk layout proper (fullscreen,
 * dark-capable, 6-foot type) is M12's, and adding a wrapper `div` here now
 * would change every hub visual snapshot for nothing. All this layout does is
 * put the stream above every hub page so the board, the timers and the star
 * chart share a single connection instead of opening one each, and mount the
 * reload gate so a deploy never blanks the board mid-routine.
 *
 * `manifest` overrides the root layout's: installing the hub must produce a
 * fullscreen app that launches at the board, not a second copy of the parent
 * app (§6: "Two installable surfaces with different needs").
 */
export const metadata: Metadata = {
  title: 'Kynite Hub',
  manifest: '/hub.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Kynite Hub' },
};

export default function HubLayout({ children }: { children: React.ReactNode }) {
  return (
    <RealtimeProvider>
      <HubReloadController />
      {children}
    </RealtimeProvider>
  );
}
