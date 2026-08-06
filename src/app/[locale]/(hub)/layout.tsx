import { RealtimeProvider } from '@/components/realtime';

/**
 * The hub tree's only shared shell: one `EventSource` for the whole wall
 * display (docs/architecture.md §4).
 *
 * It renders no element of its own — the kiosk layout proper (fullscreen,
 * dark-capable, 6-foot type) is M12's, and adding a wrapper `div` here now
 * would change every hub visual snapshot for nothing. All this layout does is
 * put the stream above every hub page so the board, the timers and the star
 * chart share a single connection instead of opening one each.
 */
export default function HubLayout({ children }: { children: React.ReactNode }) {
  return <RealtimeProvider>{children}</RealtimeProvider>;
}
