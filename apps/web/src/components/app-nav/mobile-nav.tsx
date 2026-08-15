'use client';

import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { NavOverflowSheet } from './nav-overflow-sheet';
import { PRIMARY_NAV, isActiveHref, type NavLabels } from './nav-items';
import { UserMenuSheetSection, type UserMenuLabels, type UserMenuUser } from './user-menu';

/**
 * The phone bottom tab bar — `home_light_mode/code.html`.
 *
 * Five tabs, glass (`bg-surface/80 backdrop-blur-xl` + `pb-safe`, so it does
 * not sit under an iOS home indicator), Material Symbols filled on the active
 * tab, label in caps micro-type.
 *
 * M15/NB-6: the parent app's header used to be ten flat links, which overflow a
 * 390px phone viewport. Below `sm` that nav is replaced by this bar — the four
 * destinations a parent reaches for daily plus a "More" sheet holding
 * everything else. M19 restyled it to the mockups and moved it onto the house
 * icon system: it was the last lucide holdout in the product, and it is the
 * most-seen nav on phones (docs/rebuild-design-gaps.md §5 root cause 3).
 */
export function MobileNav({
  labels,
  user,
  userLabels,
  signOut,
}: {
  labels: NavLabels;
  user?: UserMenuUser;
  userLabels: UserMenuLabels;
  signOut: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <nav
      className="glass pb-safe fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border sm:hidden"
      aria-label={labels.mainNavigation}
      data-testid="mobile-nav"
    >
      {PRIMARY_NAV.map(({ href, label, icon }) => {
        const active = isActiveHref(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(tabClass, active ? tabActiveClass : tabIdleClass)}
            aria-current={active ? 'page' : undefined}
          >
            <Icon name={icon} size="md" filled={active} />
            <span className="label-overline w-full truncate text-center">{labels[label]}</span>
          </Link>
        );
      })}
      <NavOverflowSheet
        labels={labels}
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
            <span className="label-overline w-full truncate text-center">{labels.more}</span>
          </button>
        )}
      />
    </nav>
  );
}

const tabClass =
  'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-all duration-200 ease-brand active:scale-95';
/**
 * `text-primary`, which the mockups use, is now legible as text: the stitch
 * indigo is 7.47:1 on the bar's surface where the old brand green was 1.46:1
 * and had to be swapped for `text-brand-ink` (M17's axe sweep at 390px).
 * Both tokens now resolve to the same colour, and `text-primary` is the one the
 * mockup names.
 */
const tabActiveClass = 'font-bold text-primary';
const tabIdleClass = 'text-ink-secondary';
