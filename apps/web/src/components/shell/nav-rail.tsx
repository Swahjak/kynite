'use client';

import Image from 'next/image';
import { cn, Icon, type IconName } from '@kynite/ui';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * The left navigation rail — `hub-rail.tsx` generalised so one rail serves
 * every surface that draws one (H2: `hub` and `desktop`).
 *
 * The shape is the kiosk's own rail (`Vandaag.dc.html`:39–47): 76px wide
 * (`w-19`), a 36px brand tile above 52px sentence-case tiles at a 16px radius,
 * with the active tile filled `bg-accent`. What differs per surface is no
 * longer the *look* — it is the destinations and the footer, both of which are
 * now data/slots handed in by the layout:
 *
 * - the **hub** layout passes the device's five tiles (`/hub`, `/hub/kalender`,
 *   `/hub/routines`, `/hub/taken`, `/hub/store`) and a footer that the kiosk
 *   shell composes (offline indicator, Google Home, Fully launcher, settings);
 * - the **member** layout (surface `desktop`) passes the member destinations
 *   from `nav-items.ts` (`RAIL_NAV`), a "Meer" trigger and a footer that is the
 *   settings tile plus the signed-in member's account tile.
 *
 * The rail itself stays renderer-agnostic: it is a plain `w-19` flex column
 * that the shell positions (`shrink-0` inside the kiosk's fullscreen flex row,
 * `fixed inset-y-0` on the member desktop).
 */

export type NavRailItem = {
  /** Stable identity — React key and the `hub-rail-<key>` testid suffix. */
  key: string;
  href: string;
  icon: IconName;
  /** Already-translated label — resolved server-side by the layout. */
  label: string;
  /**
   * Exact-match only (the board). Every other item owns its subtree; the one
   * home tile must not, because its sibling routes live under the same prefix
   * (`/hub` vs `/hub/kalender`).
   */
  exact?: boolean;
};

const railClass =
  'flex w-19 shrink-0 flex-col items-center gap-1.5 border-r border-line-subtle bg-surface-container-low py-4.5';

const brandClass =
  'mb-3.5 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl';

/** 52px square at a 16px radius — the sheet's own tile. */
export const navRailTileClass =
  'flex size-13 flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors duration-200 ease-brand focus-visible:ring-3 focus-visible:ring-ring/50';
export const navRailLabelClass =
  'text-center font-display text-overline font-bold whitespace-nowrap';
export const navRailActiveClass = 'bg-accent text-accent-foreground';
export const navRailIdleClass = 'text-ink-secondary hover:bg-surface-hover hover:text-foreground';

/** `/hub` is the only exact match; everything else owns its subtree. */
function isActivePath(pathname: string, item: NavRailItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function NavRail({
  items,
  footerItems,
  navLabel,
  brandHref,
  brandLabel,
  more,
  timerTile,
  footerExtra,
  className,
  testId,
}: {
  items: readonly NavRailItem[];
  /** Pinned to the rail's foot, above `footerExtra` — the member's settings tile. */
  footerItems?: readonly NavRailItem[];
  navLabel: string;
  /** When set, the brand tile becomes a link home (the member desktop's logo). */
  brandHref?: string;
  brandLabel?: string;
  /** Member-only: the "Meer" trigger, rendered between items and the footer. */
  more?: React.ReactNode;
  /** Kiosk-only: the conditional timer tile (M-T2). */
  timerTile?: React.ReactNode;
  /** Anything after `footerItems` — the member's account tile, the kiosk footer. */
  footerExtra?: React.ReactNode;
  className?: string;
  /** The `<nav>` testid, and the prefix of each tile's — `hub-rail` / `app-rail`. */
  testId: string;
}) {
  const pathname = usePathname();

  const brand = brandHref ? (
    <Link href={brandHref} className={brandClass} aria-label={brandLabel}>
      <Image src="/images/logo-icon.svg" alt="" width={36} height={36} unoptimized priority />
    </Link>
  ) : (
    // Not a link: this rail's first item already *is* the board, and a logo
    // that navigated somewhere on a kiosk is one more way for a five-year-old
    // to leave the screen they were sent to.
    <span aria-hidden="true" className={brandClass}>
      <Image src="/images/logo-icon.svg" alt="" width={36} height={36} unoptimized priority />
    </span>
  );

  const renderTile = (item: NavRailItem) => {
    const active = isActivePath(pathname, item);
    return (
      <Link
        key={item.key}
        href={item.href}
        data-testid={`${testId}-${item.key}`}
        data-active={active ? 'true' : 'false'}
        aria-current={active ? 'page' : undefined}
        className={cn(navRailTileClass, active ? navRailActiveClass : navRailIdleClass)}
      >
        <Icon name={item.icon} size="md" filled={active} />
        {/* Sentence case, Baloo, no tracking: "Bord", not "BORD". */}
        <span className={navRailLabelClass}>{item.label}</span>
      </Link>
    );
  };

  return (
    <nav data-testid={testId} aria-label={navLabel} className={cn(railClass, className)}>
      {brand}
      {items.map(renderTile)}
      {more}
      {timerTile}
      {footerItems?.length || footerExtra ? (
        <div className="mt-auto flex w-full flex-col items-center gap-1.5">
          {footerItems?.map(renderTile)}
          {footerExtra}
        </div>
      ) : null}
    </nav>
  );
}
