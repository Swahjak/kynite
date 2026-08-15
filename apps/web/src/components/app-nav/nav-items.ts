import type { IconName } from '@kynite/ui';

/**
 * The parent app's navigation, as data.
 *
 * One table, three renderings: the desktop icon rail, the mobile bottom bar and
 * the overflow sheet both of them open. Before M19 the same ten destinations
 * were spelled out twice — once as flat `<Link>`s in `(app)/layout.tsx`, once
 * as a lucide-icon array in `mobile-nav.tsx` — and the two had already drifted
 * (the header carried no icons at all). Keeping the set here means a route can
 * only be added or removed in one place.
 *
 * Labels stay in `messages/*.json` under `nav.*`; this table carries the *key*,
 * because next-intl resolves messages on the surface that renders them.
 */

/** Every `nav.*` message the shell needs, resolved server-side and passed down. */
export type NavLabels = {
  today: string;
  calendar: string;
  routines: string;
  rewards: string;
  settings: string;
  timers: string;
  family: string;
  notifications: string;
  devices: string;
  sharing: string;
  /** The overflow trigger and its sheet's title — distinct from `settings`,
   *  which is only one of the destinations the sheet opens onto. */
  more: string;
  /** The `<nav>` landmark's accessible name — a screen reader announcing
   *  "Settings, navigation" for the whole bottom bar was never right. */
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
 * The four destinations a parent reaches for daily. These are the mobile bottom
 * bar's tabs and the top of the desktop rail, in the same order on both, so
 * muscle memory survives a change of device.
 */
export const PRIMARY_NAV: readonly NavItem[] = [
  { href: '/today', label: 'today', icon: 'home' },
  { href: '/calendar', label: 'calendar', icon: 'calendar_month' },
  { href: '/routines', label: 'routines', icon: 'checklist' },
  { href: '/rewards', label: 'rewards', icon: 'star' },
] as const;

/**
 * Two more that earn a permanent slot on a rail but not a thumb-sized tab:
 * the rail has the height for them, a 390px bottom bar does not.
 */
export const RAIL_NAV: readonly NavItem[] = [
  ...PRIMARY_NAV,
  { href: '/timers', label: 'timers', icon: 'timer' },
  { href: '/family', label: 'family', icon: 'group' },
] as const;

/**
 * Everything behind the "More" trigger — identical on the rail and the bottom
 * bar, so no destination is reachable on one device and not the other.
 *
 * M16 put a settings *hub* in front of the last three; they stay listed anyway
 * because each is a flow of its own and both nav shapes have pointed at them
 * since M11–M13 (an e2e test navigates to Google settings through this sheet).
 */
export const OVERFLOW_NAV: readonly NavItem[] = [
  { href: '/timers', label: 'timers', icon: 'timer' },
  { href: '/family', label: 'family', icon: 'group' },
  { href: '/settings', label: 'settings', icon: 'settings' },
  { href: '/settings/notifications', label: 'notifications', icon: 'notifications' },
  { href: '/settings/devices', label: 'devices', icon: 'tablet_mac' },
  { href: '/settings/sharing', label: 'sharing', icon: 'share' },
] as const;

/** Pinned to the bottom of the rail, per the stitch mockups. */
export const RAIL_FOOTER_NAV: readonly NavItem[] = [
  { href: '/settings', label: 'settings', icon: 'settings' },
] as const;

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
