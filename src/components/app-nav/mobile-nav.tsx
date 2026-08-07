'use client';

import { useState } from 'react';
import {
  BellIcon,
  CalendarIcon,
  HomeIcon,
  ListChecksIcon,
  MenuIcon,
  Share2Icon,
  StarIcon,
  TabletSmartphoneIcon,
  TimerIcon,
  UsersIcon,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from '@/components/ui/sheet';

type OverflowLink = { href: string; label: string; icon: typeof TimerIcon };

type MobileNavProps = {
  labels: {
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
    /** The 5th tab and its sheet's title — distinct from `settings`, which
     *  is only one of the destinations the sheet opens onto. */
    more: string;
    /** The `<nav>` landmark's accessible name — a screen reader announcing
     *  "Settings, navigation" for the whole bottom bar was never right. */
    mainNavigation: string;
  };
};

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
function isActiveHref(pathname: string, href: string): boolean {
  const withoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '') || '/';
  return withoutLocale === href || withoutLocale.startsWith(`${href}/`);
}

/**
 * M15/NB-6: the parent app's header used to be ten flat links, which overflow
 * a 390px phone viewport (carried forward from M13). Below `sm`, that nav is
 * replaced by a fixed bottom bar with the five destinations a parent reaches
 * for daily (Home, Calendar, Routines, Rewards) plus a "More" sheet holding
 * everything else (Timers, Family, and the settings sub-pages) — the same
 * primary-vs-overflow split the Stitch parent-mobile design uses.
 */
export function MobileNav({ labels }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const overflowLinks: OverflowLink[] = [
    { href: '/timers', label: labels.timers, icon: TimerIcon },
    { href: '/family', label: labels.family, icon: UsersIcon },
    { href: '/settings/notifications', label: labels.notifications, icon: BellIcon },
    { href: '/settings/devices', label: labels.devices, icon: TabletSmartphoneIcon },
    { href: '/settings/sharing', label: labels.sharing, icon: Share2Icon },
  ];

  const primary = [
    { href: '/today', label: labels.today, icon: HomeIcon },
    { href: '/calendar', label: labels.calendar, icon: CalendarIcon },
    { href: '/routines', label: labels.routines, icon: ListChecksIcon },
    { href: '/rewards', label: labels.rewards, icon: StarIcon },
  ];

  const isOverflowActive = overflowLinks.some((link) => isActiveHref(pathname, link.href));

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-border bg-background sm:hidden"
      aria-label={labels.mainNavigation}
      data-testid="mobile-nav"
    >
      {primary.map(({ href, label, icon: Icon }) => {
        const active = isActiveHref(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium',
              active ? 'text-primary' : 'text-ink-secondary'
            )}
            aria-current={active ? 'page' : undefined}
          >
            <Icon aria-hidden="true" className="size-5" />
            {label}
          </Link>
        );
      })}
      <Sheet open={open} onOpenChange={setOpen}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium',
            isOverflowActive ? 'text-primary' : 'text-ink-secondary'
          )}
          aria-haspopup="dialog"
          data-testid="mobile-nav-more"
        >
          <MenuIcon aria-hidden="true" className="size-5" />
          {labels.more}
        </button>
        <SheetContent side="bottom" data-testid="mobile-nav-sheet">
          <SheetHeader>
            <SheetTitle>{labels.more}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 p-4 pt-0">
            {overflowLinks.map(({ href, label, icon: Icon }) => (
              <SheetClose
                key={href}
                render={
                  <Link
                    href={href}
                    className="flex min-h-12 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
                  />
                }
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </SheetClose>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
