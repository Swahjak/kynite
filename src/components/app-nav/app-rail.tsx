'use client';

import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { NavOverflowSheet } from './nav-overflow-sheet';
import { RAIL_FOOTER_NAV, RAIL_NAV, isActiveHref, type NavItem, type NavLabels } from './nav-items';

/**
 * The desktop/tablet navigation rail — the `code.html` of every stitch mockup.
 *
 * 80px, fixed, full height, logo tile at the top and settings pinned to the
 * bottom. Each item is a 28px Material Symbol over a caps micro-label, and the
 * active one is a filled `primary-container` tile at `rounded-2xl`.
 *
 * This replaces the flat row of ten text links the app shell used to carry
 * (docs/rebuild-design-gaps.md §2). Every one of those destinations is still
 * one click away: six sit on the rail, the other four behind the same "More"
 * sheet the mobile bar opens.
 */
export function AppRail({ labels }: { labels: NavLabels }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-y-0 left-0 z-50 hidden w-20 flex-col items-center gap-2 border-r border-border bg-surface-container-low py-4 sm:flex"
      aria-label={labels.mainNavigation}
      data-testid="app-rail"
    >
      {/* Logo tile. The mark itself is swapped in phase 2; what the shell owes
        the mockup here is the 48px primary tile at the top of the rail. */}
      <Link
        href="/today"
        className="mb-2 flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary font-display text-h2 font-extrabold text-primary-foreground"
        aria-label={labels.appName}
      >
        {labels.appName.charAt(0)}
      </Link>

      <div className="flex flex-1 flex-col items-center gap-1">
        {RAIL_NAV.map((item) => (
          <RailLink key={item.href} item={item} labels={labels} pathname={pathname} />
        ))}
      </div>

      <NavOverflowSheet
        labels={labels}
        renderTrigger={({ onClick, active }) => (
          <button
            type="button"
            onClick={onClick}
            className={cn(railTileClass, active ? railActiveClass : railIdleClass)}
            aria-haspopup="dialog"
            data-testid="app-rail-more"
          >
            <Icon name="more_horiz" size="lg" filled={active} />
            <span className="label-overline w-full truncate text-center">{labels.more}</span>
          </button>
        )}
      />

      {RAIL_FOOTER_NAV.map((item) => (
        <RailLink key={item.href} item={item} labels={labels} pathname={pathname} />
      ))}
    </nav>
  );
}

/** 64px tile: 28px glyph + caps micro-label, 48px minimum touch target. */
const railTileClass =
  'flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-2 transition-colors duration-200 ease-brand';
const railActiveClass = 'bg-accent text-accent-foreground';
const railIdleClass = 'text-ink-secondary hover:bg-surface-container-high hover:text-ink';

function RailLink({
  item,
  labels,
  pathname,
}: {
  item: NavItem;
  labels: NavLabels;
  pathname: string;
}) {
  const active = isActiveHref(pathname, item.href);

  return (
    <Link
      href={item.href}
      className={cn(railTileClass, active ? railActiveClass : railIdleClass)}
      aria-current={active ? 'page' : undefined}
    >
      <Icon name={item.icon} size="lg" filled={active} />
      <span className="label-overline w-full truncate text-center">{labels[item.label]}</span>
    </Link>
  );
}
