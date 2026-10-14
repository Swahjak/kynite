import type { IconName } from '@kynite/ui';

/**
 * The shared navigation, as data (D16, docs/plans/2026-09-15-hub-equals-app.md).
 *
 * One table, three renderings: the desktop/hub icon rail, the mobile bottom
 * bar and the "Meer" sheet the bottom bar opens. The same destination set is
 * spelled out once, so a route can only be added or removed in one place —
 * whichever surface a request renders as.
 *
 * Labels stay in `messages/*.json` under `nav.*`; this table carries the *key*,
 * because next-intl resolves messages on the surface that renders them.
 */

/** Every `nav.*` message the shell needs, resolved server-side and passed down. */
export type NavLabels = {
  today: string;
  calendar: string;
  /** "Taken" — the household task board (`/tasks`). */
  tasks: string;
  /** "Sterren" — the child's reward shelf (`/store`). */
  stars: string;
  routines: string;
  /** "Actieve routines" — the check-in board, the "Meer" sheet's own name for `/routines`. */
  activeRoutines: string;
  rewards: string;
  settings: string;
  timers: string;
  /** "Beheer" — the `/manage` index, shown only to a principal that may manage. */
  manage: string;
  family: string;
  notifications: string;
  devices: string;
  sharing: string;
  /** The overflow trigger and its sheet's title. */
  more: string;
  /** The `<nav>` landmark's accessible name. */
  mainNavigation: string;
  /** `common.appName` — the rail's logo tile and its accessible name. */
  appName: string;
};

export type NavItem = {
  href: string;
  /** Key into `NavLabels`, so the label is translated where it is rendered. */
  label: keyof NavLabels;
  /** Material Symbols glyph — the house icon system (`components/ui/icon.tsx`). */
  icon: IconName;
};

/**
 * The four destinations a family reaches for daily — the mobile bottom bar's
 * tabs, in the order the Kalender mockup lays them out (`Kalender.dc.html`).
 */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: '/today', label: 'today', icon: 'home' },
  { href: '/calendar', label: 'calendar', icon: 'calendar_month' },
  { href: '/tasks', label: 'tasks', icon: 'checklist' },
  { href: '/store', label: 'stars', icon: 'star' },
] as const;

/**
 * Two more that earn a permanent slot on a rail but not a thumb-sized tab:
 * the rail has the height for them, a 390px bottom bar does not.
 */
export const RAIL_NAV: readonly NavItem[] = [
  ...PRIMARY_NAV,
  { href: '/routines', label: 'routines', icon: 'restart_alt' },
  { href: '/timers', label: 'timers', icon: 'timer' },
] as const;

/**
 * The device (kiosk) rail: `RAIL_NAV` without Timers. The kiosk draws its own
 * conditional `RailTimerTile` (a live countdown when one runs), so a static
 * Timers tile would be a duplicate — the pre-merge hub rail dropped it too.
 */
export const DEVICE_RAIL_NAV: readonly NavItem[] = RAIL_NAV.filter(
  (item) => item.href !== '/timers'
);

/**
 * Everything behind the "More" trigger — the everyday surfaces a bottom bar
 * cannot fit (`/routines`, `/timers`), then Beheer (`/manage`). The Beheer
 * entry is gated on a capability, not a surface: the layouts filter it out for
 * a principal that may not manage, so a child, a caregiver or a device never
 * sees it (D16).
 */
export const OVERFLOW_NAV: readonly NavItem[] = [
  { href: '/routines', label: 'activeRoutines', icon: 'restart_alt' },
  { href: '/timers', label: 'timers', icon: 'timer' },
  { href: '/manage', label: 'manage', icon: 'settings' },
] as const;

/** Pinned to the bottom of the rail, per the stitch mockups. */
export const RAIL_FOOTER_NAV: readonly NavItem[] = [
  { href: '/manage', label: 'manage', icon: 'settings' },
] as const;

/**
 * Drop the Beheer entry for a principal that may not manage. The layouts call
 * this with the capability answer they resolve from the principal (`can()`);
 * the device branch never sees either list at all, because it renders the
 * rail from `RAIL_NAV` alone.
 */
export function withoutManage(items: readonly NavItem[]): readonly NavItem[] {
  return items.filter((item) => item.href !== '/manage');
}

/**
 * Segment-aware active match: `pathname` carries the locale prefix
 * (`/nl/calendar/week`) while `href` never does (`/calendar`), and a plain
 * `pathname.endsWith(href)` only matches the destination's own root — a week
 * or day sub-route falls out of "active" the moment it grows a segment past
 * the tab's href. Stripping the two-letter locale prefix and requiring a
 * whole-segment match (`===` or a `/`-bounded prefix) keeps every sub-route
 * under a tab active without matching an unrelated route that merely shares a
 * prefix (`/calendar` must not light up for a hypothetical `/calendarish`).
 */
export function isActiveHref(pathname: string, href: string): boolean {
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/';
  return withoutLocale === href || withoutLocale.startsWith(`${href}/`);
}
