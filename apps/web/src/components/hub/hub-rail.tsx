'use client';

import { useTranslations } from 'next-intl';
import { cn, Icon, type IconName } from '@kynite/ui';
import { Link, usePathname } from '@/i18n/navigation';

/**
 * The kiosk's navigation rail (M19).
 *
 * Until M19 the hub had no navigation at all: `/hub/routines/[id]`,
 * `/hub/store` and `/hub/timers` existed and were reachable only by typing a
 * URL, which on a wall tablet in `display: fullscreen` means "not reachable".
 * The owner decision that the hub is the *primary child-facing surface* is
 * mostly a wiring job, and this is the first wire — a child standing at the
 * wall has to be able to get to the shelf and to their own steps.
 *
 * It is the Stitch left rail (`…/today_s_flow_light_mode_landscape_hub`), and
 * it is deliberately **three destinations and no more**: the board, the shelf,
 * the timers. Per-child screens are not here — they are reached by tapping the
 * child on the board (`ChildLauncher`), because "whose routines" is a question
 * a nav rail cannot answer and a face can.
 *
 * What it still is not: a browser. No back button, no sign-out, no settings
 * (that lives in the shell's settings corner, one tap away and out of the
 * room's eyeline), which `e2e/tests/hub/kiosk-audit.spec.ts` asserts by name.
 */

type RailItem = {
  key: 'board' | 'store' | 'timers';
  href: '/hub' | '/hub/store' | '/hub/timers';
  icon: IconName;
};

const ITEMS: readonly RailItem[] = [
  { key: 'board', href: '/hub', icon: 'space_dashboard' },
  { key: 'store', href: '/hub/store', icon: 'redeem' },
  { key: 'timers', href: '/hub/timers', icon: 'timer' },
];

/** The board is the only exact match; everything else owns its subtree. */
function isActive(pathname: string, href: string): boolean {
  return href === '/hub' ? pathname === '/hub' : pathname.startsWith(href);
}

export function HubRail() {
  const t = useTranslations('hub.nav');
  const pathname = usePathname();

  return (
    <nav
      data-testid="hub-rail"
      aria-label={t('label')}
      className="flex w-24 shrink-0 flex-col items-center gap-3 bg-surface py-4"
    >
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.key}
            href={item.href}
            data-testid={`hub-rail-${item.key}`}
            data-active={active ? 'true' : 'false'}
            aria-current={active ? 'page' : undefined}
            className={cn(
              // 80x80: past the 48px kiosk minimum, because this is a target a
              // five-year-old aims at from standing height.
              'flex size-20 flex-col items-center justify-center gap-1 rounded-2xl transition-colors duration-200 ease-brand',
              'focus-visible:ring-3 focus-visible:ring-ring/50',
              active
                ? 'bg-primary/12 text-primary'
                : 'text-ink-secondary hover:bg-surface-hover hover:text-foreground'
            )}
          >
            <Icon name={item.icon} size="xl" filled={active} />
            <span className="label-overline">{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
