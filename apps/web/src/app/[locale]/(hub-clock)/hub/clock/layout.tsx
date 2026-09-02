import type { Metadata } from 'next';

/**
 * `/hub/clock` — the wall tablet's ambient screensaver face.
 *
 * Fully Kiosk Browser is configured to load this URL as its screensaver
 * (kicks in on idle, closes on the first touch or motion event — Fully's own
 * job, not this app's). It is a route group of its own, sibling to `(hub)`,
 * rather than a page inside it, because `KioskShell` — the `(hub)` tree's
 * layout — is unconditionally wrong here:
 *
 *  - **`IdleReturn`** navigates back to `/hub` after a period of inactivity.
 *    On the screensaver itself that would be fatal: it exists *because* the
 *    tablet went idle, so the shell would fight Fully for the same screen and
 *    the wall would flicker between the board and the clock forever.
 *  - **`HubRail`** and **`HubSettings`** are chrome a family taps; a
 *    screensaver is looked at, never touched (Fully closes it on the first
 *    touch itself), so both would be pure decoration at best and an accidental
 *    escape hatch out of ambient mode at worst.
 *
 * What it keeps from `(hub)`: the same device-principal gate
 * (`requireHubDevice`, called in `page.tsx` for the reason its own doc
 * comment gives — an auth boundary belongs on the segment that actually
 * re-renders), and the same household `timeZone`/`formattingLocale` context
 * the board reads (`page.tsx` resolves and provides both directly — there is
 * exactly one page in this tree, so a second provider layer here would only
 * be indirection).
 *
 * Always dark, unconditionally — no `useHubTheme`, no light face. This is
 * ambient mode, not a screen still doing dashboard work at 6-foot scale; a
 * bright board across a dark kitchen defeats the point of a screensaver.
 */
export const dynamic = 'force-dynamic';

/**
 * The pre-paint script for the ambient clock — always dark, unconditionally.
 * It sets `data-surface='hub'` to apply the 6-foot type scale (keyed in
 * globals.css on `[data-surface='hub']`) and adds the `dark` class before the
 * first frame paints, preventing a flash of incorrect sizing or colors on boot.
 */
const PRE_PAINT_CLOCK = `(function(){try{
var r=document.documentElement;
r.dataset.surface='hub';
r.classList.add('dark');
}catch(e){}})()`;

export const metadata: Metadata = {
  title: 'Kynite Hub',
  manifest: '/hub.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Kynite Hub' },
};

export default function HubClockLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: PRE_PAINT_CLOCK }} />
      <div className="h-dvh w-dvw overflow-hidden bg-surface-night [@media(pointer:coarse)]:cursor-none">
        {children}
      </div>
    </>
  );
}
