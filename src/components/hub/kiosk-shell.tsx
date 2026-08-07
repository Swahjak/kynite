'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { OfflineIndicator } from '@/components/offline';
import { DeviceSessionWatcher } from './device-session-watcher';
import { HubSettings } from './hub-settings';
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
 *  - **fullscreen, no chrome.** `h-dvh overflow-hidden` and a single fixed
 *    header strip. There is no nav, no sign-out, no back button — a wall
 *    tablet in `display: fullscreen` (public/hub.webmanifest) has no browser
 *    UI to fall back on, so anything not drawn here does not exist.
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
}: {
  children: React.ReactNode;
  /** The timers slice's chime control — see `HubSettings`. */
  chimeSettings?: React.ReactNode;
  /**
   * `null` on the pair screen — the one hub surface that exists precisely
   * because there is no device yet. It still gets the fullscreen frame, the
   * theme and the 6-foot scale (a family types six digits into it from across
   * a counter), just no device name, no settings and no session watcher: there
   * is nothing to watch and nothing to configure.
   */
  device: { id: string; name: string } | null;
}) {
  const t = useTranslations('devices.hubSettings');
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

      <header className="flex shrink-0 items-center justify-between gap-4 px-6 pt-4 pb-2">
        <div className="flex items-baseline gap-4">
          {device ? (
            <span className="text-body-lg text-ink-secondary" data-testid="hub-device-name">
              {t('deviceName', { name: device.name })}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <OfflineIndicator />
          {device ? (
            <HubSettings
              deviceName={device.name}
              mode={mode}
              theme={theme}
              onModeChange={setMode}
              chimeSettings={chimeSettings}
            />
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
