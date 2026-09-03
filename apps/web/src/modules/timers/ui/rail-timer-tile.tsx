'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { cn, Icon } from '@kynite/ui';
import { Link, usePathname } from '@/i18n/navigation';
import { phaseOf, progressRatio, remainingMs } from '../domain/countdown';
import type { TimerBoardData } from '../page-data';
import { timerIconOf } from './tokens';
import { useServerNow } from './use-server-now';
import { useTimerChannel } from './use-timer-channel';

/**
 * `HubRail`'s conditional fifth tile (M-T2): a timer is on the wall without
 * anyone having to leave the rail to check, the same promise `AmbientTimers`
 * makes for the board itself.
 *
 * A self-contained client component rather than logic inlined in
 * `HubRail` — `HubRail` (`components/hub`) may not import this slice's
 * barrel or deep-import its live channel (the boundary
 * `TimerActivityContext`'s own doc comment explains), so `(hub)/layout.tsx`
 * (a server component, free to import `@/modules/timers`) instantiates this
 * once and hands the *element* down through `KioskShell` → `HubRail` as a
 * plain `ReactNode` prop, the same seam `chimeSettings`/`brand` already use.
 * Once mounted it lives entirely on its own hooks — `HubRail` never renders
 * it again, and it does not need to.
 *
 * Renders nothing (`null`) once the live channel says no timer is running,
 * which is the actual "no timer = no tile" rule — `initial` only seeds the
 * first frame.
 */
export function RailTimerTile({ initial }: { initial: TimerBoardData }) {
  const t = useTranslations('hub.nav');
  const pathname = usePathname();
  const search = useSearchParams();
  // Review fix: `initial` is seeded by `(hub)/layout.tsx`'s `loadTimerBoard()`,
  // which is *always* unpinned — a Next 16 layout is never handed
  // `searchParams` (only a page's own props carry those), so `initial.frozen`
  // is always `false` here even on a `?now=`-pinned visual-suite screenshot
  // (`page-data.ts`'s `TimerBoardOptions` doc comment, `idle-return.tsx`'s
  // same `['date','time','now']` check). Reading the pin client-side, the way
  // `IdleReturn` already does, and folding it into the `frozen` this tile's
  // own live channel sees is the fallback that comment calls out — it stops
  // this tile ticking off the real clock inside a pinned screenshot without
  // teaching the layout anything about `searchParams`.
  const pinned = search.get('now') !== null;
  const { timers, offsetMs } = useTimerChannel(pinned ? { ...initial, frozen: true } : initial);
  const now = useServerNow(initial.serverNow, offsetMs);

  if (timers.length === 0) return null;

  // Soonest-ending, same ordering the fullscreen screen uses for its default
  // hero — the rail tile is a preview of exactly that timer.
  const sorted = [...timers].sort((a, b) => remainingMs(a, now) - remainingMs(b, now));
  const soonest = sorted[0];
  const paused = phaseOf(soonest, now) === 'paused';
  const ratio = progressRatio(soonest, now);
  const active = pathname === '/hub/timer';
  const count = timers.length;

  return (
    <Link
      href="/hub/timer"
      data-testid="hub-rail-timer"
      data-active={active ? 'true' : 'false'}
      data-paused={paused ? 'true' : 'false'}
      aria-current={active ? 'page' : undefined}
      aria-label={count > 1 ? t('timerCount', { count }) : t('timer')}
      className={cn(
        // Same 52px/16px-radius shape as `HubRail`'s own `ITEMS` tiles.
        'relative flex size-13 shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-2xl transition-colors duration-200 ease-brand',
        'focus-visible:ring-3 focus-visible:ring-ring/50',
        active ? 'text-primary' : 'text-ink-secondary hover:bg-surface-hover hover:text-foreground'
      )}
    >
      {/* The fill — bottom-up, primary-tinted, the same "how much of the
          duration has passed" reading `TimerRing`/`ProgressBar` draw
          elsewhere in this slice. Frozen (no height transition worth firing)
          while paused — the countdown itself is frozen, so a fill that kept
          gliding would be lying about it. */}
      <span
        data-testid="hub-rail-timer-fill"
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-0 bottom-0 bg-primary/15',
          !paused && 'transition-[height] duration-500 ease-linear'
        )}
        style={{ height: `${Math.round(ratio * 100)}%` }}
      />

      <Icon name={timerIconOf(soonest)} size="md" filled={active} className="relative" />

      {paused ? (
        <Icon
          name="pause"
          size="xs+"
          aria-hidden="true"
          className="absolute top-1 right-1.5 text-ink-secondary"
        />
      ) : null}

      {count > 1 ? (
        <span
          data-testid="hub-rail-timer-count"
          aria-hidden="true"
          className="absolute -top-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full border-2 border-surface-container-low bg-primary text-overline leading-none font-bold text-primary-foreground"
        >
          {count}
        </span>
      ) : null}

      <span className="relative text-center font-display text-overline font-bold whitespace-nowrap">
        {t('timer')}
      </span>
    </Link>
  );
}
