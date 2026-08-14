'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { NavOverflowSheet } from './nav-overflow-sheet';
import { RAIL_FOOTER_NAV, RAIL_NAV, isActiveHref, type NavItem, type NavLabels } from './nav-items';
import { UserMenu, type UserMenuLabels, type UserMenuUser } from './user-menu';

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
 *
 * M21: the signed-in member's face is pinned below `settings`, and the sign-out
 * that used to sit in the shell's glass header now lives in the menu it opens
 * (`user-menu.tsx`). The header itself is gone, so every page starts at the top
 * of the viewport.
 */
export function AppRail({
  labels,
  user,
  userLabels,
  signOut,
}: {
  labels: NavLabels;
  /** Absent when the member row has gone missing mid-session — the rail then
   *  simply has no account tile, exactly as the header degraded before. */
  user?: UserMenuUser;
  userLabels: UserMenuLabels;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-y-0 left-0 z-50 hidden w-20 flex-col items-center gap-2 border-r border-border bg-surface-container-low py-4 sm:flex"
      aria-label={labels.mainNavigation}
      data-testid="app-rail"
    >
      {/* Logo tile — `docs/design/brand.md` § "Icon / App icon": the two-blob
        star mark, self-contained (own rounded-square background baked into
        the SVG), so it sits bare rather than inside a second `bg-primary`
        tile. `AppRail` is a client component (it reads `usePathname`), so this
        renders the static asset via `next/image` directly rather than
        `BrandMark` (a server component). */}
      <Link
        href="/today"
        className="mb-2 flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl"
        aria-label={labels.appName}
      >
        <Image src="/images/logo-icon.svg" alt="" width={48} height={48} unoptimized priority />
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

      {user ? <UserMenu user={user} labels={userLabels} signOut={signOut} /> : null}
    </nav>
  );
}

/** 64px tile: 28px glyph + caps micro-label, 48px minimum touch target. */
const railTileClass =
  'flex w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-2 transition-all duration-200 ease-brand active:scale-95';
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
