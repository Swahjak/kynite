'use client';

import Image from 'next/image';
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
 * What it still is not: a browser. No back button, no sign-out. Settings
 * *does* live here now (M20 pulled it down from the header strip it used to
 * share with the device name — F8 below), pinned to the rail's own foot by
 * the `footer` slot: one tap away, and still out of the room's eyeline
 * because it is the same discreet icon it always was, just moved.
 *
 * ## D1: the design's rail, not the design's destinations
 *
 * "Vandaag.dc.html":39–47 draws this rail 76px wide, with a 36px indigo brand
 * tile above four 52px sentence-case tiles and the signed-in parent's face
 * pinned below them. The *shape* is now that drawing: the tile, the width, the
 * 52px targets, the 16px radius, the rgba(93,95,239,.10) active wash, the
 * labels written rather than shouted.
 *
 * The *destinations* deliberately are not. The sheet's four are the parent
 * app's tabs (Vandaag / Kalender / Routines / Sterren), which live in the
 * `(app)` tree behind a member session; a device principal navigating there is
 * sent straight back to the pair screen, so drawing them would be four tiles
 * that bounce. What a wall tablet has instead is the board, the shelf and the
 * timers — the three surfaces a child standing in front of it can actually
 * reach — and per-child screens still arrive through a face on the board
 * rather than through a nav rail that cannot name whose.
 *
 * The face at the foot of the sheet's rail is out for the same reason: there
 * is nobody signed in at a kiosk by construction — what sits at the foot
 * instead (M20) is the settings trigger and the offline indicator, handed in
 * through `footer` rather than owned here, because both are composed in
 * `KioskShell` from state (`mode`, `theme`, `chimeSettings`) the rail has no
 * reason to know about.
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

export function HubRail({ footer }: { footer?: React.ReactNode }) {
  const t = useTranslations('hub.nav');
  const pathname = usePathname();

  return (
    <nav
      data-testid="hub-rail"
      aria-label={t('label')}
      className="flex w-19 shrink-0 flex-col items-center gap-1.5 border-r border-line-subtle bg-surface-container-low py-4.5"
    >
      {/* The brand mark, at the design's 36px. Not a link: this rail's first
          item already *is* the board, and a logo that navigated somewhere on a
          kiosk is one more way for a five-year-old to leave the screen they
          were sent to. */}
      <span
        aria-hidden="true"
        className="mb-3.5 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl"
      >
        <Image src="/images/logo-icon.svg" alt="" width={36} height={36} unoptimized priority />
      </span>

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
              // 52px square at a 16px radius — the sheet's own tile, and still
              // past the 48px kiosk minimum for a target a five-year-old aims
              // at from standing height.
              'flex size-13 flex-col items-center justify-center gap-0.5 rounded-2xl transition-colors duration-200 ease-brand',
              'focus-visible:ring-3 focus-visible:ring-ring/50',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-ink-secondary hover:bg-surface-hover hover:text-foreground'
            )}
          >
            <Icon name={item.icon} size="md" filled={active} />
            {/* Sentence case, Baloo, no tracking: "Bord", not "BORD". At the
                `overline` step rather than `caption` because the kiosk scale
                re-points both — 16px against 18px — and "Winkel" at 18px is
                three pixels wider than the 52px tile it has to live in. */}
            <span className="text-center font-display text-overline font-bold whitespace-nowrap">
              {t(item.key)}
            </span>
          </Link>
        );
      })}

      {footer ? (
        // Pinned to the rail's foot, same width/centering as the tiles above
        // it — the D1 comment's "one tap away, out of the room's eyeline"
        // face just moved down here instead of disappearing.
        <div className="mt-auto flex w-full flex-col items-center gap-1.5">{footer}</div>
      ) : null}
    </nav>
  );
}
