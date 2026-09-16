'use client';

import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { cn, Icon } from '@kynite/ui';
import { NavOverflowSheet } from './nav-overflow-sheet';
import { isActiveHref, type NavItem, type NavLabels } from './nav-items';
import { UserMenuSheetSection, type UserMenuLabels, type UserMenuUser } from './user-menu';

/**
 * The phone bottom tab bar — `home_light_mode/code.html`.
 *
 * Five tabs, glass (`bg-surface/80 backdrop-blur-xl` + `pb-safe`, so it does
 * not sit under an iOS home indicator), Material Symbols filled on the active
 * tab, label in caps micro-type.
 *
 * Destinations are data: the layout (via the shell) hands in `primary` (the
 * tabs) and `overflow` (everything behind the "Meer" sheet), because which
 * surface a request renders as is decided server-side, not by a CSS
 * breakpoint. This bar is now drawn only when the surface is `app`, so it no
 * longer carries its own `sm:hidden` — the shell is the one switch.
 */
export function MobileNav({
  labels,
  primary,
  overflow,
  user,
  userLabels,
  signOut,
  className,
}: {
  labels: NavLabels;
  primary: readonly NavItem[];
  overflow: readonly NavItem[];
  user?: UserMenuUser;
  userLabels: UserMenuLabels;
  signOut: () => Promise<void>;
  /** Visibility refinement — the `desktop` surface passes `sm:hidden`. */
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'glass pb-safe fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border',
        className
      )}
      aria-label={labels.mainNavigation}
      data-testid="mobile-nav"
    >
      {primary.map(({ href, label, icon }) => {
        const active = isActiveHref(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(tabClass, active ? tabActiveClass : tabIdleClass)}
            aria-current={active ? 'page' : undefined}
          >
            <Icon name={icon} size="md" filled={active} />
            <span className={tabLabelClass}>{labels[label]}</span>
          </Link>
        );
      })}
      <NavOverflowSheet
        labels={labels}
        items={overflow}
        footer={
          user ? (
            <UserMenuSheetSection user={user} labels={userLabels} signOut={signOut} />
          ) : undefined
        }
        renderTrigger={({ onClick, active }) => (
          <button
            type="button"
            onClick={onClick}
            className={cn(tabClass, active ? tabActiveClass : tabIdleClass)}
            aria-haspopup="dialog"
            data-testid="mobile-nav-more"
          >
            <Icon name="more_horiz" size="md" filled={active} />
            <span className={tabLabelClass}>{labels.more}</span>
          </button>
        )}
      />
    </nav>
  );
}

const tabClass =
  'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-all duration-200 ease-brand active:scale-95';
/**
 * Sentence case, Baloo, no tracking — the design's 10px tab label
 * ("Vandaag.dc.html":479–482), at the 12px the type scale actually declares.
 */
const tabLabelClass = 'w-full truncate text-center font-display text-caption font-bold';
/**
 * `text-primary`, which the mockups use, is now legible as text.
 */
const tabActiveClass = 'font-bold text-primary';
const tabIdleClass = 'text-ink-secondary';
