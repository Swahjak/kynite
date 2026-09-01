'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { OfflineIndicator } from '@/components/offline';
import { DeviceSessionWatcher } from './device-session-watcher';
import { FullyLauncherButton } from './fully-launcher-button';
import { HubRail } from './hub-rail';
import { HubSettings } from './hub-settings';
import { IdleReturn } from './idle-return';
import { SettingsWatcher } from './settings-watcher';
import type { ResolvedHubTheme } from './hub-theme';
import { useHubTheme } from './use-hub-theme';

/**
 * The kiosk shell (M12) — the `(hub)` tree's own layout, at last.
 *
 * Before M12 the hub had no shell of its own and inherited whatever the page
 * gave it; the M06 review flagged that it "reuses the app shell", light-theme
 * only. This is the replacement, and it is deliberately almost nothing:
 *
 *  - **fullscreen, no chrome.** `h-dvh overflow-hidden`. There is no sign-out
 *    and no back button — a wall tablet in `display: fullscreen`
 *    (public/hub.webmanifest) has no browser UI to fall back on, so anything
 *    not drawn here does not exist. M19 adds the one exception that sentence
 *    always implied: three destinations in a left rail (`HubRail`), because
 *    "not reachable by URL" was making the store, the timers and every
 *    child's routines unreachable *at all*. A paired hub has no header strip
 *    either (M20) — the rail carries the brand, the offline indicator and
 *    settings now sit in the rail's own footer, and the device name was
 *    dropped outright (nobody standing at the wall needs to be told which
 *    wall they are standing at). The header survives only for the pair
 *    screen, which has no rail to carry the brand for it.
 *  - **it comes home by itself.** `IdleReturn` — a hub left on one child's
 *    screen returns to the board rather than showing the household one
 *    person's steps all evening.
 *  - **6-foot type.** Applied by `useHubTheme` as `data-surface="hub"` on the
 *    document element, which re-points the whole Tailwind type scale
 *    (globals.css). Nothing below has to know.
 *  - **dark-capable.** Same hook; see `hub-theme.ts` for why `auto` is the
 *    default and why the clock is the fallback.
 *  - **cursor hidden.** A kiosk is touched, not pointed at, and a stranded
 *    arrow in the middle of the board is the tell that gives away that a wall
 *    display is "just a browser". Restored for anything with a real pointer,
 *    so a developer on a laptop is not fighting an invisible mouse.
 *
 * There is deliberately **no clock here**. Each hub surface draws its own, from
 * the instant the *server* rendered (`board.now`, `serverNow`), and a second
 * live one in the chrome would both duplicate it and — because those instants
 * are pinnable with `?date=`/`?now=` for the visual suite — be the one thing on
 * a pinned screenshot that changed every run.
 *
 * The wake lock is best-effort and silent: `navigator.wakeLock` is
 * Chromium-only and requires a secure context, so it is requested, re-requested
 * after the OS drops it on visibility change, and otherwise forgotten. A hub
 * whose screen sleeps is a hub the family taps once — an acceptable failure —
 * and asking permission for anything on a shared screen is not.
 */
export function KioskShell({
  children,
  device,
  chimeSettings,
  brand,
}: {
  children: React.ReactNode;
  /** The timers slice's chime control — see `HubSettings`. */
  chimeSettings?: React.ReactNode;
  /**
   * The Kynite mark (M18), passed in as a node rather than imported: this is a
   * client component and `BrandMark` is an async server one, so the layout
   * renders it and hands it down — the same seam `chimeSettings` uses.
   *
   * It is the icon variant and it is *small*. The wall's job is the family's
   * day, not the product's name; the mark is there so a visitor can tell what
   * the screen in the hallway is, and for no other reason.
   */
  brand?: React.ReactNode;
  /**
   * `null` on the pair screen — the one hub surface that exists precisely
   * because there is no device yet. It still gets the fullscreen frame, the
   * theme and the 6-foot scale (a family types six digits into it from across
   * a counter), just no device name, no settings and no session watcher: there
   * is nothing to watch and nothing to configure.
   */
  device: { id: string; name: string } | null;
}) {
  // `?theme=light|dark` pins the board, the same trick `/dev/design` uses and
  // for the same reason: a screenshot of a surface that decides its own colours
  // from the wall clock is not a regression test. Rendering only — it is not
  // persisted and it does not reach the server.
  const requested = useSearchParams().get('theme');
  const override: ResolvedHubTheme | undefined =
    requested === 'dark' || requested === 'light' ? requested : undefined;
  const { mode, theme, setMode } = useHubTheme(override);

  useEffect(() => {
    let sentinel: { release: () => Promise<void> } | null = null;
    let released = false;

    const request = async () => {
      try {
        sentinel = (await navigator.wakeLock?.request('screen')) ?? null;
      } catch {
        // No wake lock here. The board still renders; the screen may sleep.
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !released) void request();
    };

    void request();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, []);

  return (
    <div
      data-testid="kiosk-shell"
      data-hub-theme={theme}
      className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground [@media(pointer:coarse)]:cursor-none"
    >
      {device ? <DeviceSessionWatcher deviceId={device.id} /> : null}
      {/* M16: a household setting changed on somebody's phone and this wall has
        to follow without being touched. Not on the pair screen — it has no
        family to have settings yet. */}
      {device ? <SettingsWatcher /> : null}
      {/* M19. Not on the pair screen: there is no board to return to yet. */}
      {device ? <IdleReturn /> : null}

      <div className="flex min-h-0 flex-1">
        {/* The rail is the paired hub's only navigation, and — since M20 — its
          settings corner too (`footer`). A tablet that has not been paired has
          exactly one screen, nowhere to go and nothing of its own to
          configure yet, so it gets neither. */}
        {device ? (
          <HubRail
            footer={
              <>
                <OfflineIndicator />
                <FullyLauncherButton />
                <HubSettings
                  deviceName={device.name}
                  mode={mode}
                  theme={theme}
                  onModeChange={setMode}
                  chimeSettings={chimeSettings}
                />
              </>
            }
          />
        ) : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {device ? null : (
            // M20 review (F8 again): the header used to carry the device name,
            // the offline indicator and settings for every paired hub — all
            // three now live in the rail (name: gone outright, the rail's
            // brand tile already says what this screen is; indicator and
            // settings: its footer). A paired hub renders no header at all,
            // reclaiming the ~40px strip whole. The one surface that still
            // needs it is the pair screen: it has no rail (nothing to
            // navigate to before pairing) and nothing else on the page says
            // what app this is, so the brand mark keeps a home here.
            <header className="flex shrink-0 items-center gap-4 px-6 py-2">{brand}</header>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
