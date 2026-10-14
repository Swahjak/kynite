'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { cn, Icon } from '@kynite/ui';
import {
  DeviceSessionWatcher,
  FullyLauncherButton,
  GoogleHomeButton,
  HubSettings,
  IdleReturn,
  SettingsWatcher,
  useHubTheme,
  type ResolvedHubTheme,
} from '@/components/hub';
import { OfflineIndicator } from '@/components/offline';
import { MobileNav } from '@/components/app-nav/mobile-nav';
import { NavOverflowSheet } from '@/components/app-nav/nav-overflow-sheet';
import { UserMenu } from '@/components/app-nav/user-menu';
import type { NavItem, NavLabels } from '@/components/app-nav/nav-items';
import type { UserMenuLabels, UserMenuUser } from '@/components/app-nav/user-menu';
import {
  NavRail,
  navRailActiveClass,
  navRailIdleClass,
  navRailLabelClass,
  navRailTileClass,
  type NavRailItem,
} from './nav-rail';

export type { NavRailItem } from './nav-rail';

/**
 * The one shell `(app)/layout.tsx` and `(main)/layout.tsx` render (D9).
 *
 * Navigation is chosen by the `surface` the layout resolves server-side and
 * passes down:
 *
 * - `desktop` draws the left rail (`NavRail`) for a member; the kiosk draws
 *   the same rail from the device's own items (`surface` ignored);
 * - `app` draws the bottom tab bar plus the "Meer" sheet (`MobileNav`).
 *
 * Kiosk-only behaviour (idle return, the session/settings watchers, the wake
 * lock, the hub theme) lives in `KioskFrame`, mounted only when `kiosk` is
 * set — which only the device layout passes. Member-only parts (the Google
 * re-auth banner, the account tile) and the FAB slot arrive as slots; the
 * shell never decides who sees them, the layout does.
 */

export type ShellSurface = 'app' | 'desktop' | 'hub';

/** The member's bottom-nav data — labels, destinations and the account tile. */
export type AppShellMember = {
  labels: NavLabels;
  primary: readonly NavItem[];
  overflow: readonly NavItem[];
  user?: UserMenuUser;
  userLabels: UserMenuLabels;
  signOut: () => Promise<void>;
};

export type AppShellProps = {
  /** Resolved surface: decides rail vs bottom nav (ignored in kiosk mode). */
  surface: ShellSurface;
  children: React.ReactNode;
  /** Kiosk mode (device tree): fullscreen frame, wake lock, hub theme. */
  kiosk?: boolean;
  /** Paired device; `null` on the pair screen (no rail, header shown). */
  device?: { id: string; name: string } | null;
  /** Rail destinations + accessible name — both layouts provide these. */
  railItems: readonly NavRailItem[];
  railFooterItems?: readonly NavRailItem[];
  railNavLabel: string;
  /** The rail's `<nav>` testid — `hub-rail` (device) or `app-rail` (member). */
  railTestId: string;
  /** Member-only: make the brand tile a link home. */
  railBrandHref?: string;
  railBrandLabel?: string;
  /** Kiosk-only: the conditional timer tile and the chime control. */
  railTimerTile?: React.ReactNode;
  chimeSettings?: React.ReactNode;
  /** Kiosk-only: the pair screen's header brand. */
  brand?: React.ReactNode;
  /** Member-only: bottom-nav data (labels + destinations + account). */
  member?: AppShellMember;
  /** Member-only: the Google re-auth banner above content. */
  banner?: React.ReactNode;
  /** Shared: the FAB portal slot (member always; hub when paired). */
  fab?: React.ReactNode;
};

export function AppShell(props: AppShellProps) {
  if (props.kiosk) {
    return <KioskFrame {...props} />;
  }
  const { member } = props;
  // Unreachable: a member surface always carries its bottom-nav data.
  if (!member) return null;
  return <MemberFrame {...props} member={member} />;
}

/**
 * The kiosk frame (M12) — the frame a paired device (or the pair screen) gets. Fullscreen, no chrome,
 * theme applied before first paint, and it comes home by itself.
 */
function KioskFrame(props: AppShellProps) {
  const {
    children,
    device,
    chimeSettings,
    brand,
    railItems,
    railNavLabel,
    railTestId,
    railTimerTile,
    fab,
  } = props;

  // `?theme=light|dark` pins the board for the visual suite — rendering only.
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
      {device ? <SettingsWatcher /> : null}
      {device ? <IdleReturn /> : null}
      {fab}

      <div className="flex min-h-0 flex-1">
        {device ? (
          <NavRail
            items={railItems}
            navLabel={railNavLabel}
            testId={railTestId}
            timerTile={railTimerTile}
            footerExtra={
              <>
                <OfflineIndicator />
                <GoogleHomeButton />
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
            <header className="flex shrink-0 items-center gap-4 px-6 py-2">{brand}</header>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** The member frame — the same rail the wall draws, plus the phone's bottom bar. */
function MemberFrame(props: AppShellProps & { member: AppShellMember }) {
  const {
    children,
    surface,
    railItems,
    railFooterItems,
    railNavLabel,
    railTestId,
    railBrandHref,
    railBrandLabel,
    member,
    banner,
    fab,
  } = props;

  // Surface picks the chrome; breakpoints refine inside it. `app` is the phone
  // bottom bar at every width; `desktop` draws the rail above `sm` and the
  // same bottom bar below it — exactly the old `(app)/layout.tsx` split.
  const desktop = surface === 'desktop';

  return (
    <>
      {desktop ? (
        <NavRail
          className="fixed inset-y-0 left-0 z-50 hidden sm:flex"
          items={railItems}
          footerItems={railFooterItems}
          navLabel={railNavLabel}
          testId={railTestId}
          brandHref={railBrandHref}
          brandLabel={railBrandLabel}
          more={
            <NavOverflowSheet
              labels={member.labels}
              items={member.overflow}
              renderTrigger={({ onClick, active }) => (
                <button
                  type="button"
                  onClick={onClick}
                  className={cn(navRailTileClass, active ? navRailActiveClass : navRailIdleClass)}
                  aria-haspopup="dialog"
                  data-testid="app-rail-more"
                >
                  <Icon name="more_horiz" size="md" filled={active} />
                  <span className={navRailLabelClass}>{member.labels.more}</span>
                </button>
              )}
            />
          }
          footerExtra={
            member.user ? (
              <UserMenu user={member.user} labels={member.userLabels} signOut={member.signOut} />
            ) : null
          }
        />
      ) : null}
      <div className={cn('pt-safe flex min-h-dvh flex-col', desktop && 'sm:pl-19')}>
        {banner}
        <div className={cn('flex-1 pb-24', desktop && 'sm:pb-0')}>{children}</div>
      </div>
      <MobileNav
        className={desktop ? 'sm:hidden' : undefined}
        labels={member.labels}
        primary={member.primary}
        overflow={member.overflow}
        user={member.user}
        userLabels={member.userLabels}
        signOut={member.signOut}
      />
      {fab}
    </>
  );
}
