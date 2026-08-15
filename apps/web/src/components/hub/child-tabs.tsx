'use client';

import { useTranslations } from 'next-intl';
import { cn, Icon, type IconName } from '@kynite/ui';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * One child's three screens, as a switcher (M19).
 *
 * The rail gets a child *to* their routines; this is what keeps them moving
 * between the three things that are theirs — their steps, their stars, their
 * shelf — without going back to the board and starting again. It carries the
 * member id in every link, so "whose screen is this" never becomes ambiguous:
 * there is still no surface in this product that shows two children at once
 * (research §Decisions 3).
 *
 * Sized like the rest of the kiosk: 56px pills, generous padding, no hover-only
 * affordances. Presentational — the active state is read from the path rather
 * than passed in, so a page cannot mislabel itself.
 */

type Tab = {
  key: 'routines' | 'stars' | 'store';
  icon: IconName;
  href: (memberId: string) => string;
};

const TABS: readonly Tab[] = [
  { key: 'routines', icon: 'checklist', href: (id) => `/hub/routines/${id}` },
  { key: 'stars', icon: 'star', href: (id) => `/hub/stars/${id}` },
  { key: 'store', icon: 'redeem', href: (id) => `/hub/store?member=${id}` },
];

export function ChildTabs({ memberId, displayName }: { memberId: string; displayName: string }) {
  const t = useTranslations('hub.child');
  const pathname = usePathname();

  return (
    <nav
      data-testid="hub-child-tabs"
      data-member-id={memberId}
      aria-label={t('label', { name: displayName })}
      // `p-1`, not `p-2` (M19 review, F8): the tabs are the third band of chrome
      // above a child's steps on an 800px wall, and 8px of tray padding around
      // 56px pills was the cheapest 16px to give back. The pills themselves are
      // untouched — they are the tap target.
      className="flex w-max flex-row items-center gap-2 rounded-4xl bg-muted p-1"
    >
      {TABS.map((tab) => {
        const href = tab.href(memberId);
        const active = pathname.startsWith(href.split('?')[0]);

        return (
          <Link
            key={tab.key}
            href={href}
            data-testid={`hub-child-tab-${tab.key}`}
            data-active={active ? 'true' : 'false'}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-14 items-center gap-3 rounded-4xl px-6 font-display text-body-lg font-medium transition-colors duration-200 ease-brand',
              'focus-visible:ring-3 focus-visible:ring-ring/50',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-ink-secondary hover:bg-surface-hover'
            )}
          >
            <Icon name={tab.icon} size="lg" filled={active} />
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
